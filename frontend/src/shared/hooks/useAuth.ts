import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import socketService from '../services/socket';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'ADMIN';
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  restaurant: Restaurant | null;
  login: (token: string, user: User, restaurant: Restaurant) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      restaurant: null,

      login: (token, user, restaurant) => {
        set({ token, user, restaurant });
        // Connect socket and join staff room
        socketService.connect();
        socketService.joinRestaurantStaff(restaurant.id);
      },

      logout: () => {
        set({ token: null, user: null, restaurant: null });
        socketService.disconnect();
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'crunchos-staff-auth',
    }
  )
);
