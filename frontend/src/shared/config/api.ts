/**
 * Centralized API and Socket server URL configuration.
 * Normalizes VITE_API_URL to ensure no trailing slashes or duplicate '/api' paths.
 */
const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API_URL = rawUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
