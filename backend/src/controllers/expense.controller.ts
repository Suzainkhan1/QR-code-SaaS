import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// STAFF: Get all expenses
export const getExpenses = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const expenses = await prisma.expense.findMany({
      where: { restaurantId },
      orderBy: { date: 'desc' },
    });
    return res.json({ expenses });
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing expenses' });
  }
};

// STAFF: Add a new expense record
export const addExpense = async (req: AuthenticatedRequest, res: Response) => {
  const { category, amount, description, date } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!category || amount === undefined) {
    return res.status(400).json({ error: 'Category and amount are required' });
  }

  try {
    const newExpense = await prisma.expense.create({
      data: {
        category,
        amount: parseFloat(amount),
        description,
        date: date ? new Date(date) : new Date(),
        restaurantId,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Expense Added',
        details: `Logged expense of ₹${amount} for ${category}`,
        restaurantId,
      },
    });

    return res.status(201).json({ expense: newExpense });
  } catch (error) {
    console.error('Add expense error:', error);
    return res.status(500).json({ error: 'Server error logging expense' });
  }
};

// STAFF: Delete expense
export const deleteExpense = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const expense = await prisma.expense.findFirst({
      where: { id, restaurantId },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense record not found' });
    }

    await prisma.expense.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        action: 'Expense Deleted',
        details: `Deleted expense record for ${expense.category} (₹${expense.amount})`,
        restaurantId,
      },
    });

    return res.json({ message: 'Expense record deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error deleting expense record' });
  }
};
