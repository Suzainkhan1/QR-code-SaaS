import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { TableStatus, PaymentMethod } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { notifyStaff } from '../socket';

// STAFF: Get active, unpaid orders summary for a table
export const getTableBillSummary = async (req: AuthenticatedRequest, res: Response) => {
  const { tableId } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Find active session for this table
    const activeSession = await prisma.tableSession.findFirst({
      where: { tableId, isActive: true, restaurantId },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            items: { include: { menuItem: true } },
          },
        },
      },
    });

    if (!activeSession) {
      // Check if there is an existing unpaid bill
      const existingUnpaidBill = await prisma.bill.findFirst({
        where: {
          restaurantId,
          isPaid: false,
          session: { tableId },
        },
        include: {
          orders: {
            include: {
              items: { include: { menuItem: true } },
            },
          },
        },
      });

      if (existingUnpaidBill) {
        return res.json({
          bill: existingUnpaidBill,
          orders: existingUnpaidBill.orders,
          subTotal: existingUnpaidBill.subTotal,
          tax: existingUnpaidBill.tax,
          discount: existingUnpaidBill.discount,
          grandTotal: existingUnpaidBill.grandTotal,
        });
      }

      return res.json({ orders: [], message: 'No active unpaid items found for this table' });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    // Sum details from the active session orders
    let subTotal = 0;
    const itemsList: any[] = [];

    activeSession.orders.forEach((order) => {
      order.items.forEach((item) => {
        subTotal += item.price * item.quantity;
        itemsList.push({
          id: item.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          price: item.price,
          customs: item.customs ? JSON.parse(item.customs) : null,
        });
      });
    });

    const tax = Math.round(subTotal * ((restaurant?.taxRate || 5.0) / 100) * 100) / 100;
    const grandTotal = subTotal + tax;

    return res.json({
      orders: activeSession.orders,
      items: itemsList,
      subTotal,
      tax,
      grandTotal,
      taxRate: restaurant?.taxRate || 5.0,
      sessionId: activeSession.id,
    });
  } catch (error) {
    console.error('Bill summary error:', error);
    return res.status(500).json({ error: 'Server error compiling table bill' });
  }
};

// STAFF: Generate Bill (Checkout)
export const checkoutTable = async (req: AuthenticatedRequest, res: Response) => {
  const { tableId, discount } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!tableId) return res.status(400).json({ error: 'Table ID is required' });

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Find active session with active orders
    const activeSession = await prisma.tableSession.findFirst({
      where: { tableId, isActive: true, restaurantId },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
    });

    if (!activeSession || activeSession.orders.length === 0) {
      return res.status(400).json({ error: 'No active session or orders found to check out' });
    }

    const subTotal = activeSession.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const tax = Math.round(subTotal * (restaurant.taxRate / 100) * 100) / 100;
    const discountAmt = Math.min(discount ? parseFloat(discount) : 0.0, subTotal);
    const grandTotal = Math.max(0, subTotal + tax - discountAmt);

    const checkoutResult = await prisma.$transaction(async (tx) => {
      // 1. Generate unique invoice number
      const billCount = await tx.bill.count({ where: { restaurantId } });
      const invoiceNo = `INV-${(5001 + billCount).toString()}`;

      // 2. Create the Bill
      const bill = await tx.bill.create({
        data: {
          invoiceNo,
          restaurantId,
          subTotal,
          tax,
          discount: discountAmt,
          grandTotal,
          sessionId: activeSession.id,
          paymentMethod: 'CASH',
          isPaid: false,
        },
      });

      // 3. Link all orders in session to this Bill
      await tx.order.updateMany({
        where: { sessionId: activeSession.id },
        data: { billId: bill.id },
      });

      // 4. Set Table status to BILLING
      const updatedTable = await tx.table.update({
        where: { id: tableId },
        data: { status: TableStatus.BILLING },
      });

      return { bill, table: updatedTable };
    });

    await prisma.activityLog.create({
      data: {
        action: 'Bill Generated',
        details: `Invoice ${checkoutResult.bill.invoiceNo} generated for Table`,
        restaurantId,
      },
    });

    notifyStaff(restaurantId, 'table:update', { action: 'update', table: checkoutResult.table });
    notifyStaff(restaurantId, 'billing:update', { action: 'checkout', bill: checkoutResult.bill });

    return res.status(201).json(checkoutResult);
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Server error during checkout' });
  }
};

// STAFF: Mark Bill as Paid
export const payBill = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { paymentMethod } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!paymentMethod) return res.status(400).json({ error: 'Payment method is required' });

  try {
    const bill = await prisma.bill.findFirst({
      where: { id, restaurantId },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill invoice not found' });
    }

    if (bill.isPaid) {
      return res.status(400).json({ error: 'This invoice has already been paid' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark Bill as paid
      const updatedBill = await tx.bill.update({
        where: { id },
        data: {
          isPaid: true,
          paymentMethod: paymentMethod as PaymentMethod,
          paidAt: new Date(),
        },
      });

      // 2. Mark all orders in the TableSession as DELIVERED
      if (bill.sessionId) {
        await tx.order.updateMany({
          where: { sessionId: bill.sessionId },
          data: { status: 'DELIVERED' },
        });

        // 3. Deactivate the TableSession
        await tx.tableSession.update({
          where: { id: bill.sessionId },
          data: { isActive: false },
        });
      }

      // 4. Mark Table as AVAILABLE (since bill is settled)
      const session = await tx.tableSession.findUnique({
        where: { id: bill.sessionId || '' },
      });

      let updatedTable = null;
      if (session) {
        updatedTable = await tx.table.update({
          where: { id: session.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      await tx.activityLog.create({
        data: {
          action: 'Bill Settled',
          details: `Invoice ${bill.invoiceNo} paid via ${paymentMethod}`,
          restaurantId,
        },
      });

      return { bill: updatedBill, table: updatedTable };
    });

    if (result.table) {
      notifyStaff(restaurantId, 'table:update', { action: 'update', table: result.table });
    }
    notifyStaff(restaurantId, 'billing:update', { action: 'pay', bill: result.bill });

    return res.json({ message: 'Invoice paid and table settled successfully', ...result });
  } catch (error) {
    console.error('Settle bill error:', error);
    return res.status(500).json({ error: 'Server error settling bill' });
  }
};
