const express = require('express');
const axios = require('axios');
const app = express();

// ⚠️ GANTI DENGAN API KEY TRAKTEER KAMU
const TRAKTEER_KEY = 'trapi-NLnWWAom6d7NLiUbBI2Y20mv';

// Data dummy — tampil saat belum ada donasi masuk
const DUMMY_DATA = [
  { rank: 1, name: "Belum ada donasi", amount: 0, currency: "Rp" }
];

app.get('/top', async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.trakteer.id/v1/public/supports',
      {
        params: { limit: 25, page: 1 },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'key': TRAKTEER_KEY
        }
      }
    );

    const items = response.data?.result?.data || [];

    // Kalau belum ada donasi, return dummy
    if (items.length === 0) {
      return res.json(DUMMY_DATA);
    }

    const totals = {};
    items.forEach(tx => {
      // Ambil semua status (tidak filter) karena Trakteer sudah filter otomatis
      const name = tx.creator_name || tx.supporter_name || 'Anonim';
      totals[name] = (totals[name] || 0) + (tx.amount || 0);
    });

    const sorted = Object.entries(totals)
      .map(([name, amount]) => ({ name, amount, currency: 'Rp' }))
      .sort((a, b) => b.amount - a.amount)
      .map((entry, i) => ({ ...entry, rank: i + 1 }))
      .slice(0, 10);

    res.json(sorted.length > 0 ? sorted : DUMMY_DATA);

  } catch (e) {
    res.status(500).json({
      error: e.message,
      status: e.response?.status,
      detail: e.response?.data
    });
  }
});

app.get('/debug', async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.trakteer.id/v1/public/supports?limit=5',
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'key': TRAKTEER_KEY
        }
      }
    );
    res.json({ success: true, status: response.status, raw: response.data });
  } catch (e) {
    res.json({
      success: false,
      status: e.response?.status,
      detail: e.response?.data,
      message: e.message
    });
  }
});

app.get('/', (req, res) => res.send('✅ Trakteer Proxy aktif!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));








