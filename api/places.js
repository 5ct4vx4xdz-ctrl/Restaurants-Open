const axios = require('axios');

module.exports = async function handler(req, res) {
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
    console.error(error?.response?.data || error.message);
    res.status(500).json({ error: 'Error fetching data' });
  }
};

function normalizeCategory(category) {
  if (category === 'wineries') return 'wineries';
  if (category === 'breweries') return 'breweries';
  return 'restaurants';
}

function pickImageUrl(place) {
  const candidates = [
    place.image,
    place.photos && place.photos[0] && (place.photos[0].image || place.photos[0].thumbnail || place.photos[0]),
    place.photo,
    place.thumbnail,
    place.thumbnail_url,
  ];
  return candidates.find(c => typeof c === 'string' && c.startsWith('http')) || '';
}

function parseOpenStatus(oh) {
  if (!oh) return { openNow: undefined, hoursSchedule: null, hoursText: null };

  if (typeof oh === 'object') {
    const openNow = typeof oh.open_now === 'boolean' ? oh.open_now : undefined;
    const hoursSchedule = Array.isArray(oh.hours) ? oh.hours : null;
    return { openNow, hoursSchedule, hoursText: null };
  }

  if (typeof oh === 'string') {
    const lower = oh.toLowerCase();
    const openNow = lower.startsWith('open') ? true : lower.startsWith('closed') ? false : undefined;
    return { openNow, hoursSchedule: null, hoursText: oh };
  }

  return { openNow: undefined, hoursSchedule: null, hoursText: null };
}

function formatPlace(place) {
  const { openNow, hoursSchedule, hoursText } = parseOpenStatus(place.opening_hours);
  return {
    name: place.title,
    rating: place.rating,
    reviews: place.reviews,
    address: place.address,
    open: openNow,
    hours: hoursSchedule,
    hoursText,
    type: place.type,
    link: place.website || place.link,
    image: pickImageUrl(place),
    thumbnail: place.thumbnail,
    gps: place.gps_coordinates,
    distanceText: place.distance || '',
    distanceMiles: parseDistanceToMiles(place.distance)
  };
}

function parseDistanceToMiles(distance) {
  if (!distance || typeof distance !== 'string') return null;
  const text = distance.toLowerCase().trim();
  const mileMatch = text.match(/([\d.]+)\s*mi/);
  if (mileMatch) return parseFloat(mileMatch[1]);
  const footMatch = text.match(/([\d,]+)\s*ft/);
  if (footMatch) return parseFloat(footMatch[1].replace(/,/g, '')) / 5280;
  const kmMatch = text.match(/([\d.]+)\s*km/);
  if (kmMatch) return parseFloat(kmMatch[1]) * 0.621371;
  const meterMatch = text.match(/([\d,]+)\s*m\b/);
  if (meterMatch) return parseFloat(meterMatch[1].replace(/,/g, '')) * 0.000621371;
  return null;
}
