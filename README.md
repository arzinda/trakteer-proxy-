# Trakteer Proxy untuk Roblox

Proxy server untuk menghubungkan Trakteer API dengan Roblox Leaderboard.

## Setup

1. Ganti `PASTE_API_KEY_DISINI` di `server.js` dengan API Key Trakteer kamu
2. Deploy ke Railway
3. Gunakan URL `/top` di script Roblox

## Endpoint

- `GET /` → Health check
- `GET /top` → Top 10 supporter (JSON)
