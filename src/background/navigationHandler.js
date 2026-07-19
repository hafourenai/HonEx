import { extractFeatures } from '../featureExtractor/featureBuilder.js';
import { getPredictor } from './modelManager.js';
import { isProtectionEnabled, getThreshold, getWarningMode, isNotificationsEnabled } from '../utils/storage.js';
import { PREDICTION, WARNING_PAGE, WARNING_MODES } from '../utils/constants.js';

const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isIpAddress(hostname) {
  return IPV4_REGEX.test(hostname) || (hostname.startsWith('[') && hostname.endsWith(']'));
}

function isSearchEngine(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Google dan semua varian negaranya (google.com, google.co.id, google.de, dll)
    if (/^(www\.)?google\.(com|co\.\w{2}|\w{2})$/.test(hostname)) return true;
    if (/^.+\.google\.(com|co\.\w{2}|\w{2})$/.test(hostname)) return true;

    // Search engine lainnya
    const domains = ['bing.com', 'duckduckgo.com', 'search.yahoo.com', 'yandex.com', 'baidu.com'];
    return domains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

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

  if (isSearchEngine(url)) return true;

  return false;
}

export async function analyzeUrl(url, redirectHistory = new Map()) {
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

    let overrides = {};
    let domain = '';
    try {
      domain = new URL(url).hostname;
      const cachedRedirects = redirectHistory?.get(domain);
      if (cachedRedirects !== undefined) {
        overrides.qty_redirects = cachedRedirects;
      }
    } catch {}

    // Pre-filter: obvious phishing patterns (bypass ML entirely)
    if (domain && isIpAddress(domain)) {
      console.log(`[HonEx] PRE-FILTER PHISHING (IP address): ${url}`);
      return {
        prediction: PREDICTION.PHISHING,
        probability: 0.99,
        error: null
      };
    }

    if (url.includes('@')) {
      console.log(`[HonEx] PRE-FILTER PHISHING (@ symbol): ${url}`);
      return {
        prediction: PREDICTION.PHISHING,
        probability: 0.95,
        error: null
      };
    }

    const { features, featureMap, featureOrder } = extractFeatures(url, overrides);
    const result = predictor.predict(features);

    console.log(
      `[HonEx] analyzeUrl | url="${url}" prob=${result.probability.toFixed(4)} threshold=${threshold} isPhishing=${result.isPhishing}`
    );
    console.log('[HonEx] feature debug:', featureOrder.map((name, i) => `${name}=${features[i]}`).join(' '));

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

export async function handleNavigation(details, bypassedUrls = new Set(), domainRedirectHistory = new Map()) {
  if (details.frameId !== 0) return;

  if (bypassedUrls.has(details.url)) return;

  const protectionEnabled = await isProtectionEnabled();
  if (!protectionEnabled) return;

  const warningMode = await getWarningMode();
  if (warningMode === WARNING_MODES.LOG) return;

  const result = await analyzeUrl(details.url, domainRedirectHistory);

  if (result.prediction === PREDICTION.PHISHING) {
    console.log(
      `[HonEx] PHISHING DETECTED: ${details.url} ` +
      `(confidence: ${(result.probability * 100).toFixed(1)}%)`
    );

    if (warningMode === WARNING_MODES.BLOCK) {
      await redirectToWarning(details.tabId, details.url, result.probability);
    } else if (warningMode === WARNING_MODES.WARN) {
      const notifEnabled = await isNotificationsEnabled();
      if (notifEnabled) {
        try {
          await chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/Logo.png'),
            title: 'HonEx - Phishing Alert',
            message: `Warning: ${details.url}\nConfidence: ${(result.probability * 100).toFixed(1)}%`,
            priority: 2
          });
        } catch {}
      }
    }
  }
}
