/**
 * Data Equality Verification Script
 * 
 * Compares product data between OpenSearch (ProductList) and API (ProductPage)
 * to ensure 100% data equality.
 */
require('dotenv').config();
const { Client } = require('@opensearch-project/opensearch');

const OS_NODE = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const INDEX_NAME = 'products';

const osClient = new Client({ node: OS_NODE });

async function fetchFromOpenSearch(id) {
  try {
    const result = await osClient.get({ index: INDEX_NAME, id });
    return result.body._source;
  } catch (err) {
    console.error(`OpenSearch error for ${id}:`, err.message);
    return null;
  }
}

async function fetchFromAPI(slug) {
  try {
    const res = await fetch(`${BACKEND_URL}/store/automotive/products/${slug}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.product;
  } catch (err) {
    console.error(`API error for ${slug}:`, err.message);
    return null;
  }
}

function compareFields(osDoc, apiDoc) {
  const checks = [
    { field: 'price', os: osDoc.price, api: apiDoc.price, critical: true },
    { field: 'brand', os: osDoc.brand, api: apiDoc.brand, critical: true },
    { field: 'in_stock', os: osDoc.in_stock, api: apiDoc.in_stock, critical: true },
    { field: 'stock_quantity', os: osDoc.stock_quantity, api: apiDoc.stock_quantity, critical: true },
    { field: 'is_universal', os: osDoc.is_universal, api: apiDoc.is_universal, critical: true },
    { field: 'lead_time_days', os: osDoc.lead_time_days, api: apiDoc.lead_time_days, critical: false },
    { field: 'ean', os: osDoc.ean, api: apiDoc.ean, critical: false },
    { field: 'mpn', os: osDoc.mpn, api: apiDoc.mpn, critical: false },
    { field: 'title', os: osDoc.title, api: apiDoc.title, critical: true },
    { field: 'sku', os: osDoc.sku, api: apiDoc.sku, critical: true },
    { field: 'image_url', os: osDoc.image_url, api: apiDoc.image_url, critical: false },
  ];

  const failures = [];
  for (const check of checks) {
    if (check.os !== check.api) {
      failures.push({
        field: check.field,
        os: check.os,
        api: check.api,
        critical: check.critical
      });
    }
  }

  // Check vehicle_type_ids
  const osVehicles = (osDoc.vehicle_type_ids || []).sort();
  const apiVehicles = (apiDoc.vehicle_type_ids || []).sort();
  if (JSON.stringify(osVehicles) !== JSON.stringify(apiVehicles)) {
    failures.push({
      field: 'vehicle_type_ids',
      os: osVehicles.length,
      api: apiVehicles.length,
      critical: true
    });
  }

  return failures;
}

async function verifySampleProducts(count = 10) {
  console.log(`\n🔍 Verifying ${count} random products for data equality...\n`);
  
  // Get random sample from OpenSearch
  const searchResult = await osClient.search({
    index: INDEX_NAME,
    body: {
      size: count,
      query: { function_score: { query: { match_all: {} }, random_score: {} } }
    }
  });

  const products = searchResult.body.hits.hits.map(h => h._source);
  let passed = 0;
  let failed = 0;
  const allFailures = [];

  for (const osDoc of products) {
    const apiDoc = await fetchFromAPI(osDoc.slug || osDoc.id);
    
    if (!apiDoc) {
      console.log(`❌ ${osDoc.sku}: API returned null`);
      failed++;
      continue;
    }

    const failures = compareFields(osDoc, apiDoc);
    
    if (failures.length === 0) {
      console.log(`✅ ${osDoc.sku}: All fields match`);
      passed++;
    } else {
      const criticalCount = failures.filter(f => f.critical).length;
      console.log(`❌ ${osDoc.sku}: ${failures.length} differences (${criticalCount} critical)`);
      failures.forEach(f => {
        console.log(`   - ${f.field}: OS="${f.os}" vs API="${f.api}"${f.critical ? ' ⚠️' : ''}`);
      });
      failed++;
      allFailures.push({ sku: osDoc.sku, failures });
    }
  }

  console.log(`\n📊 Summary: ${passed}/${count} products match (${failed} failures)\n`);
  
  if (allFailures.length > 0) {
    console.log('Failed products:', allFailures.map(f => f.sku).join(', '));
  }

  return { passed, failed, total: count };
}

verifySampleProducts(20);
