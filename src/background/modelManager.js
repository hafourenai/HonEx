import { Predictor } from '../ml/predictor.js';
import { validateModel } from '../ml/forestLoader.js';

let predictorInstance = null;
let loadPromise = null;

async function loadModel() {
  const modelUrl = chrome.runtime.getURL('ml/rf_trees.json');
  const response = await fetch(modelUrl);

  if (!response.ok) {
    throw new Error(`Gagal memuat model: HTTP ${response.status}`);
  }

  const modelJson = await response.json();
  validateModel(modelJson);

  predictorInstance = new Predictor(modelJson);
  return predictorInstance;
}

export async function getPredictor() {
  if (predictorInstance) {
    return predictorInstance;
  }

  if (!loadPromise) {
    loadPromise = loadModel().catch(err => {
      loadPromise = null;
      throw err;
    });
  }

  return loadPromise;
}

export function isModelLoaded() {
  return predictorInstance !== null;
}

export function resetModel() {
  predictorInstance = null;
  loadPromise = null;
}
