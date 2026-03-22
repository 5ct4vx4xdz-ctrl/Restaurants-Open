
const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/restaurants', async (req, res) => {
  const { zip } = req.query;

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_maps',
        q: `restaurants near ${zip}`,
        api_key: process.env.SERPAPI_KEY
      }
    });

    const results = response.data.local_results || [];

    const formatted = results.map(r => ({
      name: r.title,
      rating: r.rating,
      reviews: r.reviews,
      address: r.address,
      open: r.opening_hours?.open_now,
      type: r.type,
      link: r.website || r.link
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
