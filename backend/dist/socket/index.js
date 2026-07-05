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
exports.notifyOrderUpdate = exports.notifyStaff = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const jwt = __importStar(require("jsonwebtoken"));
let io = null;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*', // Allow all origins for dev simplicity
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
        },
    });
    // Handshake authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
        if (!token) {
            return next(new Error('Authentication token is required'));
        }
        const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
        try {
            const secret = process.env.JWT_SECRET;
            const decoded = jwt.verify(cleanToken, secret);
            socket.data = {
                userId: decoded.id,
                restaurantId: decoded.restaurantId,
                role: decoded.role,
                tableId: decoded.tableId,
                sessionId: decoded.sessionId,
            };
            next();
        }
        catch (err) {
            return next(new Error('Authentication failed: invalid or expired token'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`[Socket] Connection established: ${socket.id} (Role: ${socket.data.role})`);
        // Staff joins their restaurant control room
        socket.on('join_restaurant_staff', (restaurantId) => {
            const verifiedRestaurantId = socket.data.restaurantId;
            const verifiedRole = socket.data.role;
            // Allow room subscription only if the user is verified staff
            if (verifiedRole && ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'ADMIN'].includes(verifiedRole)) {
                socket.join(`restaurant_${verifiedRestaurantId}_staff`);
                console.log(`[Socket] Verified Staff ${socket.id} joined restaurant_${verifiedRestaurantId}_staff`);
            }
            else {
                console.warn(`[Socket Security Warning] Unauthorized subscription attempt by socket ${socket.id}`);
            }
        });
        // Customer joins a room to track their specific order
        socket.on('join_order', (orderId) => {
            socket.join(`order_${orderId}`);
            console.log(`[Socket] Customer ${socket.id} joined order_${orderId}`);
        });
        socket.on('disconnect', () => {
            console.log(`[Socket] Connection closed: ${socket.id}`);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized!');
    }
    return io;
};
exports.getIO = getIO;
// Real-time helper utilities
const notifyStaff = (restaurantId, eventName, data) => {
    try {
        const ioInstance = (0, exports.getIO)();
        ioInstance.to(`restaurant_${restaurantId}_staff`).emit(eventName, data);
        console.log(`[Socket] Emitted ${eventName} to restaurant_${restaurantId}_staff`);
    }
    catch (error) {
        console.warn(`[Socket Warning] Failed to notify staff:`, error);
    }
};
exports.notifyStaff = notifyStaff;
const notifyOrderUpdate = (orderId, eventName, data) => {
    try {
        const ioInstance = (0, exports.getIO)();
        ioInstance.to(`order_${orderId}`).emit(eventName, data);
        console.log(`[Socket] Emitted ${eventName} to order_${orderId}`);
    }
    catch (error) {
        console.warn(`[Socket Warning] Failed to notify order:`, error);
    }
};
exports.notifyOrderUpdate = notifyOrderUpdate;
