const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/restaurants', async (req, res) => {
  const { zip, location, lat, lng } = req.query;

  try {
    let query = '';

    if (zip) {
      query = `restaurants near ${zip}`;
    } else if (location) {
      query = `restaurants near ${location}`;
    } else if (lat && lng) {
      query = `restaurants near ${lat},${lng}`;
    } else {
      return res.status(400).json({ error: 'Missing location input' });
    }

    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_maps',
        q: query,
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
      link: r.website || r.link,
      thumbnail: r.thumbnail,
      gps: r.gps_coordinates
    }));

    res.json(formatted);

  } catch (err) {
    res.status(500).json({ error: 'Error fetching data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
