const axios = require('axios');
const { Redis } = require('@upstash/redis');

const TRAKTEER_KEY = process.env.TRAKTEER_KEY;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const REDIS_KEY = 'sawer:seen_ids';
const FIRST_RUN_KEY = 'sawer:initialized';
const MAX_CACHE = 200; // batas ID disimpan

module.exports = async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.trakteer.id/v1/public/supports',
      {
        params: { limit: 10, page: 1 },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'key': TRAKTEER_KEY,
        },
      }
    );

    const items = response.data?.result?.data || [];

    // =========================
    // FIRST RUN (ANTI SPAM AWAL)
    // =========================
    const initialized = await redis.get(FIRST_RUN_KEY);

    if (!initialized) {
      const ids = items.map(tx => tx.order_id).filter(Boolean);

      if (ids.length > 0) {
        await redis.sadd(REDIS_KEY, ...ids);
      }

      await redis.set(FIRST_RUN_KEY, '1');

      console.log("🟡 First run - skip notif lama");

      return res.json({ new_donations: [] });
    }

    // =========================
    // CEK DATA SEKALIGUS (FAST)
    // =========================
    const ids = items.map(tx => tx.order_id).filter(Boolean);

    let seenResults = [];
    if (ids.length > 0) {
      seenResults = await redis.smismember(REDIS_KEY, ids);
    }

    const newDonations = [];

    items.forEach((tx, i) => {
      if (!tx.order_id) return;

      const isSeen = seenResults[i];

      if (!isSeen) {
        newDonations.push({
          name: tx.creator_name || tx.supporter_name || 'Anonim',
          amount: tx.amount || 0,
          message: tx.support_message || '',
          unit: tx.unit_name || 'Kopi',
          quantity: tx.quantity || 1,
          order_id: tx.order_id,
        });
      }
    });

    // =========================
    // SIMPAN DATA BARU
    // =========================
    if (newDonations.length > 0) {
      const newIds = newDonations.map(d => d.order_id).filter(Boolean);
      await redis.sadd(REDIS_KEY, ...newIds);
    }

    // =========================
    // CLEANUP REDIS (ANTI NUMPUK)
    // =========================
    const allIds = await redis.smembers(REDIS_KEY);

    if (allIds.length > MAX_CACHE) {
      const removeCount = allIds.length - MAX_CACHE;
      const toRemove = allIds.slice(0, removeCount);

      if (toRemove.length > 0) {
        await redis.srem(REDIS_KEY, ...toRemove);
        console.log("🧹 Cleanup Redis:", toRemove.length, "data dihapus");
      }
    }

    // =========================
    // RESPONSE
    // =========================
    console.log("📬 New donations:", newDonations.length);

    res.json({ new_donations: newDonations });

  } catch (e) {
    console.error("❌ ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
