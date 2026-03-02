#!/usr/bin/env node
/**
 * Seed venues from Google Places API
 * Usage: node seeds/seedVenues.js
 */

require('dotenv').config();

const { importVenuesForLocation, seedMultipleCities } = require('../src/services/placesService');
const { testConnection } = require('../src/config/database');

// Popular college towns and urban areas for initial launch
const SEED_CITIES = [
  // College towns
  { name: 'Austin, TX', lat: 30.2672, lng: -97.7431, radius: 8000 },
  { name: 'Ann Arbor, MI', lat: 42.2808, lng: -83.7430, radius: 5000 },
  { name: 'Boulder, CO', lat: 40.0150, lng: -105.2705, radius: 5000 },
  { name: 'Madison, WI', lat: 43.0731, lng: -89.4012, radius: 5000 },
  { name: 'Athens, GA', lat: 33.9519, lng: -83.3576, radius: 4000 },
  { name: 'Gainesville, FL', lat: 29.6516, lng: -82.3248, radius: 4000 },
  { name: 'Tempe, AZ', lat: 33.4255, lng: -111.9400, radius: 5000 },
  { name: 'Chapel Hill, NC', lat: 35.9132, lng: -79.0558, radius: 4000 },
  
  // Urban nightlife districts
  { name: 'Manhattan, NY', lat: 40.7580, lng: -73.9855, radius: 5000 },
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, radius: 6000 },
  { name: 'Chicago, IL', lat: 41.8827, lng: -87.6233, radius: 6000 },
  { name: 'Miami Beach, FL', lat: 25.7907, lng: -80.1300, radius: 5000 },
  { name: 'Nashville, TN', lat: 36.1627, lng: -86.7816, radius: 5000 },
  { name: 'New Orleans, LA', lat: 29.9511, lng: -90.0715, radius: 5000 },
  { name: 'Denver, CO', lat: 39.7392, lng: -104.9903, radius: 6000 },
  { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321, radius: 5000 },
];

// 30A + Gulf Coast/Panhandle focused launch markets
const PANHANDLE_MARKETS = [
  { name: 'Rosemary Beach / Inlet Beach, FL', lat: 30.2812, lng: -86.0169, radius: 4500 },
  { name: 'Alys Beach, FL', lat: 30.2735, lng: -86.0557, radius: 3000 },
  { name: 'Seacrest / Seagrove / Seaside (30A), FL', lat: 30.3220, lng: -86.1388, radius: 8000 },
  { name: 'Grayton Beach / Blue Mountain (30A), FL', lat: 30.3264, lng: -86.1967, radius: 5500 },
  { name: 'Santa Rosa Beach / Miramar Beach, FL', lat: 30.3916, lng: -86.3198, radius: 8000 },
  { name: 'Destin, FL', lat: 30.3935, lng: -86.4958, radius: 9000 },
  { name: 'Fort Walton Beach, FL', lat: 30.4058, lng: -86.6188, radius: 7000 },
  { name: 'Panama City Beach, FL', lat: 30.1766, lng: -85.8055, radius: 10000 },
  { name: 'Panama City, FL', lat: 30.1588, lng: -85.6602, radius: 8000 },
  { name: 'Pensacola Beach, FL', lat: 30.3338, lng: -87.1436, radius: 7000 },
  { name: 'Pensacola, FL', lat: 30.4213, lng: -87.2169, radius: 9000 },
  { name: 'Gulf Shores, AL', lat: 30.2460, lng: -87.7008, radius: 8000 },
  { name: 'Orange Beach, AL', lat: 30.2944, lng: -87.5736, radius: 7000 },
];

// For testing with a single location
const TEST_LOCATION = {
  name: 'Test - Downtown Austin',
  lat: 30.2672,
  lng: -97.7431,
  radius: 3000,
};

async function main() {
  console.log('🏢 CrowdPulse Venue Seeder\n');

  // Check for API key
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in environment');
    console.log('\nTo seed venues, add your Google Places API key to .env:');
    console.log('GOOGLE_PLACES_API_KEY=your_api_key_here\n');
    process.exit(1);
  }

  // Test database connection
  console.log('Testing database connection...');
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const mode = args[0] || 'test';

  try {
    if (mode === 'test') {
      // Seed just one small area for testing
      console.log(`\n🧪 Test mode: Seeding ${TEST_LOCATION.name}\n`);
      const result = await importVenuesForLocation(
        TEST_LOCATION.lat,
        TEST_LOCATION.lng,
        TEST_LOCATION.radius
      );
      console.log(`\n✅ Imported ${result.count} venues`);
      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.errors.length} errors occurred`);
      }
    } else if (mode === 'full') {
      // Seed all cities
      console.log(`\n🌎 Full mode: Seeding ${SEED_CITIES.length} cities\n`);
      const results = await seedMultipleCities(SEED_CITIES);
      
      const totalImported = results.reduce((sum, r) => sum + r.count, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
      
      console.log('\n📊 Summary:');
      results.forEach(r => {
        console.log(`   ${r.city}: ${r.count} venues`);
      });
      console.log(`\n✅ Total: ${totalImported} venues imported`);
      if (totalErrors > 0) {
        console.log(`⚠️  ${totalErrors} errors occurred`);
      }
    } else if (mode === 'panhandle') {
      // Seed Gulf Coast/Panhandle markets
      console.log(`\n🏖️ Panhandle mode: Seeding ${PANHANDLE_MARKETS.length} coastal areas\n`);
      const results = await seedMultipleCities(PANHANDLE_MARKETS);

      const totalImported = results.reduce((sum, r) => sum + r.count, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      console.log('\n📊 Summary:');
      results.forEach(r => {
        console.log(`   ${r.city}: ${r.count} venues`);
      });
      console.log(`\n✅ Total: ${totalImported} venues imported`);
      if (totalErrors > 0) {
        console.log(`⚠️  ${totalErrors} errors occurred`);
      }
    } else if (mode === 'custom') {
      // Custom location from args
      const lat = parseFloat(args[1]);
      const lng = parseFloat(args[2]);
      const radius = parseInt(args[3]) || 5000;

      if (isNaN(lat) || isNaN(lng)) {
        console.error('Usage: node seedVenues.js custom <lat> <lng> [radius]');
        process.exit(1);
      }

      console.log(`\n📍 Custom location: ${lat}, ${lng} (${radius}m radius)\n`);
      const result = await importVenuesForLocation(lat, lng, radius);
      console.log(`\n✅ Imported ${result.count} venues`);
    } else {
      console.log('Usage:');
      console.log('  node seedVenues.js test              # Seed test location only');
      console.log('  node seedVenues.js full              # Seed all predefined cities');
      console.log('  node seedVenues.js panhandle         # Seed 30A + Panhandle + Gulf Shores/Orange Beach');
      console.log('  node seedVenues.js custom <lat> <lng> [radius]  # Seed custom location');
    }
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
