/**
 * Centralized API and Socket server URL configuration.
 * Uses environment variable with a safe local development fallback.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
