# Feature Extraction

This document explains how HonEx extracts 33 numerical features from a raw URL for Random Forest inference.

---

## Overview

Feature extraction is the bridge between raw browser URLs and the ML model. Every URL a user visits is decomposed into structural components, which are then measured across 33 different dimensions.

```
Raw URL
    │
    ▼
┌─────────────────────┐
│    URL Parsing       │  Split into domain, directory, file, params
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Component Analysis  │  Measure each component
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Character Counting  │  Count special characters (@, -, ., %, ...)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Domain Features     │  Domain length, dots, hyphens, vowels
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Feature Assembly    │  Order 33 features per feature_order.json
└─────────┬───────────┘
          │
          ▼
    33-feature vector  →  Predictor.predict()
```

---

## 1. URL Parsing (`urlParser.js`)

The first step is to decompose the raw URL into four components:

```
https://sub.example.com:8080/path/to/page.html?id=1&q=search
│───────│ │──────────────────────│ │──────│ │──────────────│
  scheme          domain             path      query string
```

### Component Breakdown

| Component | Example | Description |
|---|---|---|
| `domain` | `sub.example.com` | Hostname without port |
| `directory` | `/path/to` | Path without the final segment |
| `file` | `page.html` | Final path segment |
| `params` | `id=1&q=search` | Query string without `?` |

If no scheme is present (e.g., `example.com/path`), `http://` is prepended to satisfy the `URL` constructor.

If the URL is invalid or unparseable, all components return empty strings and the `valid` flag is set to `false`. In this case, all features default to `0`.

### `splitPathname()` Logic

```javascript
"/path/to/page.html"  →  directory: "/path/to",  file: "page.html"
"/path/to/"           →  directory: "/path/to",  file: ""
"/page.html"          →  directory: "",          file: "page.html"
"/"                   →  directory: "",          file: ""
```

---

## 2. Character Counting (`charCounter.js`)

A core operation is counting specific characters in each URL component. The `countChar(str, char)` function iterates through the string and counts occurrences of the target character.

Characters counted:

| Character | Features Using It |
|---|---|
| `.` (dot) | `qty_dot_directory`, `qty_dot_domain`, `qty_dot_params`, `qty_dot_url` |
| `-` (hyphen) | `qty_hyphen_directory`, `qty_hyphen_domain`, `qty_hyphen_file`, `qty_hyphen_params`, `qty_hyphen_url` |
| `@` (at) | `qty_at_directory`, `qty_at_url` |
| `&` (and) | `qty_and_url` |
| `*` (asterisk) | `qty_asterisk_directory` |
| `%` (percent) | `qty_percent_directory`, `qty_percent_params` |
| `?` (question mark) | `qty_questionmark_directory`, `qty_questionmark_params` |
| `/` (slash) | `qty_slash_params`, `qty_slash_url` |
| `=` (equal) | `qty_equal_url` |
| `_` (underline) | `qty_underline_directory`, `qty_underline_params`, `qty_underline_url` |

Vowel counting is also performed on the domain component for `qty_vowels_domain` (counts `a`, `e`, `i`, `o`, `u` — case-insensitive).

---

## 3. Domain Features (`domainFeatures.js`)

Domain-specific features extracted from the hostname:

| Feature | Calculation | Purpose |
|---|---|---|
| `domain_length` | `domain.length` | Phishing domains are often unusually long |
| `qty_dot_domain` | Count of `.` in domain | Many subdomains can indicate phishing |
| `qty_hyphen_domain` | Count of `-` in domain | Hyphens are common in deceptive domains |
| `qty_vowels_domain` | Count of vowels (a/e/i/o/u) | Legitimate domains tend to have more vowels |
| `qty_tld_url` | Count of `.` in domain (same as dot count) | Proxy for TLD/subdomain count |
| `email_in_url` | Regex match for email pattern `user@domain.tld` | Phishing URLs often contain email addresses |

---

## 4. Feature Assembly (`featureBuilder.js`)

The `extractFeatures()` function orchestrates the entire pipeline:

1. Parse the URL → components
2. Extract domain features
3. Compute length features (`directory_length`, `domain_length`, `file_length`, `length_url`, `params_length`)
4. Count special characters in each component
5. Handle external features (`qty_mx_servers` default 2, `qty_redirects` default 1 — di-override jika data tersedia)
6. Order all 33 values according to `FEATURE_ORDER`

The feature order is `Object.freeze()`'d and hardcoded to match `feature_order.json` from training.

```javascript
const FEATURE_ORDER = Object.freeze([
  'directory_length',       // index 0
  'domain_length',          // index 1
  'email_in_url',           // index 2
  'file_length',            // index 3
  'length_url',             // index 4
  'params_length',          // index 5
  // ... 27 more
]);
```

### Output

```javascript
{
  features: [4, 15, 0, 9, 48, 7, ...],   // 33 numbers
  featureMap: {
    directory_length: 4,
    domain_length: 15,
    // ... all 33 features
  },
  featureOrder: [/* same as FEATURE_ORDER */],
  urlComponents: {
    domain: 'sub.example.com',
    directory: '/path/to',
    file: 'page.html',
    params: 'id=1&q=search'
  },
  warnings: [
    'qty_mx_servers: Memerlukan DNS MX record lookup...'
  ]
}
```

---

## 5. External Features

Two features cannot be computed in-browser:

| Feature | External Data Needed | In-Browser Value |
|---|---|---|
| `qty_mx_servers` | DNS MX record lookup | `2` (default, tidak tersedia di browser) |

| `qty_redirects` | HTTP redirect chain tracking | `1` (default, di-track via `webNavigation`) |
These default to `2` (qty_mx_servers) and `1` (qty_redirects). Redirect counts are tracked in real-time via `webNavigation.onBeforeRedirect`; overrides can be passed explicitly:

```javascript
const result = extractFeatures(url, {
  qty_redirects: 3,
  qty_mx_servers: 5
});
```

---

## 6. Feature Engineering Rationale

Each feature was selected based on empirical importance from the trained Random Forest:

- **Length features** (`directory_length`, `length_url`, `file_length`) — Phishing URLs are often long and convoluted
- **Character anomalies** (`@`, `*`, `%` in directory) — Special characters in unexpected positions are suspicious
- **Domain structure** (`qty_dot_domain`, `qty_hyphen_domain`) — Deceptive domains often have many subdomains or hyphens
- **Structural patterns** (`qty_slash_url`, `qty_params_length`) — Phishing sites frequently have deep paths and long query strings
- **Keyword patterns** (`email_in_url`) — The presence of `@` in a URL (beyond the scheme) is a common phishing technique

---

## 7. Relationship with `feature_order.json`

During training, `feature_order.json` was generated from the training pipeline to record the exact feature sequence. This file must match the `FEATURE_ORDER` array in `featureBuilder.js` exactly.

The test suite (`trash/tests/test_features.mjs`) verifies this alignment automatically:

```javascript
const featureOrderJson = JSON.parse(await readFile('./hasil/feature_order.json'));
const engineOrder = getFeatureOrder();
assert(JSON.stringify(featureOrderJson) === JSON.stringify(engineOrder));
```

Any change to the feature set must be reflected in both:
1. The Python training pipeline (re-export `feature_order.json`)
2. The JavaScript `FEATURE_ORDER` array in `featureBuilder.js`
