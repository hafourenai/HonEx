const BRANDS = [
  'google', 'facebook', 'instagram', 'whatsapp', 'twitter',
  'linkedin', 'youtube', 'tiktok', 'amazon', 'apple',
  'microsoft', 'github', 'gitlab', 'netflix', 'spotify',
  'paypal', 'stripe', 'shopify', 'wordpress', 'cloudflare',
  'dropbox', 'docusign', 'adobe', 'canva', 'zoom',
  'teams', 'outlook', 'hotmail', 'gmail', 'yahoo',
  'binance', 'coinbase', 'mandiri', 'bca', 'bni',
  'bri', 'gojek', 'grab', 'tokopedia', 'shopee',
  'bukalapak', 'lazada', 'blibli', 'traveloka', 'dana',
  'ovo', 'gopay', 'bpjs', 'kredivo', 'akulaku',
  'pedulilindungi', 'kemenkes', 'pajak', 'sicepat', 'jne',
  'jnt', 'ninja', 'wahana'
];

const HOMOGLYPH_MAP = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
  '6': 'g', '7': 't', '8': 'b', '9': 'g'
};

function normalizeDomain(domain) {
  let d = domain.toLowerCase().replace(/^www\./, '').trim();
  const parts = d.split('.');
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function decodeText(text) {
  let result = '';
  for (const char of text) {
    result += HOMOGLYPH_MAP[char] || char;
  }
  result = result.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/cl/g, 'd');
  return result;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [Array.from({ length: n + 1 }, (_, i) => i)];
  for (let i = 1; i <= m; i++) {
    dp[i] = [i];
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function getThreshold(len) {
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

function isTyposquatting(domain) {
  if (!domain) return null;

  const base = normalizeDomain(domain);
  const decoded = decodeText(base);

  for (const brand of BRANDS) {
    const decodedBrand = decodeText(brand);
    const dist = levenshtein(decoded, decodedBrand);
    const threshold = getThreshold(brand.length);

    if (dist <= threshold) {
      if (dist === 0 && base === brand) continue;

      const maxLen = Math.max(decoded.length, decodedBrand.length);
      const similarity = maxLen > 0 ? 1 - (dist / maxLen) : 0;
      if (similarity >= 0.6) {
        return { brand, similarity: Math.round(similarity * 100) / 100, distance: dist };
      }
    }

    if (decoded.includes(decodedBrand) && decoded.length > decodedBrand.length + 1) {
      return { brand, similarity: 0.7, distance: 0, type: 'embedded' };
    }
  }

  return null;
}

export async function isAIAvailable() {
  return true;
}

export async function analyzeWithAI(url, domain) {
  const typosquat = isTyposquatting(domain);
  if (typosquat) {
    return {
      verdict: 'phishing',
      reason: `"${normalizeDomain(domain)}" typosquatting "${typosquat.brand}" (${(typosquat.similarity * 100).toFixed(0)}% similar)`
    };
  }

  return null;
}
