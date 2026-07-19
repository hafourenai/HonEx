const STORAGE_KEYS = {
  PROTECTION_ENABLED: 'protectionEnabled',
  THEME: 'theme',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  WARNING_MODE: 'warningMode'
};

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
}

async function init() {
  const toggleProtection = document.getElementById('toggleProtection');
  const toggleNotifications = document.getElementById('toggleNotifications');
  const selectTheme = document.getElementById('selectTheme');
  const selectWarningMode = document.getElementById('selectWarningMode');
  const statusMsg = document.getElementById('statusMsg');

  const all = await chrome.storage.sync.get(null);

  const protection = all.protectionEnabled !== false;
  const notifications = all.notificationsEnabled !== false;
  const theme = all.theme || 'light';
  const warningMode = all.warningMode || 'block';

  applyTheme(theme);

  toggleProtection.classList.toggle('active', protection);
  toggleNotifications.classList.toggle('active', notifications);
  selectTheme.value = theme;
  selectWarningMode.value = warningMode;

  let saveTimer;

  function saveSetting(key, value) {
    chrome.storage.sync.set({ [key]: value });
    clearTimeout(saveTimer);
    statusMsg.style.display = 'block';
    saveTimer = setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
  }

  toggleProtection.addEventListener('click', () => {
    const now = toggleProtection.classList.toggle('active');
    saveSetting(STORAGE_KEYS.PROTECTION_ENABLED, now);
  });

  toggleNotifications.addEventListener('click', () => {
    const now = toggleNotifications.classList.toggle('active');
    saveSetting(STORAGE_KEYS.NOTIFICATIONS_ENABLED, now);
  });

  selectTheme.addEventListener('change', () => {
    const val = selectTheme.value;
    applyTheme(val);
    saveSetting(STORAGE_KEYS.THEME, val);
  });

  selectWarningMode.addEventListener('change', () => {
    saveSetting(STORAGE_KEYS.WARNING_MODE, selectWarningMode.value);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}