import { handleNavigation } from './navigationHandler.js';
import { getPredictor, isModelLoaded } from './modelManager.js';
import {
  isProtectionEnabled,
  getThreshold,
  setProtectionEnabled,
  setThreshold
} from '../utils/storage.js';

const redirectCounts = new Map();
const domainRedirectHistory = new Map();
const bypassedUrls = new Set();

function safeAddListener(name, event, callback) {
  if (event && typeof event.addListener === 'function') {
    event.addListener(callback);
    console.log('[HonEx] Listener registered:', name);
  } else {
    console.warn('[HonEx] Listener NOT available:', name);
  }
}

safeAddListener('onBeforeRedirect', chrome.webNavigation.onBeforeRedirect, (details) => {
  try {
    if (details.frameId !== 0) return;
    redirectCounts.set(details.tabId, (redirectCounts.get(details.tabId) || 0) + 1);
  } catch (err) {
    console.error('[HonEx] onBeforeRedirect callback error:', err, details);
  }
});

safeAddListener('onCompleted', chrome.webNavigation.onCompleted, (details) => {
  try {
    if (details.frameId !== 0) return;
    const count = redirectCounts.get(details.tabId) || 0;
    if (count > 0) {
      const domain = new URL(details.url).hostname;
      domainRedirectHistory.set(domain, count);
    }
  } catch (err) {
    console.error('[HonEx] onCompleted callback error:', err, details);
  } finally {
    try { redirectCounts.delete(details.tabId); } catch {}
  }
});

safeAddListener('onErrorOccurred', chrome.webNavigation.onErrorOccurred, (details) => {
  try {
    if (details.frameId !== 0) return;
    redirectCounts.delete(details.tabId);
  } catch (err) {
    console.error('[HonEx] onErrorOccurred callback error:', err, details);
  }
});

safeAddListener('onCommitted', chrome.webNavigation.onCommitted, (details) => {
  if (details.frameId !== 0) return;
  handleNavigation(details, bypassedUrls, domainRedirectHistory);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'CHECK_URL':
      handleCheckUrl(request, sender, sendResponse);
      return true;

    case 'GET_STATUS':
      handleGetStatus(sendResponse);
      return true;

    case 'SET_PROTECTION':
      handleSetProtection(request, sendResponse);
      return true;

    case 'SET_THRESHOLD':
      handleSetThreshold(request, sendResponse);
      return true;

    case 'BYPASS_URL':
      handleBypassUrl(request, sendResponse);
      return true;

    case 'NAVIGATE_TO_URL':
      handleNavigateToUrl(request, sendResponse);
      return true;

    case 'GO_BACK':
      handleGoBack(sender, sendResponse);
      return true;

    default:
      sendResponse({ error: `Unknown message type: ${request.type}` });
      return false;
  }
});

async function handleCheckUrl(request, sender, sendResponse) {
  try {
    const { analyzeUrl } = await import('./navigationHandler.js');
    if (bypassedUrls.has(request.url)) {
      sendResponse({ prediction: 'safe', probability: 0, bypassed: true });
      return;
    }
    const result = await analyzeUrl(request.url);
    sendResponse(result);
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleGetStatus(sendResponse) {
  try {
    const [protectionEnabled, threshold, modelLoaded] = await Promise.all([
      isProtectionEnabled(),
      getThreshold(),
      Promise.resolve(isModelLoaded())
    ]);
    sendResponse({ protectionEnabled, threshold, modelLoaded });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleSetProtection(request, sendResponse) {
  try {
    await setProtectionEnabled(request.enabled);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleSetThreshold(request, sendResponse) {
  try {
    await setThreshold(request.threshold);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

function handleBypassUrl(request, sendResponse) {
  try {
    bypassedUrls.add(request.url);
    setTimeout(() => bypassedUrls.delete(request.url), 30000);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleNavigateToUrl(request, sendResponse) {
  try {
    await chrome.tabs.update(request.tabId, { url: request.url, active: true });
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleGoBack(sender, sendResponse) {
  try {
    await chrome.tabs.goBack(sender.tab.id);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[HonEx] Extension installed. Pre-loading model...');

  if (details.reason === 'update') {
    const oldVersion = details.previousVersion;
    console.log(`[HonEx] Upgraded from v${oldVersion}. Migrating storage...`);
    try {
      const all = await chrome.storage.sync.get(null);
      if (Object.keys(all).length > 0) {
        const oldThreshold = all.threshold;
        if (oldThreshold !== undefined && oldThreshold < 0.85) {
          await chrome.storage.sync.set({ threshold: 0.85 });
          console.log('[HonEx] Threshold migrated from', oldThreshold, 'to 0.85');
        }
      }
    } catch {}
  }

  try {
    await getPredictor();
    console.log('[HonEx] Model loaded successfully');
  } catch (err) {
    console.error('[HonEx] Gagal memuat model saat install:', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[HonEx] Browser startup. Loading model...');
  try {
    await getPredictor();
    console.log('[HonEx] Model loaded successfully');
  } catch (err) {
    console.error('[HonEx] Gagal memuat model saat startup:', err);
  }
});
