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
    const placeType = normalizeCategory(category);
    const params = {
      engine: 'google_maps',
      type: 'search',
      api_key: process.env.SERPAPI_KEY
    };

    if (lat && lng) {
      params.q = placeType;
      params.ll = `@${lat},${lng},14z`;
    } else if (zip) {
      params.q = `${placeType} near ${zip}`;
    } else if (location) {
      params.q = `${placeType} near ${location}`;
    } else {
      return res.status(400).json({ error: 'Missing location input' });
    }

    const response = await axios.get('https://serpapi.com/search.json', { params });
    const results = response.data.local_results || [];

    res.json(results.map(formatPlace));
  } catch (error) {
    console.error(error && error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

function normalizeCategory(category) {
  if (category === 'wineries') return 'wineries';
  if (category === 'breweries') return 'breweries';
  return 'restaurants';
}

function formatPlace(place) {
  return {
    name: place.title,
    rating: place.rating,
    reviews: place.reviews,
    address: place.address,
    open: place.opening_hours ? place.opening_hours.open_now : undefined,
    type: place.type,
    link: place.website || place.link,
    image: pickImageUrl(place),
    thumbnail: place.thumbnail,
    gps: place.gps_coordinates,
    distanceText: place.distance || '',
    distanceMiles: parseDistanceToMiles(place.distance)
  };
}

function pickImageUrl(place) {
  const candidates = [
    place.thumbnail,
    place.image,
    place.photo,
    place.thumbnail_url,
    place.photos && place.photos[0] && (place.photos[0].image || place.photos[0].thumbnail || place.photos[0])
  ];

  return candidates.find(candidate => typeof candidate === 'string' && candidate.startsWith('http')) || '';
}

function parseDistanceToMiles(distance) {
  if (!distance || typeof distance !== 'string') return null;

  const text = distance.toLowerCase().trim();

  const mileMatch = text.match(/([\d.]+)\s*mi/);
  if (mileMatch) return parseFloat(mileMatch[1]);

  const footMatch = text.match(/([\d,]+)\s*ft/);
  if (footMatch) {
    const feet = parseFloat(footMatch[1].replace(/,/g, ''));
    return feet / 5280;
  }

  const kmMatch = text.match(/([\d.]+)\s*km/);
  if (kmMatch) {
    return parseFloat(kmMatch[1]) * 0.621371;
  }

  const meterMatch = text.match(/([\d,]+)\s*m\b/);
  if (meterMatch) {
    const meters = parseFloat(meterMatch[1].replace(/,/g, ''));
    return meters * 0.000621371;
  }

  return null;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
