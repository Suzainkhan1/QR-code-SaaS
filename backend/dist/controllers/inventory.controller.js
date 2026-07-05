"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteIngredient = exports.updateIngredient = exports.addIngredient = exports.getInventory = void 0;
const db_1 = require("../config/db");
// STAFF: Get all inventory items
const getInventory = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const items = await db_1.prisma.inventoryItem.findMany({
            where: { restaurantId },
            orderBy: { name: 'asc' },
        });
        return res.json({ inventory: items });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing inventory items' });
    }
};
exports.getInventory = getInventory;
// STAFF: Add raw material ingredient
const addIngredient = async (req, res) => {
    const { name, quantity, unit, minStock } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!name || quantity === undefined || !unit) {
        return res.status(400).json({ error: 'Name, quantity and unit are required' });
    }
    try {
        const existing = await db_1.prisma.inventoryItem.findFirst({
            where: {
                restaurantId,
                name: { equals: name },
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'Ingredient with this name already exists' });
        }
        const newItem = await db_1.prisma.inventoryItem.create({
            data: {
                name,
                quantity: parseFloat(quantity),
                unit,
                minStock: minStock ? parseFloat(minStock) : 5.0,
                restaurantId,
            },
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Inventory Added',
                details: `Added raw material: ${name} (${quantity} ${unit})`,
                restaurantId,
            },
        });
        return res.status(201).json({ item: newItem });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error adding raw material' });
    }
};
exports.addIngredient = addIngredient;
// STAFF: Update stock levels or details
const updateIngredient = async (req, res) => {
    const { id } = req.params;
    const { name, quantity, unit, minStock } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const item = await db_1.prisma.inventoryItem.findFirst({
            where: { id, restaurantId },
        });
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        const updated = await db_1.prisma.inventoryItem.update({
            where: { id },
            data: {
                name,
                quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
                unit,
                minStock: minStock !== undefined ? parseFloat(minStock) : undefined,
            },
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Inventory Updated',
                details: `Adjusted stock for ${item.name} from ${item.quantity} to ${quantity ?? item.quantity}`,
                restaurantId,
            },
        });
        return res.json({ item: updated });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error updating stock level' });
    }
};
exports.updateIngredient = updateIngredient;
// STAFF: Delete inventory item
const deleteIngredient = async (req, res) => {
    const { id } = req.params;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const item = await db_1.prisma.inventoryItem.findFirst({
            where: { id, restaurantId },
        });
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        await db_1.prisma.inventoryItem.delete({ where: { id } });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Inventory Deleted',
                details: `Removed raw material: ${item.name}`,
                restaurantId,
            },
        });
        return res.json({ message: 'Inventory item deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error deleting inventory item' });
    }
};
exports.deleteIngredient = deleteIngredient;
