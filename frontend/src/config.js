// Backend base URL. Set VITE_API_URL in .env.local (dev) or in the hosting
// dashboard / .env.production (builds). See frontend/.env.example.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
