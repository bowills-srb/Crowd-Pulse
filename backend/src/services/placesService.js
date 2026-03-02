/**
 * Google Places Service
 * Imports and syncs venue data from Google Places API
 */

const axios = require('axios');
const { db } = require('../config/database');
const Venue = require('../models/Venue');

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Venue categories we care about
const VENUE_TYPES = [
  'bar',
  'night_club',
  'restaurant',
  'cafe',
  'brewery',
  'casino',
  'bowling_alley',
  'movie_theater',
];

// Map Google types to our categories
const TYPE_MAPPING = {
  bar: 'bar',
  night_club: 'club',
  restaurant: 'restaurant',
  cafe: 'cafe',
  brewery: 'brewery',
  casino: 'casino',
  bowling_alley: 'entertainment',
  movie_theater: 'entertainment',
};

/**
 * Search for venues near a location
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} radius - Search radius in meters (max 50000)
 * @param {string} type - Google place type filter
 */
const searchNearby = async (latitude, longitude, radius = 5000, type = null) => {
  if (!GOOGLE_API_KEY) {
    throw new Error('Google Places API key not configured');
  }

  const params = {
    location: `${latitude},${longitude}`,
    radius,
    key: GOOGLE_API_KEY,
  };

  if (type) {
    params.type = type;
  }

  try {
    const response = await axios.get(`${PLACES_BASE_URL}/nearbysearch/json`, { params });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', response.data.status, response.data.error_message);
      throw new Error(`Places API error: ${response.data.status}`);
    }

    return response.data.results || [];
  } catch (error) {
    console.error('Google Places search error:', error.message);
    throw error;
  }
};

/**
 * Get detailed place information
 * @param {string} placeId - Google Place ID
 */
const getPlaceDetails = async (placeId) => {
  if (!GOOGLE_API_KEY) {
    throw new Error('Google Places API key not configured');
  }

  const params = {
    place_id: placeId,
    fields: 'name,formatted_address,formatted_phone_number,geometry,opening_hours,price_level,rating,user_ratings_total,website,photos,types,address_components',
    key: GOOGLE_API_KEY,
  };

  try {
    const response = await axios.get(`${PLACES_BASE_URL}/details/json`, { params });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Places API error: ${response.data.status}`);
    }

    return response.data.result;
  } catch (error) {
    console.error('Google Places details error:', error.message);
    throw error;
  }
};

/**
 * Import venues for a location
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} radius 
 */
const importVenuesForLocation = async (latitude, longitude, radius = 5000) => {
  const imported = [];
  const errors = [];

  for (const type of VENUE_TYPES) {
    console.log(`Searching for ${type} venues...`);
    
    try {
      const places = await searchNearby(latitude, longitude, radius, type);
      console.log(`Found ${places.length} ${type} venues`);

      for (const place of places) {
        try {
          // Check if venue already exists
          const existing = await Venue.findByExternalId(place.place_id);
          if (existing) {
            console.log(`Skipping existing venue: ${place.name}`);
            continue;
          }

          // Get detailed info
          const details = await getPlaceDetails(place.place_id);
          
          // Parse address components
          const addressComponents = parseAddressComponents(details.address_components || []);
          
          // Estimate capacity based on type and rating count
          const estimatedCapacity = estimateCapacity(type, details.user_ratings_total);

          // Create venue
          const venue = await Venue.create({
            externalPlaceId: place.place_id,
            name: details.name,
            address: details.formatted_address,
            city: addressComponents.city,
            state: addressComponents.state,
            zipCode: addressComponents.zipCode,
            latitude: details.geometry.location.lat,
            longitude: details.geometry.location.lng,
            category: TYPE_MAPPING[type] || 'other',
            subcategory: type,
            estimatedCapacity,
            metadata: {
              phone: details.formatted_phone_number,
              website: details.website,
              rating: details.rating,
              ratingCount: details.user_ratings_total,
              priceLevel: details.price_level,
              hours: details.opening_hours?.weekday_text,
              photos: details.photos?.slice(0, 3).map(p => ({
                reference: p.photo_reference,
                width: p.width,
                height: p.height,
              })),
            },
          });

          imported.push(venue);
          console.log(`Imported: ${venue.name}`);

          // Rate limit: Google allows 10 QPS
          await sleep(150);
        } catch (err) {
          console.error(`Failed to import ${place.name}:`, err.message);
          errors.push({ name: place.name, error: err.message });
        }
      }
    } catch (err) {
      console.error(`Failed to search ${type}:`, err.message);
      errors.push({ type, error: err.message });
    }
  }

  return { imported, errors, count: imported.length };
};

/**
 * Parse Google address components into structured data
 */
const parseAddressComponents = (components) => {
  const result = {
    city: null,
    state: null,
    zipCode: null,
    country: null,
  };

  for (const component of components) {
    if (component.types.includes('locality')) {
      result.city = component.long_name;
    } else if (component.types.includes('administrative_area_level_1')) {
      result.state = component.short_name;
    } else if (component.types.includes('postal_code')) {
      result.zipCode = component.long_name;
    } else if (component.types.includes('country')) {
      result.country = component.short_name;
    }
  }

  return result;
};

/**
 * Estimate venue capacity based on type and popularity
 */
const estimateCapacity = (type, ratingCount) => {
  // Base capacity by venue type
  const baseCapacity = {
    night_club: 300,
    bar: 100,
    brewery: 150,
    restaurant: 80,
    cafe: 40,
    casino: 500,
    bowling_alley: 200,
    movie_theater: 300,
  };

  let capacity = baseCapacity[type] || 100;

  // Adjust based on popularity (rating count)
  if (ratingCount > 2000) {
    capacity *= 2;
  } else if (ratingCount > 1000) {
    capacity *= 1.5;
  } else if (ratingCount > 500) {
    capacity *= 1.25;
  } else if (ratingCount < 100) {
    capacity *= 0.75;
  }

  return Math.round(capacity);
};

/**
 * Get photo URL from photo reference
 */
const getPhotoUrl = (photoReference, maxWidth = 400) => {
  if (!GOOGLE_API_KEY || !photoReference) return null;
  return `${PLACES_BASE_URL}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
};

/**
 * Sync venue data (update existing venues with fresh info)
 */
const syncVenue = async (venueId) => {
  const venue = await Venue.findById(venueId);
  if (!venue || !venue.external_place_id) {
    throw new Error('Venue not found or no external ID');
  }

  const details = await getPlaceDetails(venue.external_place_id);
  
  return Venue.update(venueId, {
    metadata: {
      ...venue.metadata,
      rating: details.rating,
      ratingCount: details.user_ratings_total,
      hours: details.opening_hours?.weekday_text,
    },
  });
};

/**
 * Seed database with venues for multiple cities
 */
const seedMultipleCities = async (cities) => {
  const results = [];
  
  for (const city of cities) {
    console.log(`\n📍 Importing venues for ${city.name}...`);
    const result = await importVenuesForLocation(city.lat, city.lng, city.radius || 5000);
    results.push({ city: city.name, ...result });
    
    // Pause between cities
    await sleep(2000);
  }

  return results;
};

// Helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  searchNearby,
  getPlaceDetails,
  importVenuesForLocation,
  getPhotoUrl,
  syncVenue,
  seedMultipleCities,
  VENUE_TYPES,
};
