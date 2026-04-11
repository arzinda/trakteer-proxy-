const axios = require('axios');

const TRAKTEER_KEY = 'trapi-NLnWWAom6d7NLiUbBI2Y20mv';

const DUMMY_DATA = [

  { rank: 1, name: "Belum ada donasi", amount: 0, currency: "Rp" }

];

module.exports = async (req, res) => {

  try {

    const response = await axios.get(

      'https://api.trakteer.id/v1/public/supports',

      {

        params: { limit: 100, page: 1 }, // ← naikan limit biar data cukup untuk di-aggregate

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

    const totals = {};

    items.forEach(tx => {

      const name = tx.creator_name || tx.supporter_name || 'Anonim';

      totals[name] = (totals[name] || 0) + (tx.amount || 0);

    });

    const sorted = Object.entries(totals)

      .map(([name, amount]) => ({ name, amount, currency: 'Rp' }))

      .sort((a, b) => b.amount - a.amount)

      .map((entry, i) => ({ ...entry, rank: i + 1 }))

      .slice(0, 20); // ← ubah dari 10 ke 20

    res.json(sorted.length > 0 ? sorted : DUMMY_DATA);

  } catch (e) {

    res.status(500).json({

      error: e.message,

      status: e.response?.status,

      detail: e.response?.data

    });

  }

};
