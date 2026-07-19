const BADGE_ACTIVE = { text: 'Active', className: '' };
const BADGE_INACTIVE = { text: 'Inactive', className: 'inactive' };

const STATUS_ACTIVE = { text: 'Protection Active', dotClass: '' };
const STATUS_INACTIVE = { text: 'Protection Disabled', dotClass: 'inactive' };

async function init() {
  const statusBadge = document.getElementById('statusBadge');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const toggle = document.getElementById('toggleProtection');
  const modelInfo = document.getElementById('modelInfo');

  const all = await chrome.storage.sync.get(null);
  const theme = all.theme || 'light';
  document.body.classList.toggle('dark', theme === 'dark');

  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

  const isActive = response.protectionEnabled !== false;

  updateUI(isActive, statusBadge, statusDot, statusText, toggle);

  modelInfo.textContent = `Random Forest | ${response.modelLoaded ? 'Model Loaded' : 'Loading...'}`;

  toggle.addEventListener('click', async () => {
    const currentlyActive = toggle.classList.contains('active');
    const newState = !currentlyActive;

    await chrome.runtime.sendMessage({
      type: 'SET_PROTECTION',
      enabled: newState
    });

    updateUI(newState, statusBadge, statusDot, statusText, toggle);
  });

  document.getElementById('menuSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('menuAbout').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
  });
}

function updateUI(isActive, statusBadge, statusDot, statusText, toggle) {
  const badge = isActive ? BADGE_ACTIVE : BADGE_INACTIVE;
  const status = isActive ? STATUS_ACTIVE : STATUS_INACTIVE;

  statusBadge.textContent = badge.text;
  statusBadge.className = 'status-badge' + (badge.className ? ' ' + badge.className : '');

  statusDot.className = 'status-dot' + (status.dotClass ? ' ' + status.dotClass : '');
  statusText.textContent = status.text;

  toggle.className = 'toggle' + (isActive ? ' active' : '');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}