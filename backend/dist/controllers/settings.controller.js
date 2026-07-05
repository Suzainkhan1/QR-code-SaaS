"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = void 0;
const db_1 = require("../config/db");
const getSettings = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const restaurant = await db_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        return res.json({ settings: restaurant });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error fetching settings' });
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    const { name, phone, email, address, taxRate, serviceCharge, logo } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const updated = await db_1.prisma.restaurant.update({
            where: { id: restaurantId },
            data: {
                name,
                phone,
                email,
                address,
                taxRate: taxRate !== undefined ? parseFloat(taxRate) : undefined,
                serviceCharge: serviceCharge !== undefined ? parseFloat(serviceCharge) : undefined,
                logo,
            },
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Settings Updated',
                details: 'Restaurant configuration details adjusted',
                restaurantId,
            },
        });
        return res.json({ settings: updated });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error updating restaurant configuration' });
    }
};
exports.updateSettings = updateSettings;
