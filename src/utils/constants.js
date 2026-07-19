export const PREDICTION = Object.freeze({
  SAFE: 'safe',
  PHISHING: 'phishing',
  ERROR: 'error'
});

export const STORAGE_KEYS = Object.freeze({
  PROTECTION_ENABLED: 'protectionEnabled',
  THEME: 'theme',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  THRESHOLD: 'threshold',
  WARNING_MODE: 'warningMode'
});

export const DEFAULTS = Object.freeze({
  [STORAGE_KEYS.PROTECTION_ENABLED]: true,
  [STORAGE_KEYS.THEME]: 'light',
  [STORAGE_KEYS.NOTIFICATIONS_ENABLED]: true,
  [STORAGE_KEYS.THRESHOLD]: 0.5,
  [STORAGE_KEYS.WARNING_MODE]: 'block'
});

export const WARNING_MODES = Object.freeze({
  BLOCK: 'block',
  WARN: 'warn',
  LOG: 'log'
});

export const NAVIGATION_EVENTS = Object.freeze({
  BEFORE_NAVIGATE: 'webNavigation.onBeforeNavigate',
  COMPLETED: 'webNavigation.onCompleted',
  ERROR_OCCURRED: 'webNavigation.onErrorOccurred'
});

export const WARNING_PAGE = Object.freeze({
  PATH: '/warning/warning.html',
  URL_PARAM: 'targetUrl',
  PROB_PARAM: 'probability'
});

export const EXTENSION_NAME = 'HonEx';
