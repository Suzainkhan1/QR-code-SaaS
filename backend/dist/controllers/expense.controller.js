"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpense = exports.addExpense = exports.getExpenses = void 0;
const db_1 = require("../config/db");
// STAFF: Get all expenses
const getExpenses = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const expenses = await db_1.prisma.expense.findMany({
            where: { restaurantId },
            orderBy: { date: 'desc' },
        });
        return res.json({ expenses });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing expenses' });
    }
};
exports.getExpenses = getExpenses;
// STAFF: Add a new expense record
const addExpense = async (req, res) => {
    const { category, amount, description, date } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!category || amount === undefined) {
        return res.status(400).json({ error: 'Category and amount are required' });
    }
    try {
        const newExpense = await db_1.prisma.expense.create({
            data: {
                category,
                amount: parseFloat(amount),
                description,
                date: date ? new Date(date) : new Date(),
                restaurantId,
            },
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Expense Added',
                details: `Logged expense of ₹${amount} for ${category}`,
                restaurantId,
            },
        });
        return res.status(201).json({ expense: newExpense });
    }
    catch (error) {
        console.error('Add expense error:', error);
        return res.status(500).json({ error: 'Server error logging expense' });
    }
};
exports.addExpense = addExpense;
// STAFF: Delete expense
const deleteExpense = async (req, res) => {
    const { id } = req.params;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const expense = await db_1.prisma.expense.findFirst({
            where: { id, restaurantId },
        });
        if (!expense) {
            return res.status(404).json({ error: 'Expense record not found' });
        }
        await db_1.prisma.expense.delete({ where: { id } });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Expense Deleted',
                details: `Deleted expense record for ${expense.category} (₹${expense.amount})`,
                restaurantId,
            },
        });
        return res.json({ message: 'Expense record deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error deleting expense record' });
    }
};
exports.deleteExpense = deleteExpense;
