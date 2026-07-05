"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequest = exports.getRequests = exports.createRequest = void 0;
const db_1 = require("../config/db");
const enums_1 = require("../types/enums");
const socket_1 = require("../socket");
// PUBLIC: Customer requests assistance
const createRequest = async (req, res) => {
    const { tableId, type } = req.body;
    if (!tableId || !type) {
        return res.status(400).json({ error: 'Table ID and request type are required' });
    }
    try {
        const table = await db_1.prisma.table.findUnique({
            where: { id: tableId },
            include: { restaurant: true },
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        const newRequest = await db_1.prisma.staffRequest.create({
            data: {
                tableId,
                type: type,
                status: enums_1.RequestStatus.PENDING,
            },
            include: {
                table: true,
            },
        });
        // Notify staff dashboard in real-time
        (0, socket_1.notifyStaff)(table.restaurantId, 'request:new', newRequest);
        // Create activity log
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Waiter Requested',
                details: `Table ${table.number} requested: ${type}`,
                restaurantId: table.restaurantId,
            },
        });
        return res.status(201).json({ request: newRequest });
    }
    catch (error) {
        console.error('Request creation error:', error);
        return res.status(500).json({ error: 'Server error creating service request' });
    }
};
exports.createRequest = createRequest;
// STAFF: Get all active requests
const getRequests = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const requests = await db_1.prisma.staffRequest.findMany({
            where: {
                table: { restaurantId },
                status: enums_1.RequestStatus.PENDING,
            },
            include: {
                table: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ requests });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing service requests' });
    }
};
exports.getRequests = getRequests;
// STAFF: Resolve request
const resolveRequest = async (req, res) => {
    const { id } = req.params;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const request = await db_1.prisma.staffRequest.findFirst({
            where: {
                id,
                table: { restaurantId },
            },
            include: { table: true },
        });
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        const updated = await db_1.prisma.staffRequest.update({
            where: { id },
            data: { status: enums_1.RequestStatus.RESOLVED },
        });
        // Notify other staff dashboards to dismiss request
        (0, socket_1.notifyStaff)(restaurantId, 'request:resolve', { id });
        return res.json({ message: 'Request marked as resolved', request: updated });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error resolving request' });
    }
};
exports.resolveRequest = resolveRequest;
