const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/places', async (req, res) => {
  const { zip, location, lat, lng, category } = req.query;

  try {
    let placeType = 'restaurants';
    if (category === 'wineries') placeType = 'wineries';
    if (category === 'breweries') placeType = 'breweries';

    let query = '';

    if (zip) {
      query = `${placeType} near ${zip}`;
    } else if (location) {
      query = `${placeType} near ${location}`;
    } else if (lat && lng) {
      query = `${placeType} near ${lat},${lng}`;
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
      gps: r.gps_coordinates,
      distanceText: r.distance || '',
      distanceMiles: parseDistanceToMiles(r.distance)
    }));

    res.json(formatted);

  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

function parseDistanceToMiles(distance) {
  if (!distance || typeof distance !== 'string') return null;

  const text = distance.toLowerCase().trim();

  const mileMatch = text.match(/([\\d.]+)\\s*mi/);
  if (mileMatch) return parseFloat(mileMatch[1]);

  const footMatch = text.match(/([\\d,]+)\\s*ft/);
  if (footMatch) {
    const feet = parseFloat(footMatch[1].replace(/,/g, ''));
    return feet / 5280;
  }

  const kmMatch = text.match(/([\\d.]+)\\s*km/);
  if (kmMatch) {
    return parseFloat(kmMatch[1]) * 0.621371;
  }

  const meterMatch = text.match(/([\\d,]+)\\s*m\\b/);
  if (meterMatch) {
    const meters = parseFloat(meterMatch[1].replace(/,/g, ''));
    return meters * 0.000621371;
  }

  return null;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
