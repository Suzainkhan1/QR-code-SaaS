"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityLogs = void 0;
const db_1 = require("../config/db");
const getActivityLogs = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const logs = await db_1.prisma.activityLog.findMany({
            where: { restaurantId },
            orderBy: { createdAt: 'desc' },
            take: 100, // Limit to recent 100 entries for performance
        });
        return res.json({ logs });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing operational activity logs' });
    }
};
exports.getActivityLogs = getActivityLogs;
