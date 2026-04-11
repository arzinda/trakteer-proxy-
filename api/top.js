const axios = require('axios');
const TRAKTEER_KEY = process.env.TRAKTEER_KEY;

const DUMMY_DATA = [
  { rank: 1, name: "Belum ada donasi", amount: 0, currency: "Rp" }
];

module.exports = async (req, res) => {
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
    if (items.length === 0) return res.json(DUMMY_DATA);

    // Aggregate by supporter_id (paling akurat)
    const totals = {};
    items.forEach(tx => {
      // Gunakan supporter_id sebagai key unik, fallback ke email, lalu nama
      const uid  = tx.supporter_id || tx.supporter_email || tx.supporter_name || 'Anonim';
      const name = tx.creator_name  || tx.supporter_name || 'Anonim';

      if (!totals[uid]) {
        totals[uid] = { name, amount: 0 };
      }

      // Selalu pakai nama terbaru yang dipakai donor
      totals[uid].name   = name;
      totals[uid].amount += (tx.amount || 0);
    });

    const sorted = Object.values(totals)
      .sort((a, b) => b.amount - a.amount)
      .map((entry, i) => ({
        rank: i + 1,
        name: entry.name,
        amount: entry.amount,
        currency: 'Rp'
      }))
      .slice(0, 20);

    res.json(sorted.length > 0 ? sorted : DUMMY_DATA);

  } catch (e) {
    res.status(500).json({
      error: e.message,
      status: e.response?.status,
      detail: e.response?.data
    });
  }
};
