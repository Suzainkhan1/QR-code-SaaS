import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allow all origins for dev simplicity
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connection established: ${socket.id}`);

    // Staff joins their restaurant control room
    socket.on('join_restaurant_staff', (restaurantId: string) => {
      socket.join(`restaurant_${restaurantId}_staff`);
      console.log(`[Socket] Staff ${socket.id} joined restaurant_${restaurantId}_staff`);
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
