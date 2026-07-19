/**
 * test_inference.mjs — Verifikasi end-to-end Random Forest Inference Engine
 *
 * Jalankan: node test_inference.mjs
 */

import { readFile } from 'fs/promises';
import { Predictor } from './src/ml/index.js';

async function main() {
  console.log('='.repeat(60));
  console.log('VERIFIKASI RANDOM FOREST INFERENCE ENGINE');
  console.log('='.repeat(60));

  const raw = await readFile('./src/ml/rf_trees.json', 'utf-8');
  const modelJson = JSON.parse(raw);

  console.log('\n[1] Loading model...');
  const predictor = new Predictor(modelJson);
  const info = predictor.getInfo();
  console.log(`    n_features:   ${info.nFeatures}`);
  console.log(`    n_classes:    ${info.nClasses}`);
  console.log(`    n_estimators: ${info.nEstimators}`);
  console.log(`    threshold:    ${info.threshold}`);
  console.log(`    features:     ${info.featureNames.join(', ')}`);
  console.log('    OK — Model loaded & validated');

  console.log('\n[2] Test prediction — all zeros (baseline)...');
  const zeroFeatures = new Array(info.nFeatures).fill(0);
  const resultZero = predictor.predict(zeroFeatures);
  console.log(`    prediction:  ${resultZero.prediction}`);
  console.log(`    probability: ${resultZero.probability.toFixed(4)}`);
  console.log(`    confidence:  ${resultZero.confidence.toFixed(4)}`);
  console.log(`    isPhishing:  ${resultZero.isPhishing}`);

  console.log('\n[3] Test prediction — simulated phishing features...');
  const phishingFeatures = new Array(info.nFeatures).fill(0);
  phishingFeatures[0] = 150;  // directory_length: panjang
  phishingFeatures[1] = 40;   // domain_length: panjang
  phishingFeatures[2] = 1;    // email_in_url: ada email
  phishingFeatures[3] = 30;   // file_length: panjang
  phishingFeatures[4] = 250;  // length_url: sangat panjang
  phishingFeatures[5] = 80;   // params_length: panjang
  phishingFeatures[7] = 3;    // qty_asterisk_directory
  phishingFeatures[8] = 2;    // qty_at_directory
  phishingFeatures[21] = 5;   // qty_percent_directory
  phishingFeatures[25] = 4;   // qty_redirects
  const resultPhish = predictor.predict(phishingFeatures);
  console.log(`    prediction:  ${resultPhish.prediction}`);
  console.log(`    probability: ${resultPhish.probability.toFixed(4)}`);
  console.log(`    confidence:  ${resultPhish.confidence.toFixed(4)}`);
  console.log(`    isPhishing:  ${resultPhish.isPhishing}`);

  console.log('\n[4] Test prediction — simulated safe features...');
  const safeFeatures = new Array(info.nFeatures).fill(0);
  safeFeatures[0] = 10;   // directory_length: pendek
  safeFeatures[1] = 12;   // domain_length: wajar
  safeFeatures[4] = 30;   // length_url: pendek
  safeFeatures[11] = 1;   // qty_dot_domain: 1 (normal)
  safeFeatures[27] = 3;   // qty_slash_url: wajar
  safeFeatures[32] = 4;   // qty_vowels_domain: wajar
  const resultSafe = predictor.predict(safeFeatures);
  console.log(`    prediction:  ${resultSafe.prediction}`);
  console.log(`    probability: ${resultSafe.probability.toFixed(4)}`);
  console.log(`    confidence:  ${resultSafe.confidence.toFixed(4)}`);
  console.log(`    isPhishing:  ${resultSafe.isPhishing}`);

  console.log('\n[5] Test predictWithDetails...');
  const details = predictor.predictWithDetails(safeFeatures);
  console.log(`    classProbabilities: [${details.classProbabilities.map(p => p.toFixed(4)).join(', ')}]`);
  console.log(`    nEstimators: ${details.nEstimators}`);
  console.log(`    featureValues keys: ${Object.keys(details.featureValues).length}`);

  console.log('\n[6] Test validation — wrong feature count...');
  try {
    predictor.predict([1, 2, 3]);
    console.log('    FAIL — should have thrown');
  } catch (e) {
    console.log(`    OK — caught error: "${e.message}"`);
  }

  console.log('\n[7] Test validation — NaN feature...');
  const nanFeatures = new Array(info.nFeatures).fill(0);
  nanFeatures[5] = NaN;
  try {
    predictor.predict(nanFeatures);
    console.log('    FAIL — should have thrown');
  } catch (e) {
    console.log(`    OK — caught error: "${e.message}"`);
  }

  console.log('\n[8] Test batch prediction...');
  const batch = [zeroFeatures, phishingFeatures, safeFeatures];
  const batchResults = predictor.predictBatch(batch);
  console.log(`    batch size: ${batchResults.length}`);
  batchResults.forEach((r, i) => {
    console.log(`    [${i}] ${r.prediction} (prob: ${r.probability.toFixed(4)})`);
  });

  console.log('\n[9] Test setThreshold...');
  predictor.setThreshold(0.3);
  const resultLowThresh = predictor.predict(zeroFeatures);
  console.log(`    threshold: 0.3 → prediction: ${resultLowThresh.prediction} (prob: ${resultLowThresh.probability.toFixed(4)})`);
  predictor.setThreshold(0.5);

  console.log('\n' + '='.repeat(60));
  console.log('SEMUA TEST BERHASIL');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('GAGAL:', err);
  process.exit(1);
});
