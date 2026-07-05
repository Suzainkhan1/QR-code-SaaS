import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
      });
      console.log('[Socket Service] Connecting to Socket server...');
    }
    return this.socket;
  }

  getSocket(): Socket {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  joinRestaurantStaff(restaurantId: string) {
    const s = this.getSocket();
    s.emit('join_restaurant_staff', restaurantId);
  }

  joinOrderRoom(orderId: string) {
    const s = this.getSocket();
    s.emit('join_order', orderId);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket Service] Connection closed.');
    }
  }
}

export const socketService = new SocketService();
export default socketService;
