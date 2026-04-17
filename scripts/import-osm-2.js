const fetch = require('node-fetch');
global.fetch = fetch;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rfzedxvzycqzmnxcyrlu.supabase.co'; // thay URL của bạn
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmemVkeHZ6eWNxem1ueGN5cmx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYyMTM3MSwiZXhwIjoyMDg5MTk3MzcxfQ.w0wH2_vGB49yZrvThaTGU9D0CNpt2U3G021vD2qxsng'; // thay anon key của bạn
const supabase = createClient(supabaseUrl, supabaseKey);

const CATEGORY_MAPPING = [
  {
    category: 'park',
    query: `[out:json][timeout:30];
    (
      node["leisure"="park"](15.9,107.9,16.2,108.4);
      node["leisure"="garden"](15.9,107.9,16.2,108.4);
      node["leisure"="playground"](15.9,107.9,16.2,108.4);
    );
    out body;`,
  },
  {
    category: 'movies',
    query: `[out:json][timeout:30];
    (
      node["amenity"="cinema"](15.9,107.9,16.2,108.4);
    );
    out body;`,
  },
  {
    category: 'study',
    query: `[out:json][timeout:30];
    (
      node["amenity"="library"](15.9,107.9,16.2,108.4);
      node["amenity"="university"](15.9,107.9,16.2,108.4);
      node["amenity"="college"](15.9,107.9,16.2,108.4);
      node["amenity"="coworking_space"](15.9,107.9,16.2,108.4);
    );
    out body;`,
  },
];

async function queryOverpass(query) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const json = await res.json();
  return json.elements ?? [];
}

function transformElement(element, category) {
  const tags = element.tags ?? {};
  const name = tags.name || tags['name:vi'] || tags['name:en'];
  if (!name) return null;
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!lat || !lng) return null;
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:quarter'],
    tags['addr:city'] || 'Đà Nẵng',
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : 'Đà Nẵng';
  return {
    name,
    description: tags['description'] || null,
    category,
    address,
    lat,
    lng: element.lon ?? element.center?.lon,
    opening_hours: tags['opening_hours'] || null,
    rating: 0,
    review_count: 0,
    image_url: null,
  };
}

async function importCategory({ category, query }) {
  console.log(`\n🔍 Querying ${category}...`);
  const elements = await queryOverpass(query);
  console.log(`  Found ${elements.length} raw elements`);
  const places = elements.map(el => transformElement(el, category)).filter(Boolean);
  console.log(`  Valid places: ${places.length}`);
  if (places.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < places.length; i += 50) {
    const batch = places.slice(i, i + 50);
    const { error } = await supabase
      .from('places')
      .upsert(batch, { onConflict: 'name,lat,lng', ignoreDuplicates: true });
    if (error) {
      console.error(`  ❌ Error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  ✅ Inserted ${inserted} places`);
  return inserted;
}

async function main() {
  console.log('🚀 Importing remaining categories...\n');
  let total = 0;
  for (const mapping of CATEGORY_MAPPING) {
    const count = await importCategory(mapping);
    total += count;
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n🎉 Done! Total imported: ${total} places`);
}

main().catch(console.error);