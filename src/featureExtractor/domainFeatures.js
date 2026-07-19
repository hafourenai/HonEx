import { countChar, countVowels } from './charCounter.js';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

export function extractDomainFeatures(domain) {
  return {
    domain_length: domain ? domain.length : 0,
    qty_dot_domain: countChar(domain, '.'),
    qty_hyphen_domain: countChar(domain, '-'),
    qty_vowels_domain: countVowels(domain)
  };
}

export function countTldUrl(domain) {
  return countChar(domain, '.');
}

export function detectEmailInUrl(fullUrl) {
  if (!fullUrl) return 0;
  return EMAIL_REGEX.test(fullUrl) ? 1 : 0;
}
