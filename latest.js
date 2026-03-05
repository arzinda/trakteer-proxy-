const axios = require('axios');

const TRAKTEER_KEY = 'PASTE_API_KEY_DISINI';

// Simpan di memory (reset tiap cold start, tapi cukup untuk deteksi donasi baru)
let lastOrderIds = new Set();
let isFirstFetch = true;

module.exports = async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.trakteer.id/v1/public/supports',
      {
        params: { limit: 5, page: 1 },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'key': TRAKTEER_KEY
        }
      }
    );

    const items = response.data?.result?.data || [];

    if (isFirstFetch) {
      items.forEach(tx => {
        if (tx.order_id) lastOrderIds.add(tx.order_id);
      });
      isFirstFetch = false;
      return res.json({ new_donations: [] });
    }

    const newDonations = [];
    items.forEach(tx => {
      if (tx.order_id && !lastOrderIds.has(tx.order_id)) {
        newDonations.push({
          name: tx.creator_name || 'Anonim',
          amount: tx.amount || 0,
          message: tx.support_message || '',
          unit: tx.unit_name || 'Kopi',
          quantity: tx.quantity || 1
        });
        lastOrderIds.add(tx.order_id);
      }
    });

    res.json({ new_donations: newDonations });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
