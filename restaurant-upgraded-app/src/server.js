const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Choose only the fields you actually need.
// Field masks are required in Places API (New).
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
  'places.primaryType',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.location',
  'places.photos'
].join(',');

app.get('/api/places', async (req, res) => {
  const { zip, location, lat, lng, category, openNow, sort } = req.query;

  try {
    let places = [];

    if (lat && lng) {
      places = await nearbySearch({
        lat: Number(lat),
        lng: Number(lng),
        category,
        openNow: toBoolean(openNow),
        sort
      });
    } else if (zip || location) {
      places = await textSearch({
        zip,
        location,
        category,
        openNow: toBoolean(openNow),
        sort
      });
    } else {
      return res.status(400).json({ error: 'Missing location input' });
    }

    res.json(places.map(formatPlace));
  } catch (error) {
    console.error(
      error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    res.status(500).json({ error: 'Error fetching data from Google Places' });
  }
});

async function nearbySearch({ lat, lng, category, openNow, sort }) {
  const includedType = normalizeCategoryForGoogle(category);

  const body = {
    includedTypes: [includedType],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 25000
      }
    }
  };

  if (typeof openNow === 'boolean') {
    body.openNow = openNow;
  }

  // DISTANCE is useful for your “Closest” sort.
  if (sort === 'closest') {
    body.rankPreference = 'DISTANCE';
  } else {
    body.rankPreference = 'RELEVANCE';
  }

  const response = await axios.post(
    `${GOOGLE_PLACES_BASE}/places:searchNearby`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK
      }
    }
  );

  return response.data.places || [];
}

async function textSearch({ zip, location, category, openNow, sort }) {
  const categoryLabel = normalizeCategoryForQuery(category);
  const queryTarget = zip || location;
  const textQuery = `${categoryLabel} near ${queryTarget}`;

  const body = {
    textQuery,
    maxResultCount: 20
  };

  // Optional but useful:
  // Google supports openNow on Text Search (New) as well.
  if (typeof openNow === 'boolean') {
    body.openNow = openNow;
  }

  // If user typed a category-like query, DISTANCE can help for "closest".
  if (sort === 'closest') {
    body.rankPreference = 'DISTANCE';
  }

  const response = await axios.post(
    `${GOOGLE_PLACES_BASE}/places:searchText`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK
      }
    }
  );

  return response.data.places || [];
}

function normalizeCategoryForGoogle(category) {
  const c = String(category || '').toLowerCase();

  // Google includedTypes expects supported place types.
  if (c === 'wineries' || c === 'winery') return 'winery';
  if (c === 'breweries' || c === 'brewery') return 'brewery';
  return 'restaurant';
}

function normalizeCategoryForQuery(category) {
  const c = String(category || '').toLowerCase();
  if (c === 'wineries' || c === 'winery') return 'wineries';
  if (c === 'breweries' || c === 'brewery') return 'breweries';
  return 'restaurants';
}

function formatPlace(place) {
  const photo = place.photos?.[0];

  return {
    id: place.id,
    name: place.displayName?.text || '',
    rating: place.rating,
    reviews: place.userRatingCount,
    address: place.formattedAddress || '',
    open: place.currentOpeningHours?.openNow,
    type: place.primaryType || '',
    link: place.websiteUri || place.googleMapsUri || '',
    image: photo ? buildPlacePhotoUrl(photo.name, 1200) : '',
    thumbnail: photo ? buildPlacePhotoUrl(photo.name, 480) : '',
    gps: place.location
      ? {
          latitude: place.location.latitude,
          longitude: place.location.longitude
        }
      : null,
    distanceText: '',
    distanceMiles: null,
    photoAttributions: formatPhotoAttributions(photo?.authorAttributions || [])
  };
}

function buildPlacePhotoUrl(photoName, maxWidthPx = 1200) {
  if (!photoName) return '';
  return `${GOOGLE_PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${GOOGLE_API_KEY}`;
}

function formatPhotoAttributions(authorAttributions) {
  return authorAttributions.map(a => ({
    displayName: a.displayName || '',
    uri: a.uri || '',
    photoUri: a.photoUri || ''
  }));
}

function toBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});