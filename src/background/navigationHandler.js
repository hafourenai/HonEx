import { extractFeatures } from '../featureExtractor/featureBuilder.js';
import { getPredictor } from './modelManager.js';
import { isProtectionEnabled, getThreshold, getWarningMode } from '../utils/storage.js';
import { PREDICTION, WARNING_PAGE, WARNING_MODES } from '../utils/constants.js';

function shouldSkipUrl(url) {
  if (!url) return true;

  if (url.startsWith('chrome-extension://')) return true;
  if (url.startsWith('chrome://')) return true;
  if (url.startsWith('about:')) return true;
  if (url.startsWith('edge://')) return true;
  if (url.startsWith('data:')) return true;
  if (url.startsWith('file://')) return true;
  if (url.startsWith('blob:')) return true;
  if (url.startsWith('javascript:')) return true;

  if (url.includes(WARNING_PAGE.PATH)) return true;

  return false;
}

export async function analyzeUrl(url) {
  try {
    if (shouldSkipUrl(url)) {
      return {
        prediction: PREDICTION.SAFE,
        probability: 0,
        error: null
      };
    }

    const predictor = await getPredictor();
    const threshold = await getThreshold();
    predictor.setThreshold(threshold);

    const { features } = extractFeatures(url);
    const result = predictor.predict(features);

    return {
      prediction: result.isPhishing ? PREDICTION.PHISHING : PREDICTION.SAFE,
      probability: result.probability,
      error: null
    };
  } catch (err) {
    console.error('[HonEx] Gagal menganalisis URL:', url, err);
    return {
      prediction: PREDICTION.ERROR,
      probability: 0,
      error: err.message
    };
  }
}

async function redirectToWarning(tabId, targetUrl, probability) {
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedProb = encodeURIComponent(probability.toString());
  const warningUrl = chrome.runtime.getURL(
    `${WARNING_PAGE.PATH}?${WARNING_PAGE.URL_PARAM}=${encodedUrl}&${WARNING_PAGE.PROB_PARAM}=${encodedProb}`
  );

  try {
    await chrome.tabs.update(tabId, { url: warningUrl });
  } catch (err) {
    console.error('[HonEx] Gagal redirect ke warning page:', err);
  }
}

export async function handleNavigation(details) {
  if (details.frameId !== 0) return;

  const protectionEnabled = await isProtectionEnabled();
  if (!protectionEnabled) return;

  const warningMode = await getWarningMode();
  if (warningMode === WARNING_MODES.LOG) return;

  const result = await analyzeUrl(details.url);

  if (result.prediction === PREDICTION.PHISHING) {
    console.log(
      `[HonEx] PHISHING DETECTED: ${details.url} ` +
      `(confidence: ${(result.probability * 100).toFixed(1)}%)`
    );

    if (warningMode === WARNING_MODES.BLOCK) {
      await redirectToWarning(details.tabId, details.url, result.probability);
    }
  }
}
