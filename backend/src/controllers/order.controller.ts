import { Request, Response } from 'express';
import { prisma, withDbRetry } from '../config/db';
import { OrderStatus, TableStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { notifyStaff, notifyOrderUpdate } from '../socket';

// PUBLIC: Customer places an order
export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
  let { tableId, restaurantId, items, notes } = req.body;

  // Security: enforce verified tableId and restaurantId from JWT token for CUSTOMERs
  if (req.user?.role === 'CUSTOMER') {
    tableId = req.user.tableId;
    restaurantId = req.user.restaurantId;
  }

  if (!tableId || !restaurantId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order request parameters' });
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const table = await prisma.table.findUnique({
      where: { id: tableId },
    });
    if (!table || table.restaurantId !== restaurantId) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get or create active session
    let activeSessionId = req.user?.sessionId;
    if (!activeSessionId) {
      const activeSession = await prisma.tableSession.findFirst({
        where: { tableId, isActive: true },
      });
      if (activeSession) {
        activeSessionId = activeSession.id;
      } else {
        const newSession = await prisma.tableSession.create({
          data: {
            tableId,
            restaurantId,
            isActive: true,
          },
        });
        activeSessionId = newSession.id;
      }
    }

    // Calculate billing amounts based on DB prices to prevent tampering.
    // Batch-fetch all requested menu items in a SINGLE query (fixes N+1).
    const requestedIds = items.map((i: any) => i.menuItemId);
    const menuItemsFromDB = await prisma.menuItem.findMany({
      where: { id: { in: requestedIds }, restaurantId },
    });
    const menuItemMap = new Map(menuItemsFromDB.map((m) => [m.id, m]));

    let subTotal = 0;
    const orderItemsToCreate: any[] = [];

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      }
      if (!menuItem.isAvailable) {
        return res.status(400).json({ error: `${menuItem.name} is currently out of stock` });
      }

      const itemCost = menuItem.price * item.quantity;
      subTotal += itemCost;

      orderItemsToCreate.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        price: menuItem.price,
        // customs arrives from the frontend already JSON-stringified.
        // Store it as-is to avoid double-encoding (which caused the Kitchen
        // Queue to render numeric character indices instead of modifier names).
        customs: item.customs || null,
        notes: item.notes || null,
      });
    }

    const taxAmount = Math.round(subTotal * (restaurant.taxRate / 100) * 100) / 100;
    const grandTotal = subTotal + taxAmount;

    // Generate short ID
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const orderCountToday = await prisma.order.count({
      where: {
        restaurantId,
        createdAt: { gte: todayStart },
      },
    });
    const shortId = `#${(1001 + orderCountToday).toString()}`;

    // Transaction to create order, update inventory, and update table status
    const order = await withDbRetry(async () => {
      return prisma.$transaction(async (tx) => {
        // 1. Batched ingredient stock deduction based on Recipe/BOM
        const menuItemIds = orderItemsToCreate.map((item) => item.menuItemId);
        const recipeIngredients = await tx.menuItemIngredient.findMany({
          where: { menuItemId: { in: menuItemIds } },
        });

        // Aggregate required deductions per ingredientId
        const ingredientDeductions: Record<string, number> = {};
        for (const item of orderItemsToCreate) {
          const itemRecipes = recipeIngredients.filter((r) => r.menuItemId === item.menuItemId);
          for (const recipe of itemRecipes) {
            const qtyToDeduct = recipe.quantityUsed * item.quantity;
            ingredientDeductions[recipe.ingredientId] = (ingredientDeductions[recipe.ingredientId] || 0) + qtyToDeduct;
          }
        }

        // Concurrently dispatch ingredient inventory updates
        const updatePromises = Object.entries(ingredientDeductions).map(async ([ingredientId, qtyToDeduct]) => {
          const updatedIngredient = await tx.inventoryItem.update({
            where: { id: ingredientId },
            data: {
              quantity: {
                decrement: qtyToDeduct,
              },
            },
          });

          // Check if below minStock and alert staff
          if (updatedIngredient.quantity < updatedIngredient.minStock) {
            notifyStaff(restaurantId, 'inventory:low_stock', {
              id: updatedIngredient.id,
              name: updatedIngredient.name,
              quantity: updatedIngredient.quantity,
              minStock: updatedIngredient.minStock,
              unit: updatedIngredient.unit,
            });
          }
        });

        await Promise.all(updatePromises);

        // 2. Create the order
        const dbOrder = await tx.order.create({
          data: {
            shortId,
            status: OrderStatus.PENDING,
            tableId,
            restaurantId,
            totalAmount: subTotal,
            taxAmount,
            grandTotal,
            notes,
            sessionId: activeSessionId,
            items: {
              create: orderItemsToCreate,
            },
          },
          include: {
            table: true,
            items: {
              include: {
                menuItem: true,
              },
            },
          },
        });

        // 3. Mark Table status as OCCUPIED
        await tx.table.update({
          where: { id: tableId },
          data: { status: TableStatus.OCCUPIED },
        });

        return dbOrder;
      });
    });

    // Write activity log
    await prisma.activityLog.create({
      data: {
        action: 'New Order',
        details: `Table ${table.number} placed order ${shortId} for ₹${grandTotal}`,
        restaurantId,
      },
    });

    // Notify Staff Dashboard in Real-time
    notifyStaff(restaurantId, 'order:new', order);

    // Notify other staff about table status change
    notifyStaff(restaurantId, 'table:update', {
      action: 'update',
      table: { ...order.table, status: TableStatus.OCCUPIED },
    });

    return res.status(201).json({ order });
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ error: 'Server error placing order' });
  }
};

// PUBLIC: Customer tracks their order details and preparation state
export const getCustomerOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        restaurant: {
          select: { name: true, taxRate: true, serviceCharge: true },
        },
        items: {
          include: { menuItem: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({ order });
  } catch (error) {
    return res.status(500).json({ error: 'Server error fetching order details' });
  }
};

// STAFF: Get orders queue
export const getOrders = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  const { status } = req.query;

  try {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: status ? (status as OrderStatus) : undefined,
      },
      include: {
        table: true,
        items: {
          include: { menuItem: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing orders' });
  }
};

// STAFF: Update order status (ACCEPTED, PREPARING, COOKING, PACKING, READY, DELIVERED, CANCELLED)
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: { table: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousStatus = order.status;
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: status as OrderStatus },
      include: {
        table: true,
        items: {
          include: { menuItem: true },
        },
      },
    });

    // Auto-update table status dynamically based on order states
    let tableStatusUpdate = null;
    if (status === OrderStatus.READY) {
      // Order is ready! Table goes to Occupied but is preparing to billing
      tableStatusUpdate = TableStatus.OCCUPIED;
    } else if (status === OrderStatus.DELIVERED) {
      tableStatusUpdate = TableStatus.OCCUPIED;
    } else if (status === OrderStatus.CANCELLED) {
      // Check if there are other active occupied orders for this table.
      const otherOrdersCount = await prisma.order.count({
        where: {
          tableId: order.tableId,
          restaurantId,
          status: { in: [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.COOKING, OrderStatus.PACKING, OrderStatus.READY] },
          id: { not: id },
        },
      });
      if (otherOrdersCount === 0) {
        tableStatusUpdate = TableStatus.AVAILABLE;
      }
    }

    if (tableStatusUpdate) {
      const updatedTable = await prisma.table.update({
        where: { id: order.tableId },
        data: { status: tableStatusUpdate },
      });
      // Notify staff about table status change
      notifyStaff(restaurantId, 'table:update', { action: 'update', table: updatedTable });
    }

    // Write Activity Log
    await prisma.activityLog.create({
      data: {
        action: 'Order Updated',
        details: `Order ${order.shortId} status changed from ${previousStatus} to ${status}`,
        restaurantId,
      },
    });

    // Real-time notifications:
    // 1. Notify the specific Customer tracking screen
    notifyOrderUpdate(id, 'order:status_change', { status });

    // 2. Notify other staff dashboard instances
    notifyStaff(restaurantId, 'order:update', updatedOrder);

    return res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ error: 'Server error updating order status' });
  }
};
