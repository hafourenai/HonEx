const VERSION = '1.0.0';

async function init() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const protectionBadge = document.getElementById('protectionBadge');
  const heroTitle = document.getElementById('heroTitle');
  const heroDesc = document.getElementById('heroDesc');
  const toggle = document.getElementById('toggleProtection');
  const modelStatus = document.getElementById('modelStatus');
  const versionInfo = document.getElementById('versionInfo');

  versionInfo.textContent = `Version ${VERSION}`;

  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

  if (!response) {
    statusDot.className = 'w-2 h-2 rounded bg-gray-400';
    statusText.textContent = 'Extension not running';
    return;
  }

  const isActive = response.protectionEnabled !== false;
  const modelLoaded = response.modelLoaded;

  updateStatus(isActive, statusDot, statusText, protectionBadge, heroTitle, heroDesc, toggle);
  updateModelStatus(modelLoaded, modelStatus);

  toggle.addEventListener('change', async () => {
    const now = toggle.checked;
    await chrome.runtime.sendMessage({ type: 'SET_PROTECTION', enabled: now });
    updateStatus(now, statusDot, statusText, protectionBadge, heroTitle, heroDesc, toggle);
  });
}

function updateStatus(isActive, statusDot, statusText, protectionBadge, heroTitle, heroDesc, toggle) {
  if (isActive) {
    statusDot.className = 'w-2 h-2 rounded bg-green-500';
    statusText.textContent = 'Active';
    protectionBadge.textContent = 'Protection Active';
    heroTitle.textContent = 'All secure';
    heroDesc.textContent = 'HonEx is analyzing every URL you visit.';
  } else {
    statusDot.className = 'w-2 h-2 rounded bg-red-500';
    statusText.textContent = 'Inactive';
    protectionBadge.textContent = 'Protection Disabled';
    heroTitle.textContent = 'Protection is off';
    heroDesc.textContent = 'Websites are not being checked for phishing.';
  }
  toggle.checked = isActive;
}

function updateModelStatus(loaded, el) {
  if (loaded) {
    el.textContent = 'Random Forest classifier — Loaded';
    el.className = 'text-xs text-on-surface-variant mt-0.5';
  } else {
    el.textContent = 'Random Forest classifier — Loading...';
    el.className = 'text-xs text-amber-600 mt-0.5';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
