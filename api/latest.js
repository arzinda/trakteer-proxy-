const axios = require('axios');
const { Redis } = require('@upstash/redis');

const TRAKTEER_KEY = process.env.TRAKTEER_KEY;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const REDIS_KEY    = 'sawer:seen_ids';
const FIRST_RUN_KEY = 'sawer:initialized';
const MAX_CACHE    = 500; // ← naikkan biar cleanup tidak hapus ID baru

module.exports = async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.trakteer.id/v1/public/supports',
      {
        params: { limit: 25, page: 1 }, // ← naikkan dari 10 ke 25
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
    const newIds = [];

    items.forEach((tx, i) => {
      if (!tx.order_id) return;
      const isSeen = seenResults[i];
      if (!isSeen) {
        newDonations.push({
          name:     tx.creator_name || tx.supporter_name || 'Anonim',
          amount:   tx.amount || 0,
          message:  tx.support_message || '',
          unit:     tx.unit_name || 'Kopi',
          quantity: tx.quantity || 1,
          order_id: tx.order_id,
        });
        newIds.push(tx.order_id);
      }
    });

    // =========================
    // SIMPAN ID BARU DULU
    // =========================
    if (newIds.length > 0) {
      await redis.sadd(REDIS_KEY, ...newIds);
      console.log("✅ Simpan ID baru:", newIds.length);
    }

    // =========================
    // CLEANUP REDIS PAKAI ZSET (SAFE)
    // ← pakai key terpisah untuk tracking waktu
    // =========================
    const now = Date.now();
    if (newIds.length > 0) {
      // simpan timestamp tiap ID baru ke sorted set
      const scoreMembers = newIds.flatMap(id => [now, id]);
      await redis.zadd('sawer:seen_zset', ...scoreMembers.reduce((acc, val, i) => {
        if (i % 2 === 0) acc.push({ score: scoreMembers[i], member: scoreMembers[i + 1] });
        return acc;
      }, []));
    }

    // hapus ID terlama dari zset kalau sudah > MAX_CACHE
    const zsetCount = await redis.zcard('sawer:seen_zset');
    if (zsetCount > MAX_CACHE) {
      const removeCount = zsetCount - MAX_CACHE;
      // ambil ID terlama
      const oldIds = await redis.zrange('sawer:seen_zset', 0, removeCount - 1);
      if (oldIds.length > 0) {
        await redis.zrem('sawer:seen_zset', ...oldIds);
        await redis.srem(REDIS_KEY, ...oldIds);
        console.log("🧹 Cleanup Redis:", oldIds.length, "ID terlama dihapus");
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
