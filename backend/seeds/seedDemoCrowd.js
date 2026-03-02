#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();

const { db } = require('../src/config/database');

const STATES = [
  { label: 'quiet', percent: 18, trend: 'steady', confidence: 'high' },
  { label: 'moderate', percent: 52, trend: 'steady', confidence: 'high' },
  { label: 'slammed', percent: 92, trend: 'filling_up', confidence: 'high' },
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    city: null,
    limit: 9,
    clearRecent: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--city' && args[i + 1]) {
      options.city = args[i + 1];
      i += 1;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = Math.max(3, parseInt(args[i + 1], 10) || 9);
      i += 1;
    } else if (arg === '--keep-recent') {
      options.clearRecent = false;
    }
  }

  return options;
};

const capacityFor = (venue) => venue.estimated_capacity || 160;

const estimatedCountFor = (capacity, percent) => Math.round((capacity * percent) / 100);

async function main() {
  const options = parseArgs();
  const where = options.city ? 'WHERE city ILIKE $1 AND is_active = true' : 'WHERE is_active = true';
  const params = options.city ? [`%${options.city}%`, options.limit] : [options.limit];
  const limitParam = options.city ? '$2' : '$1';

  const venues = await db.manyOrNone(
    `
      SELECT id, name, city, estimated_capacity
      FROM venues
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limitParam}
    `,
    params
  );

  if (!venues.length) {
    console.log('No venues found. Seed venues first (npm run seed).');
    process.exit(1);
  }

  if (options.clearRecent) {
    await db.none(
      `
        DELETE FROM crowd_readings
        WHERE venue_id = ANY($1::uuid[])
          AND timestamp > NOW() - INTERVAL '4 hours'
      `,
      [venues.map((v) => v.id)]
    );
  }

  const output = [];

  for (let i = 0; i < venues.length; i += 1) {
    const venue = venues[i];
    const state = STATES[i % STATES.length];
    const capacity = capacityFor(venue);
    const estimatedCount = estimatedCountFor(capacity, state.percent);

    await db.none(
      `
        INSERT INTO crowd_readings (
          venue_id, estimated_count, capacity_percentage, source, confidence, trend, timestamp
        ) VALUES ($1, $2, $3, 'inferred', $4, $5, NOW() - ($6 || ' minutes')::interval)
      `,
      [venue.id, estimatedCount, state.percent, state.confidence, state.trend, (i % 7) + 1]
    );

    output.push({
      name: venue.name,
      city: venue.city || 'unknown',
      state: state.label,
      capacity: capacity,
      crowd: `${state.percent}%`,
      estimated: estimatedCount,
    });
  }

  console.log('\nDemo crowd states seeded:\n');
  output.forEach((item) => {
    console.log(
      `- ${item.name} (${item.city}) -> ${item.state.toUpperCase()} | ${item.crowd} | est ${item.estimated}/${item.capacity}`
    );
  });
  console.log('\nTip: use the mobile Radar "Lively" and "Lowkey" toggles to validate filtering.');
}

main()
  .catch((error) => {
    console.error('Failed to seed demo crowd data:', error.message);
    process.exit(1);
  });
