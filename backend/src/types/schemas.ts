import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID format'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  price: z.number().nonnegative('Price cannot be negative'),
  customs: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const placeOrderSchema = z.object({
  tableId: z.string().uuid('Invalid table ID format'),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  notes: z.string().optional().nullable(),
});

export const staffRequestSchema = z.object({
  tableId: z.string().uuid('Invalid table ID format'),
  type: z.enum(['WATER', 'SPOON', 'TISSUE', 'BILL', 'CLEANING', 'CALL_WAITER']),
});

export const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional().nullable(),
});

export const menuItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  price: z.number().positive('Price must be greater than zero'),
  categoryId: z.string().uuid('Invalid category ID'),
  prepTime: z.number().int().nonnegative('Preparation time cannot be negative'),
  isVeg: z.boolean().default(true),
  isBestseller: z.boolean().default(false),
  isChefSpecial: z.boolean().default(false),
  image: z.string().url('Invalid image URL format').optional().nullable().or(z.literal('')),
  description: z.string().optional().nullable(),
});

export const inventoryItemSchema = z.object({
  name: z.string().min(2, 'Ingredient name must be at least 2 characters'),
  quantity: z.number().nonnegative('Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit descriptor is required'),
  minStock: z.number().nonnegative('Minimum stock threshold cannot be negative'),
});

export const expenseSchema = z.object({
  category: z.string().min(2, 'Expense category is required'),
  amount: z.number().positive('Expense amount must be greater than zero'),
  description: z.string().optional().nullable(),
});

export const checkoutSchema = z.object({
  tableId: z.string().uuid('Invalid table ID'),
  discount: z.number().nonnegative('Discount cannot be negative').default(0),
});
