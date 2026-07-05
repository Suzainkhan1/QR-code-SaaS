import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import * as jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

export const initSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
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
      const secret = process.env.JWT_SECRET!;
      const decoded = jwt.verify(cleanToken, secret) as any;
      socket.data = {
        userId: decoded.id,
        restaurantId: decoded.restaurantId,
        role: decoded.role,
        tableId: decoded.tableId,
        sessionId: decoded.sessionId,
      };
      next();
    } catch (err) {
      return next(new Error('Authentication failed: invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connection established: ${socket.id} (Role: ${socket.data.role})`);

    // Staff joins their restaurant control room
    socket.on('join_restaurant_staff', (restaurantId: string) => {
      const verifiedRestaurantId = socket.data.restaurantId;
      const verifiedRole = socket.data.role;

      // Allow room subscription only if the user is verified staff
      if (verifiedRole && ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'ADMIN'].includes(verifiedRole)) {
        socket.join(`restaurant_${verifiedRestaurantId}_staff`);
        console.log(`[Socket] Verified Staff ${socket.id} joined restaurant_${verifiedRestaurantId}_staff`);
      } else {
        console.warn(`[Socket Security Warning] Unauthorized subscription attempt by socket ${socket.id}`);
      }
    });

    // Customer joins a room to track their specific order
    socket.on('join_order', (orderId: string) => {
      socket.join(`order_${orderId}`);
      console.log(`[Socket] Customer ${socket.id} joined order_${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Connection closed: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};

// Real-time helper utilities
export const notifyStaff = (restaurantId: string, eventName: string, data: any) => {
  try {
    const ioInstance = getIO();
    ioInstance.to(`restaurant_${restaurantId}_staff`).emit(eventName, data);
    console.log(`[Socket] Emitted ${eventName} to restaurant_${restaurantId}_staff`);
  } catch (error) {
    console.warn(`[Socket Warning] Failed to notify staff:`, error);
  }
};

export const notifyOrderUpdate = (orderId: string, eventName: string, data: any) => {
  try {
    const ioInstance = getIO();
    ioInstance.to(`order_${orderId}`).emit(eventName, data);
    console.log(`[Socket] Emitted ${eventName} to order_${orderId}`);
  } catch (error) {
    console.warn(`[Socket Warning] Failed to notify order:`, error);
  }
};
