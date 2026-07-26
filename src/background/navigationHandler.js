import { extractFeatures } from '../featureExtractor/featureBuilder.js';
import { getPredictor } from './modelManager.js';
import { isProtectionEnabled, getThreshold, getWarningMode, isNotificationsEnabled } from '../utils/storage.js';
import { PREDICTION, PREDICTION_ZONE, WARNING_PAGE, WARNING_MODES } from '../utils/constants.js';
import { analyzeWithAI, isAIAvailable } from '../ai/typosquattingDetector.js';
import { BRAND_NAMES } from '../ai/brands.js';

const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const KNOWN_TWO_PART_TLDS = Object.freeze([
  'co.id', 'or.id', 'ac.id', 'go.id', 'sch.id', 'web.id',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'co.jp', 'ne.jp', 'or.jp',
  'com.au', 'net.au', 'org.au',
  'com.br', 'org.br', 'net.br',
  'co.kr', 'or.kr', 'ne.kr'
]);

function isIpAddress(hostname) {
  return IPV4_REGEX.test(hostname) || (hostname.startsWith('[') && hostname.endsWith(']'));
}

function isSearchEngine(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (/^(www\.)?google\.(com|co\.\w{2}|\w{2})$/.test(hostname)) return true;
    if (/^.+\.google\.(com|co\.\w{2}|\w{2})$/.test(hostname)) return true;

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

async function resolveDomain(domain) {
  try {
    if (typeof chrome.dns?.resolve === 'function') {
      const result = await chrome.dns.resolve(domain);
      if (result?.addresses) {
        return { resolved: true, addresses: result.addresses, count: result.addresses.length };
      }
    }
  } catch {}
  return { resolved: false, addresses: [], count: 0 };
}

function extractSld(hostname) {
  const parts = hostname.toLowerCase().replace(/^www\./, '').split('.');
  if (parts.length < 2) return parts[0];
  const lastTwo = parts.slice(-2).join('.');
  if (KNOWN_TWO_PART_TLDS.includes(lastTwo) && parts.length >= 3) {
    return parts[parts.length - 3];
  }
  return parts[parts.length - 2];
}

function isExactBrandDomain(domain) {
  if (!domain) return false;
  return BRAND_NAMES.includes(extractSld(domain));
}

function isHighValueBrand(domain) {
  if (!domain) return false;
  const sld = extractSld(domain);
  return BRAND_NAMES.some(brand => sld === brand || sld.includes(brand));
}

export async function analyzeUrl(url, redirectHistory = new Map()) {
  try {
    if (shouldSkipUrl(url)) {
      return {
        prediction: PREDICTION.SAFE,
        probability: 0,
        zone: PREDICTION_ZONE.SAFE,
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

    if (domain && isIpAddress(domain)) {
      console.log(`[HonEx] PRE-FILTER PHISHING (IP address): ${url}`);
      return {
        prediction: PREDICTION.PHISHING,
        probability: 0.99,
        zone: PREDICTION_ZONE.PHISHING,
        error: null
      };
    }

    if (url.includes('@')) {
      console.log(`[HonEx] PRE-FILTER PHISHING (@ symbol): ${url}`);
      return {
        prediction: PREDICTION.PHISHING,
        probability: 0.95,
        zone: PREDICTION_ZONE.PHISHING,
        error: null
      };
    }

    if (domain && isExactBrandDomain(domain)) {
      console.log(`[HonEx] PRE-FILTER SAFE (known brand): ${domain}`);
      return {
        prediction: PREDICTION.SAFE,
        probability: 0,
        zone: PREDICTION_ZONE.SAFE,
        error: null
      };
    }

    const { features, featureMap, featureOrder } = extractFeatures(url, overrides);
    const result = predictor.predict(features);

    console.log(
      `[HonEx] analyzeUrl | url="${url}" prob=${result.probability.toFixed(4)} ` +
      `raw=${result.rawProbability.toFixed(4)} zone=${result.zone} ` +
      `threshold=${threshold} isPhishing=${result.isPhishing}`
    );

    if (result.zone === PREDICTION_ZONE.GRAY_ZONE) {
      const brandMatch = domain ? isHighValueBrand(domain) : false;
      if (brandMatch) {
        console.log(`[HonEx] GRAY ZONE — high-value brand domain detected: ${domain}, reclassifying as safe`);
        return {
          prediction: PREDICTION.SAFE,
          probability: result.probability,
          rawProbability: result.rawProbability,
          zone: PREDICTION_ZONE.SAFE,
          error: null
        };
      }

      const dnsResult = await resolveDomain(domain);
      if (dnsResult.resolved && !dnsResult.count) {
        console.log(`[HonEx] GRAY ZONE — domain tidak resolve: ${domain}, tetap flag phishing`);
        return {
          prediction: PREDICTION.PHISHING,
          probability: result.probability,
          rawProbability: result.rawProbability,
          zone: PREDICTION_ZONE.GRAY_ZONE,
          error: null
        };
      }

      const aiAvailable = await isAIAvailable();
      if (aiAvailable) {
        console.log(`[HonEx] GRAY ZONE — running AI analysis for: ${url}`);
        const aiResult = await analyzeWithAI(url, domain);
        if (aiResult) {
          console.log(`[HonEx] AI verdict: ${aiResult.verdict} — ${aiResult.reason}`);
          if (aiResult.verdict === 'phishing') {
            return {
              prediction: PREDICTION.PHISHING,
              probability: result.probability,
              rawProbability: result.rawProbability,
              zone: PREDICTION_ZONE.PHISHING,
              aiVerdict: aiResult.verdict,
              aiReason: aiResult.reason,
              error: null
            };
          }
          if (aiResult.verdict === 'legitimate') {
            return {
              prediction: PREDICTION.SAFE,
              probability: result.probability,
              rawProbability: result.rawProbability,
              zone: PREDICTION_ZONE.SAFE,
              aiVerdict: aiResult.verdict,
              aiReason: aiResult.reason,
              error: null
            };
          }
        }
      }
    }

    return {
      prediction: result.isPhishing ? PREDICTION.PHISHING : PREDICTION.SAFE,
      probability: result.probability,
      rawProbability: result.rawProbability,
      zone: result.zone,
      error: null
    };
  } catch (err) {
    console.error('[HonEx] Gagal menganalisis URL:', url, err);
    return {
      prediction: PREDICTION.ERROR,
      probability: 0,
      zone: PREDICTION_ZONE.SAFE,
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

async function showGrayZoneNotification(tabId, url, probability, warningMode) {
  console.log(
    `[HonEx] GRAY ZONE — suspicious tapi borderline: ${url} ` +
    `(confidence: ${(probability * 100).toFixed(1)}%)`
  );

  if (warningMode === WARNING_MODES.WARN || warningMode === WARNING_MODES.BLOCK) {
    const notifEnabled = await isNotificationsEnabled();
    if (notifEnabled) {
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/Logo.png'),
          title: 'HonEx — Mencurigakan (Borderline)',
          message: `URL ini terlihat mencurigakan: ${url}\nConfidence: ${(probability * 100).toFixed(1)}%`,
          priority: 1
        });
      } catch {}
    }
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

  if (result.zone === PREDICTION_ZONE.GRAY_ZONE) {
    await showGrayZoneNotification(details.tabId, details.url, result.probability, warningMode);
    return;
  }

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
