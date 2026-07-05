"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTable = exports.updateTableStatus = exports.addTable = exports.getTables = exports.verifyTableToken = exports.verifyTable = void 0;
const db_1 = require("../config/db");
const enums_1 = require("../types/enums");
const socket_1 = require("../socket");
const jwt = __importStar(require("jsonwebtoken"));
// PUBLIC: Verify Table by Table Number (for the single café)
const verifyTable = async (req, res) => {
    const { number } = req.params;
    try {
        const restaurant = await db_1.prisma.restaurant.findFirst();
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }
        const table = await db_1.prisma.table.findUnique({
            where: {
                restaurantId_number: {
                    restaurantId: restaurant.id,
                    number,
                },
            },
        });
        if (!table) {
            return res.status(404).json({ error: `Table ${number} does not exist at this restaurant` });
        }
        return res.json({
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                slug: restaurant.slug,
            },
            table: {
                id: table.id,
                number: table.number,
                status: table.status,
                capacity: table.capacity,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error verifying table' });
    }
};
exports.verifyTable = verifyTable;
// PUBLIC: Verify Signed QR Token and Issue Customer Session JWT
const verifyTableToken = async (req, res) => {
    const { number, token } = req.body;
    if (!number || !token) {
        return res.status(400).json({ error: 'Table number and QR token are required' });
    }
    try {
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        if (decoded.number !== number || decoded.type !== 'qr') {
            return res.status(403).json({ error: 'Invalid or tampered QR code token' });
        }
        const restaurant = await db_1.prisma.restaurant.findFirst();
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant setup not found' });
        }
        const table = await db_1.prisma.table.findUnique({
            where: {
                restaurantId_number: {
                    restaurantId: restaurant.id,
                    number,
                },
            },
        });
        if (!table) {
            return res.status(404).json({ error: `Table ${number} does not exist` });
        }
        // Find or create active TableSession
        let session = await db_1.prisma.tableSession.findFirst({
            where: {
                tableId: table.id,
                isActive: true,
            },
        });
        let customerToken = '';
        if (session) {
            customerToken = session.token || '';
        }
        if (!session || !customerToken) {
            session = await db_1.prisma.tableSession.create({
                data: {
                    tableId: table.id,
                    restaurantId: restaurant.id,
                    isActive: true,
                    token: '',
                },
            });
            customerToken = jwt.sign({
                role: 'CUSTOMER',
                tableId: table.id,
                tableNumber: table.number,
                restaurantId: restaurant.id,
                sessionId: session.id,
            }, secret, { expiresIn: '6h' });
            await db_1.prisma.tableSession.update({
                where: { id: session.id },
                data: { token: customerToken },
            });
            await db_1.prisma.table.update({
                where: { id: table.id },
                data: { status: 'OCCUPIED' },
            });
            (0, socket_1.notifyStaff)(restaurant.id, 'table:update', { action: 'update', table: { ...table, status: 'OCCUPIED' } });
        }
        return res.json({
            token: customerToken,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                slug: restaurant.slug,
                taxRate: restaurant.taxRate,
            },
            table: {
                id: table.id,
                number: table.number,
                status: table.status,
            },
            sessionId: session.id,
        });
    }
    catch (error) {
        console.error('Table session verification error:', error);
        return res.status(403).json({ error: 'QR verification failed or code has expired' });
    }
};
exports.verifyTableToken = verifyTableToken;
// STAFF: Get all tables
const getTables = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized context' });
    try {
        const tables = await db_1.prisma.table.findMany({
            where: { restaurantId },
            orderBy: { number: 'asc' },
        });
        // Add QR code metadata URLs for printing
        const secret = process.env.JWT_SECRET;
        const tablesWithQR = tables.map((t) => {
            const qrToken = jwt.sign({ number: t.number, type: 'qr' }, secret);
            const customerURL = `http://localhost:5173/table/${t.number}?token=${qrToken}`;
            const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(customerURL)}`;
            return {
                ...t,
                customerURL,
                qrURL,
            };
        });
        return res.json({ tables: tablesWithQR });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing tables' });
    }
};
exports.getTables = getTables;
// STAFF: Add new table
const addTable = async (req, res) => {
    const { number, capacity } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!number)
        return res.status(400).json({ error: 'Table number is required' });
    try {
        const existing = await db_1.prisma.table.findUnique({
            where: {
                restaurantId_number: {
                    restaurantId,
                    number,
                },
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'Table number already exists' });
        }
        const newTable = await db_1.prisma.table.create({
            data: {
                number,
                capacity: capacity ? parseInt(capacity) : 4,
                status: enums_1.TableStatus.AVAILABLE,
                restaurantId,
            },
        });
        // Generate QR
        const customerURL = `http://localhost:5173/r/${req.user?.restaurantId}/table/${newTable.number}`;
        const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(customerURL)}`;
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Table Created',
                details: `Created table ${number}`,
                restaurantId,
            },
        });
        // Emit live table updates to staff
        (0, socket_1.notifyStaff)(restaurantId, 'table:update', { action: 'create', table: { ...newTable, qrURL } });
        return res.status(201).json({ table: { ...newTable, qrURL } });
    }
    catch (error) {
        console.error('Add table error:', error);
        return res.status(500).json({ error: 'Server error adding table' });
    }
};
exports.addTable = addTable;
// STAFF: Update table status
const updateTableStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!status)
        return res.status(400).json({ error: 'Status is required' });
    try {
        const table = await db_1.prisma.table.findFirst({
            where: { id, restaurantId },
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        const updated = await db_1.prisma.table.update({
            where: { id },
            data: { status: status },
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Table Updated',
                details: `Table ${table.number} marked as ${status}`,
                restaurantId,
            },
        });
        // Emit table updates
        (0, socket_1.notifyStaff)(restaurantId, 'table:update', { action: 'update', table: updated });
        return res.json({ table: updated });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error updating table status' });
    }
};
exports.updateTableStatus = updateTableStatus;
// STAFF: Delete table
const deleteTable = async (req, res) => {
    const { id } = req.params;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const table = await db_1.prisma.table.findFirst({
            where: { id, restaurantId },
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        await db_1.prisma.table.delete({ where: { id } });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Table Deleted',
                details: `Deleted table ${table.number}`,
                restaurantId,
            },
        });
        // Emit table updates
        (0, socket_1.notifyStaff)(restaurantId, 'table:update', { action: 'delete', tableId: id });
        return res.json({ message: 'Table deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error deleting table' });
    }
};
exports.deleteTable = deleteTable;
