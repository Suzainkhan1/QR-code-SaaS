import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// STAFF: Get all inventory items
export const getInventory = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    });
    return res.json({ inventory: items });
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing inventory items' });
  }
};

// STAFF: Add raw material ingredient
export const addIngredient = async (req: AuthenticatedRequest, res: Response) => {
  const { name, quantity, unit, minStock } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!name || quantity === undefined || !unit) {
    return res.status(400).json({ error: 'Name, quantity and unit are required' });
  }

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        restaurantId,
        name: { equals: name },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Ingredient with this name already exists' });
    }

    const newItem = await prisma.inventoryItem.create({
      data: {
        name,
        quantity: parseFloat(quantity),
        unit,
        minStock: minStock ? parseFloat(minStock) : 5.0,
        restaurantId,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Inventory Added',
        details: `Added raw material: ${name} (${quantity} ${unit})`,
        restaurantId,
      },
    });

    return res.status(201).json({ item: newItem });
  } catch (error) {
    return res.status(500).json({ error: 'Server error adding raw material' });
  }
};

// STAFF: Update stock levels or details
export const updateIngredient = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, quantity, unit, minStock } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, restaurantId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
        unit,
        minStock: minStock !== undefined ? parseFloat(minStock) : undefined,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Inventory Updated',
        details: `Adjusted stock for ${item.name} from ${item.quantity} to ${quantity ?? item.quantity}`,
        restaurantId,
      },
    });

    return res.json({ item: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error updating stock level' });
  }
};

// STAFF: Delete inventory item
export const deleteIngredient = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, restaurantId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    await prisma.inventoryItem.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        action: 'Inventory Deleted',
        details: `Removed raw material: ${item.name}`,
        restaurantId,
      },
    });

    return res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error deleting inventory item' });
  }
};
