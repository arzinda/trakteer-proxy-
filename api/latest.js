const axios = require('axios');
const fs = require('fs');

const TRAKTEER_KEY = 'trapi-NLnWWAom6d7NLiUbBI2Y20mv';
const CACHE_FILE = '/tmp/last_order_ids.json';

function loadSeenIds() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return new Set(data.ids || []);
    }
  } catch (e) {}
  return null; // null = first fetch
}

function saveSeenIds(ids) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ids: [...ids] }));
  } catch (e) {}
}

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
    const seenIds = loadSeenIds();

    // First fetch - simpan semua ID, jangan kirim notif
    if (seenIds === null) {
      const newSet = new Set();
      items.forEach(tx => { if (tx.order_id) newSet.add(tx.order_id); });
      saveSeenIds(newSet);
      return res.json({ new_donations: [] });
    }

    // Cek donasi baru
    const newDonations = [];
    const updatedIds = new Set(seenIds);

    items.forEach(tx => {
      if (tx.order_id && !seenIds.has(tx.order_id)) {
        newDonations.push({
          name: tx.creator_name || tx.supporter_name || 'Anonim',
          amount: tx.amount || 0,
          message: tx.support_message || '',
          unit: tx.unit_name || 'Kopi',
          quantity: tx.quantity || 1
        });
        updatedIds.add(tx.order_id);
      }
    });

    saveSeenIds(updatedIds);
    res.json({ new_donations: newDonations });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
