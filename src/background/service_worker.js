import { handleNavigation } from './navigationHandler.js';
import { getPredictor, isModelLoaded } from './modelManager.js';
import {
  isProtectionEnabled,
  getThreshold,
  setProtectionEnabled,
  setThreshold
} from '../utils/storage.js';

chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation);

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

const bypassedUrls = new Set();

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

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[HonEx] Extension installed. Pre-loading model...');
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
