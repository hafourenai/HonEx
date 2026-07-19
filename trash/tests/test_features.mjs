/**
 * test_features.mjs — Verifikasi end-to-end Feature Extractor + Random Forest
 *
 * Jalankan: node test_features.mjs
 */

import { readFile } from 'fs/promises';
import { extractFeatures, getFeatureOrder, getExternalFeatures } from './src/featureExtractor/index.js';
import { parseUrl } from './src/featureExtractor/urlParser.js';
import { Predictor } from './src/ml/index.js';

const SEP = '='.repeat(60);

async function main() {
  console.log(SEP);
  console.log('VERIFIKASI FEATURE EXTRACTOR + RANDOM FOREST');
  console.log(SEP);

  // ── 1. Feature Order Check ──
  console.log('\n[1] Feature order check...');
  const featureOrderJson = JSON.parse(await readFile('./hasil/feature_order.json', 'utf-8'));
  const engineOrder = getFeatureOrder();

  if (JSON.stringify(featureOrderJson) === JSON.stringify(engineOrder)) {
    console.log(`    OK — ${engineOrder.length} fitur, urutan identik dengan feature_order.json`);
  } else {
    console.log('    FAIL — urutan tidak cocok!');
    for (let i = 0; i < featureOrderJson.length; i++) {
      if (featureOrderJson[i] !== engineOrder[i]) {
        console.log(`    [${i}] expected: "${featureOrderJson[i]}", got: "${engineOrder[i]}"`);
      }
    }
    process.exit(1);
  }

  // ── 2. URL Parser Tests ──
  console.log('\n[2] URL Parser tests...');
  const parserTests = [
    {
      url: 'https://www.example.com/path/to/page.html?id=1&lang=en',
      expect: { domain: 'www.example.com', directory: '/path/to', file: 'page.html', params: 'id=1&lang=en' }
    },
    {
      url: 'http://evil-site.com/login/',
      expect: { domain: 'evil-site.com', directory: '/login', file: '', params: '' }
    },
    {
      url: 'https://sub.domain.co.uk/a/b/c',
      expect: { domain: 'sub.domain.co.uk', directory: '/a/b', file: 'c', params: '' }
    },
    {
      url: 'example.com',
      expect: { domain: 'example.com', directory: '', file: '', params: '' }
    },
    {
      url: '',
      expect: { valid: false }
    }
  ];

  for (const tc of parserTests) {
    const result = parseUrl(tc.url);
    if (tc.expect.valid === false) {
      console.log(`    "${tc.url}" → valid=${result.valid} (expected invalid) — ${result.valid === false ? 'OK' : 'FAIL'}`);
      continue;
    }
    const checks = Object.entries(tc.expect).every(([k, v]) => result[k] === v);
    console.log(`    "${tc.url}" → ${checks ? 'OK' : 'FAIL'}`);
    if (!checks) {
      console.log('      expected:', tc.expect);
      console.log('      got:', { domain: result.domain, directory: result.directory, file: result.file, params: result.params });
    }
  }

  // ── 3. Feature Extraction Tests ──
  console.log('\n[3] Feature extraction tests...');

  const testUrls = [
    'https://www.google.com/',
    'https://secure-login.paypal.com.evil-site.net/signin/confirm.php?user=test@email.com&token=abc123',
    'http://192.168.1.1/admin/panel.html',
    'https://docs.github.com/en/repositories/creating-and-managing-repositories',
    'https://phishing-test.com/login%20page/confirm*action@redirect?q=test%25value&r=http://evil.com/steal',
  ];

  for (const url of testUrls) {
    const result = extractFeatures(url);
    console.log(`\n    URL: ${url}`);
    console.log(`    Vector length: ${result.features.length}`);
    console.log(`    Has NaN: ${result.features.some(v => Number.isNaN(v))}`);

    const highlights = [
      `length_url=${result.featureMap.length_url}`,
      `domain_length=${result.featureMap.domain_length}`,
      `directory_length=${result.featureMap.directory_length}`,
      `email_in_url=${result.featureMap.email_in_url}`,
      `qty_dot_url=${result.featureMap.qty_dot_url}`,
      `qty_at_url=${result.featureMap.qty_at_url}`,
    ];
    console.log(`    Key features: ${highlights.join(', ')}`);

    if (result.warnings.length > 0) {
      console.log(`    Warnings: ${result.warnings.length}`);
    }
  }

  // ── 4. External Features Documentation ──
  console.log('\n[4] External features report...');
  const external = getExternalFeatures();
  for (const [name, info] of Object.entries(external)) {
    console.log(`    ${name}: default=${info.defaultValue} — ${info.reason}`);
  }

  // ── 5. Override Test ──
  console.log('\n[5] Override test (qty_redirects)...');
  const overrideResult = extractFeatures('https://example.com/path', { qty_redirects: 3, qty_mx_servers: 2 });
  console.log(`    qty_redirects: ${overrideResult.featureMap.qty_redirects} (expected: 3)`);
  console.log(`    qty_mx_servers: ${overrideResult.featureMap.qty_mx_servers} (expected: 2)`);
  console.log(`    Warnings with override: ${overrideResult.warnings.filter(w => w.includes('qty_redirects') || w.includes('qty_mx_servers')).length} (expected: 0)`);

  // ── 6. Determinism Test ──
  console.log('\n[6] Determinism test...');
  const url = 'https://www.example.com/path/to/page.html?id=1&lang=en';
  const r1 = extractFeatures(url);
  const r2 = extractFeatures(url);
  const r3 = extractFeatures(url);
  const identical = JSON.stringify(r1.features) === JSON.stringify(r2.features)
                 && JSON.stringify(r2.features) === JSON.stringify(r3.features);
  console.log(`    3 runs identical: ${identical ? 'OK' : 'FAIL'}`);

  // ── 7. End-to-End: Feature Extraction → RF Prediction ──
  console.log('\n[7] End-to-end: extractFeatures → Predictor.predict...');
  const raw = await readFile('./src/ml/rf_trees.json', 'utf-8');
  const modelJson = JSON.parse(raw);
  const predictor = new Predictor(modelJson);

  const e2eUrls = [
    { url: 'https://www.google.com/', label: 'Google (safe)' },
    { url: 'https://secure-login.paypal.com.evil-site.net/signin/confirm.php?user=test@email.com&token=abc123', label: 'Phishing (fake PayPal)' },
    { url: 'https://github.com/', label: 'GitHub (safe)' },
    { url: 'http://192.168.1.1/admin/panel.html', label: 'Local IP (ambiguous)' },
    { url: 'https://amaz0n-secure.com/account/verify-identity.html?ref=email&session=a1b2c3d4e5f6', label: 'Phishing (fake Amazon)' },
    { url: 'https://www.wikipedia.org/wiki/Machine_learning', label: 'Wikipedia (safe)' },
  ];

  for (const { url: testUrl, label } of e2eUrls) {
    const feat = extractFeatures(testUrl);
    const pred = predictor.predict(feat.features);
    const status = pred.isPhishing ? 'PHISHING' : 'SAFE';
    const bar = '█'.repeat(Math.round(pred.probability * 20)) + '░'.repeat(20 - Math.round(pred.probability * 20));
    console.log(`    [${status.padEnd(8)}] ${bar} ${(pred.probability * 100).toFixed(1)}% — ${label}`);
  }

  // ── 8. Invalid URL Handling ──
  console.log('\n[8] Invalid URL handling...');
  const invalidUrls = ['', null, undefined, 'not a url at all !!!', '://missing-scheme'];
  for (const badUrl of invalidUrls) {
    const result = extractFeatures(badUrl);
    const allZeroOrValid = result.features.every(v => typeof v === 'number' && !Number.isNaN(v));
    console.log(`    "${badUrl}" → vector OK: ${allZeroOrValid}, warnings: ${result.warnings.length}`);
  }

  console.log('\n' + SEP);
  console.log('SEMUA TEST BERHASIL');
  console.log(SEP);
}

main().catch(err => {
  console.error('GAGAL:', err);
  process.exit(1);
});
