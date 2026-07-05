import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// PUBLIC: Get entire menu for the single café
export const getMenuBySlug = async (req: Request, res: Response) => {
  try {
    const restaurant = await prisma.restaurant.findFirst({
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    return res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        logo: restaurant.logo,
        taxRate: restaurant.taxRate,
        serviceCharge: restaurant.serviceCharge,
      },
      categories: restaurant.categories,
    });
  } catch (error) {
    console.error('Fetch public menu error:', error);
    return res.status(500).json({ error: 'Server error fetching menu details' });
  }
};

// STAFF: Get categories
export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: { items: true },
    });
    return res.json({ categories });
  } catch (error) {
    return res.status(500).json({ error: 'Server error fetching categories' });
  }
};

// STAFF: Add category
export const addCategory = async (req: AuthenticatedRequest, res: Response) => {
  const { name, description } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    const existing = await prisma.menuCategory.findFirst({
      where: { restaurantId, name: { equals: name } },
    });
    if (existing) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    const count = await prisma.menuCategory.count({ where: { restaurantId } });

    const newCategory = await prisma.menuCategory.create({
      data: {
        name,
        description,
        sortOrder: count,
        restaurantId,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Category Added',
        details: `Created menu category: ${name}`,
        restaurantId,
      },
    });

    return res.status(201).json({ category: newCategory });
  } catch (error) {
    return res.status(500).json({ error: 'Server error adding category' });
  }
};

// STAFF: Edit category
export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = await prisma.menuCategory.update({
      where: { id },
      data: { name, description },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Category Updated',
        details: `Updated category from ${category.name} to ${name || category.name}`,
        restaurantId,
      },
    });

    return res.json({ category: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error updating category' });
  }
};

// STAFF: Delete category
export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await prisma.menuCategory.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        action: 'Category Deleted',
        details: `Deleted menu category: ${category.name}`,
        restaurantId,
      },
    });

    return res.json({ message: 'Category and all associated items deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error deleting category' });
  }
};

// STAFF: Add Menu Item
export const addItem = async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, price, prepTime, isAvailable, isVeg, isBestseller, isChefSpecial, categoryId, image } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!name || price === undefined || !categoryId) {
    return res.status(400).json({ error: 'Name, price and category are required' });
  }

  try {
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });
    if (!category) {
      return res.status(404).json({ error: 'Target menu category does not exist' });
    }

    const newItem = await prisma.menuItem.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        prepTime: prepTime ? parseInt(prepTime) : 15,
        isAvailable: isAvailable ?? true,
        isVeg: isVeg ?? true,
        isBestseller: isBestseller ?? false,
        isChefSpecial: isChefSpecial ?? false,
        image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        categoryId,
        restaurantId,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Product Created',
        details: `Created menu item: ${name} under ${category.name}`,
        restaurantId,
      },
    });

    return res.status(201).json({ item: newItem });
  } catch (error) {
    console.error('Add item error:', error);
    return res.status(500).json({ error: 'Server error adding menu item' });
  }
};

// STAFF: Edit Menu Item
export const updateItem = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, price, prepTime, isAvailable, isVeg, isBestseller, isChefSpecial, categoryId, image } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: { id: categoryId, restaurantId },
      });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        name,
        description,
        price: price !== undefined ? parseFloat(price) : undefined,
        prepTime: prepTime !== undefined ? parseInt(prepTime) : undefined,
        isAvailable: isAvailable !== undefined ? isAvailable : undefined,
        isVeg: isVeg !== undefined ? isVeg : undefined,
        isBestseller: isBestseller !== undefined ? isBestseller : undefined,
        isChefSpecial: isChefSpecial !== undefined ? isChefSpecial : undefined,
        image,
        categoryId,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Product Updated',
        details: `Updated details for menu item: ${item.name}`,
        restaurantId,
      },
    });

    return res.json({ item: updated });
  } catch (error) {
    console.error('Update item error:', error);
    return res.status(500).json({ error: 'Server error updating menu item' });
  }
};

// STAFF: Delete Menu Item
export const deleteItem = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    await prisma.menuItem.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        action: 'Product Deleted',
        details: `Deleted menu item: ${item.name}`,
        restaurantId,
      },
    });

    return res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error deleting menu item' });
  }
};
