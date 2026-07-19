import { STORAGE_KEYS, DEFAULTS } from './constants.js';

export async function get(key) {
  try {
    if (key) {
      const result = await chrome.storage.sync.get(key);
      return result[key] !== undefined ? result[key] : DEFAULTS[key];
    }
    const result = await chrome.storage.sync.get(null);
    return { ...DEFAULTS, ...result };
  } catch {
    if (key) return DEFAULTS[key];
    return { ...DEFAULTS };
  }
}

export async function set(keyOrMap, value) {
  try {
    if (typeof keyOrMap === 'string') {
      await chrome.storage.sync.set({ [keyOrMap]: value });
    } else {
      await chrome.storage.sync.set(keyOrMap);
    }
  } catch {
    console.warn('[HonEx] Gagal menyimpan ke storage');
  }
}

export async function isProtectionEnabled() {
  return get(STORAGE_KEYS.PROTECTION_ENABLED);
}

export async function setProtectionEnabled(enabled) {
  return set(STORAGE_KEYS.PROTECTION_ENABLED, enabled);
}

export async function getThreshold() {
  return get(STORAGE_KEYS.THRESHOLD);
}

export async function setThreshold(threshold) {
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    throw new Error('Threshold harus berupa angka antara 0.0 dan 1.0');
  }
  return set(STORAGE_KEYS.THRESHOLD, threshold);
}

export async function getTheme() {
  return get(STORAGE_KEYS.THEME);
}

export async function setTheme(theme) {
  return set(STORAGE_KEYS.THEME, theme);
}

export async function isNotificationsEnabled() {
  return get(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
}

export async function setNotificationsEnabled(enabled) {
  return set(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled);
}

export async function getWarningMode() {
  return get(STORAGE_KEYS.WARNING_MODE);
}

export async function setWarningMode(mode) {
  return set(STORAGE_KEYS.WARNING_MODE, mode);
}

export async function resetToDefaults() {
  try {
    await chrome.storage.sync.clear();
  } catch {
    console.warn('[HonEx] Gagal reset storage');
  }
}
