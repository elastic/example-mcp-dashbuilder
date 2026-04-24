/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Seed a small `test_ecommerce` index with documents covering
 * the field types the MCP tools expect: keyword, date, numeric, geo_point.
 */

interface EcommerceDoc {
  order_date: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_gender: string;
  category: string;
  currency: string;
  products: Array<{
    product_name: string;
    price: number;
    quantity: number;
  }>;
  taxful_total_price: number;
  order_id: string;
  geoip: { location: { lat: number; lon: number } };
}

const CATEGORIES = ["Men's Clothing", "Women's Clothing", "Men's Shoes", "Women's Accessories"];
const CURRENCIES = ['EUR', 'USD', 'GBP'];
const NAMES_FIRST = ['Eddie', 'Mary', 'Gwen', 'Diane', 'Stephanie', 'Jim', 'Oliver', 'Sonya'];
const NAMES_LAST = [
  'Underwood',
  'Bailey',
  'Butler',
  'Chandler',
  'Evans',
  'Foster',
  'Grant',
  'Hart',
];
const PRODUCTS = [
  'Basic T-Shirt',
  'Casual Sneakers',
  'Leather Belt',
  'Denim Jacket',
  'Wool Scarf',
  'Running Shoes',
  'Cotton Hoodie',
  'Canvas Bag',
];

function generateDocs(count: number): EcommerceDoc[] {
  const docs: EcommerceDoc[] = [];
  const baseDate = new Date('2025-01-01T00:00:00Z');

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate.getTime() + i * 86_400_000);
    const price = Math.round((10 + Math.random() * 190) * 100) / 100;
    const qty = 1 + Math.floor(Math.random() * 3);

    docs.push({
      order_date: date.toISOString(),
      customer_first_name: NAMES_FIRST[i % NAMES_FIRST.length],
      customer_last_name: NAMES_LAST[i % NAMES_LAST.length],
      customer_gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
      category: CATEGORIES[i % CATEGORIES.length],
      currency: CURRENCIES[i % CURRENCIES.length],
      products: [
        {
          product_name: PRODUCTS[i % PRODUCTS.length],
          price,
          quantity: qty,
        },
      ],
      taxful_total_price: Math.round(price * qty * 1.2 * 100) / 100,
      order_id: `${1000 + i}`,
      geoip: {
        location: {
          lat: 33.0 + Math.random() * 20,
          lon: -118.0 + Math.random() * 50,
        },
      },
    });
  }

  return docs;
}

export const TEST_INDEX = 'test_ecommerce';

export async function seedTestData(esUrl: string, password: string): Promise<void> {
  const authHeader = `Basic ${Buffer.from(`elastic:${password}`).toString('base64')}`;
  console.log(`🌱 Seeding ${TEST_INDEX} index…`);

  // Create index with explicit mappings
  const mappings = {
    mappings: {
      properties: {
        order_date: { type: 'date' },
        customer_first_name: { type: 'keyword' },
        customer_last_name: { type: 'keyword' },
        customer_gender: { type: 'keyword' },
        category: { type: 'keyword' },
        currency: { type: 'keyword' },
        order_id: { type: 'keyword' },
        taxful_total_price: { type: 'double' },
        products: {
          type: 'nested',
          properties: {
            product_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            price: { type: 'double' },
            quantity: { type: 'integer' },
          },
        },
        geoip: {
          properties: {
            location: { type: 'geo_point' },
          },
        },
      },
    },
  };

  const createRes = await fetch(`${esUrl}/${TEST_INDEX}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(mappings),
  });

  if (!createRes.ok) {
    throw new Error(`Index creation failed: ${createRes.status} ${await createRes.text()}`);
  }

  // Bulk index documents
  const docs = generateDocs(20);
  const bulkBody =
    docs
      .flatMap((doc, i) => [
        JSON.stringify({ index: { _index: TEST_INDEX, _id: `${i}` } }),
        JSON.stringify(doc),
      ])
      .join('\n') + '\n';

  const bulkRes = await fetch(`${esUrl}/_bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson', Authorization: authHeader },
    body: bulkBody,
  });

  if (!bulkRes.ok) {
    throw new Error(`Bulk indexing failed: ${bulkRes.status} ${await bulkRes.text()}`);
  }

  // Refresh to make docs searchable
  await fetch(`${esUrl}/${TEST_INDEX}/_refresh`, {
    method: 'POST',
    headers: { Authorization: authHeader },
  });

  console.log(`✅ Seeded ${docs.length} documents into ${TEST_INDEX}`);
}
