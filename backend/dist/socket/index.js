"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrderUpdate = exports.notifyStaff = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io = null;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*', // Allow all origins for dev simplicity
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
        },
    });
    io.on('connection', (socket) => {
        console.log(`[Socket] Connection established: ${socket.id}`);
        // Staff joins their restaurant control room
        socket.on('join_restaurant_staff', (restaurantId) => {
            socket.join(`restaurant_${restaurantId}_staff`);
            console.log(`[Socket] Staff ${socket.id} joined restaurant_${restaurantId}_staff`);
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
