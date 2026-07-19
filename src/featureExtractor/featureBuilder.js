import { parseUrl } from './urlParser.js';
import { countChar } from './charCounter.js';
import { extractDomainFeatures, countTldUrl, detectEmailInUrl } from './domainFeatures.js';

const FEATURE_ORDER = Object.freeze([
  'directory_length',
  'domain_length',
  'email_in_url',
  'file_length',
  'length_url',
  'params_length',
  'qty_and_url',
  'qty_asterisk_directory',
  'qty_at_directory',
  'qty_at_url',
  'qty_dot_directory',
  'qty_dot_domain',
  'qty_dot_params',
  'qty_dot_url',
  'qty_equal_url',
  'qty_hyphen_directory',
  'qty_hyphen_domain',
  'qty_hyphen_file',
  'qty_hyphen_params',
  'qty_hyphen_url',
  'qty_mx_servers',
  'qty_percent_directory',
  'qty_percent_params',
  'qty_questionmark_directory',
  'qty_questionmark_params',
  'qty_redirects',
  'qty_slash_params',
  'qty_slash_url',
  'qty_tld_url',
  'qty_underline_directory',
  'qty_underline_params',
  'qty_underline_url',
  'qty_vowels_domain'
]);

const EXTERNAL_FEATURES = Object.freeze({
  qty_mx_servers: {
    defaultValue: 2,
    reason: 'DNS MX record lookup tidak tersedia di browser. Default 2 (mayoritas situs legitimate punya 1-5 MX records).'
  },
  qty_redirects: {
    defaultValue: 1,
    reason: 'HTTP request tracking via chrome.webNavigation API. Default 1 (kebanyakan situs punya redirect HTTP→HTTPS).'
  }
});

export function extractFeatures(url, overrides = {}) {
  const warnings = [];
  const components = parseUrl(url);

  if (!components.valid) {
    warnings.push(`URL tidak bisa diparsing: "${url}". Semua fitur di-set ke 0.`);
  }

  const { fullUrl, domain, directory, file, params } = components;
  const domainFeats = extractDomainFeatures(domain);
  const featureMap = {};

  featureMap.directory_length = directory ? directory.length : 0;
  featureMap.domain_length = domainFeats.domain_length;
  featureMap.email_in_url = detectEmailInUrl(fullUrl);
  featureMap.file_length = file ? file.length : 0;
  featureMap.length_url = fullUrl ? fullUrl.length : 0;
  featureMap.params_length = params ? params.length : 0;

  featureMap.qty_and_url = countChar(fullUrl, '&');
  featureMap.qty_asterisk_directory = countChar(directory, '*');
  featureMap.qty_at_directory = countChar(directory, '@');
  featureMap.qty_at_url = countChar(fullUrl, '@');
  featureMap.qty_dot_directory = countChar(directory, '.');
  featureMap.qty_dot_domain = domainFeats.qty_dot_domain;
  featureMap.qty_dot_params = countChar(params, '.');
  featureMap.qty_dot_url = countChar(fullUrl, '.');
  featureMap.qty_equal_url = countChar(fullUrl, '=');

  featureMap.qty_hyphen_directory = countChar(directory, '-');
  featureMap.qty_hyphen_domain = domainFeats.qty_hyphen_domain;
  featureMap.qty_hyphen_file = countChar(file, '-');
  featureMap.qty_hyphen_params = countChar(params, '-');
  featureMap.qty_hyphen_url = countChar(fullUrl, '-');

  for (const [featName, info] of Object.entries(EXTERNAL_FEATURES)) {
    if (featName in overrides) {
      featureMap[featName] = overrides[featName];
    } else {
      featureMap[featName] = info.defaultValue;
      warnings.push(`${featName}: ${info.reason}. Menggunakan default (${info.defaultValue}).`);
    }
  }

  featureMap.qty_percent_directory = countChar(directory, '%');
  featureMap.qty_percent_params = countChar(params, '%');
  featureMap.qty_questionmark_directory = countChar(directory, '?');
  featureMap.qty_questionmark_params = countChar(params, '?');
  featureMap.qty_slash_params = countChar(params, '/');
  featureMap.qty_slash_url = countChar(fullUrl, '/');
  featureMap.qty_tld_url = countTldUrl(domain);
  featureMap.qty_underline_directory = countChar(directory, '_');
  featureMap.qty_underline_params = countChar(params, '_');
  featureMap.qty_underline_url = countChar(fullUrl, '_');
  featureMap.qty_vowels_domain = domainFeats.qty_vowels_domain;

  const features = FEATURE_ORDER.map(name => featureMap[name]);

  return {
    features,
    featureMap,
    featureOrder: FEATURE_ORDER,
    urlComponents: components,
    warnings
  };
}

export function getExternalFeatures() {
  return { ...EXTERNAL_FEATURES };
}

export function getFeatureOrder() {
  return [...FEATURE_ORDER];
}
