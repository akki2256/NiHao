/**
 * Set EXPO_PUBLIC_API_URL to your deployed Google Apps Script Web App URL.
 * Until then, the app runs in local demo mode with seed users.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim();

export const USE_MOCK = !API_URL;

export const APP_NAME = 'NiHao';
export const BRAND_NAME = 'CALICON';
