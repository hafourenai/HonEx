# API Reference

Complete documentation of all major classes, functions, and modules in HonEx.

---

## 0. AI Detection (`src/ai/`)

### Typosquatting Detector (`typosquattingDetector.js`)

Pure JavaScript domain typosquatting detector. Compares domain base names against 50+ protected brands using Levenshtein distance and homoglyph decoding. Zero dependencies, zero additional downloads.

#### Exported Functions

```javascript
import { analyzeWithAI, isAIAvailable } from '../ai/typosquattingDetector.js';
```

| Function | Returns | Description |
|---|---|---|
| `isAIAvailable()` | `Promise<true>` | Always returns `true` (pure JS, runs everywhere) |
| `analyzeWithAI(url, domain)` | `Promise<object \| null>` | Check domain for typosquatting |

#### `analyzeWithAI()` Response

```javascript
// Typosquatting detected:
{
  verdict: 'phishing',
  reason: '"g00gle" typosquatting "google" (100% similar)'
}

// No typosquatting:
null
```

#### Detection Algorithm

1. **Normalize domain**: extract second-level domain (e.g., `g00gle.com` → `g00gle`)
2. **Decode homoglyphs**: map visually similar characters (`0→o`, `1→i`, `5→s`, `rn→m`, `vv→w`, etc.)
3. **Levenshtein distance**: compare decoded domain against each brand's decoded name
4. **Threshold**: 1 edit for ≤4 char brands, 2 for 5–7 char, 3 for 8+ char
5. **Embedded brand**: check if decoded domain contains a brand name + extra characters
6. **Exact match skip**: if decoded domain equals brand exactly, it's the legitimate site (not a typosquat)

---

## 1. ML Inference Engine (`src/ml/`)

### `Predictor` class (`predictor.js`)

High-level prediction API. The main entry point for running inference.

#### Constructor

```javascript
new Predictor(model, options?)
```

| Param | Type | Default | Description |
|---|---|---|---|
| `model` | `object` | required | Validated Random Forest model object |
| `options.threshold` | `number` | `0.85` | Phishing probability threshold (0.0–1.0) |
| `options.grayZoneMargin` | `number` | `0.10` | Width of the gray zone around threshold |

#### Static Methods

| Method | Returns | Description |
|---|---|---|
| `Predictor.create(source, options?)` | `Promise<Predictor>` | Factory: loads model from URL or object, returns Predictor |

#### Instance Methods

| Method | Returns | Description |
|---|---|---|
| `predict(features)` | `PredictionResult` | Predict single feature vector (includes `zone` and `rawProbability`) |
| `predictWithDetails(features)` | `DetailedResult` | Predict with full debug information |
| `predictBatch(featuresBatch)` | `PredictionResult[]` | Predict multiple feature vectors |
| `setThreshold(threshold)` | `void` | Change threshold at runtime |
| `setGrayZoneMargin(margin)` | `void` | Change gray zone margin at runtime (0.0–0.5) |
| `getInfo()` | `ModelInfo` | Get model metadata + current threshold + gray zone margin |
| `validateFeatures(features)` | `void` | Validate input (throws on error) |

#### `PredictionResult` Object

```javascript
{
  prediction: 'phishing' | 'legitimate',
  isPhishing: boolean,
  zone: 'safe' | 'gray_zone' | 'phishing',  // three-zone decision
  probability: number,    // 0.0 – 1.0 (after post-processing)
  rawProbability: number, // 0.0 – 1.0 (before post-processing)
  confidence: number,     // 0.5 – 1.0
  threshold: number,      // current threshold
  grayZoneMargin: number  // current gray zone margin
}
```

**Three-Zone Decision**:

| Zone | Condition | Action |
|---|---|---|
| `safe` | probability < threshold - margin | Allow navigation |
| `gray_zone` | \|probability - threshold\| ≤ margin | Secondary checks |
| `phishing` | probability > threshold + margin | Block navigation |

#### `DetailedResult` Object

Same as `PredictionResult` plus:
```javascript
{
  classProbabilities: [number, number],  // [legit, phish]
  nEstimators: number,                    // 100
  featureValues: {
    directory_length: number,
    domain_length: number,
    // ... all 33 features
  }
}
```

---

### `RandomForest` class (`randomForest.js`)

Core aggregation engine. Collects votes from all 100 decision trees.

#### Constructor

```javascript
new RandomForest(model)
```

| Param | Type | Description |
|---|---|---|
| `model` | `object` | Validated model with `trees[]` array |

#### Methods

| Method | Returns | Description |
|---|---|---|
| `predict(features)` | `ForestResult` | Aggregate all tree votes → class probabilities |
| `predictBatch(batch)` | `ForestResult[]` | Batch prediction |
| `getModelInfo()` | `ModelInfo` | Model metadata |

#### `ForestResult` Object

```javascript
{
  classProbabilities: [number, number],
  prediction: 'legitimate' | 'phishing',
  confidence: number,
  phishingProbability: number
}
```

#### Constants

| Constant | Value |
|---|---|
| `CLASS_LABELS` | `{ 0: 'legitimate', 1: 'phishing' }` |

---

### `walkTree()` function (`decisionTree.js`)

Traverses a single decision tree from root to leaf.

```javascript
walkTree(tree, features)
```

| Param | Type | Description |
|---|---|---|
| `tree` | `object` | Single tree from `model.trees[]` |
| `features` | `number[]` | 33-feature input vector |

**Returns**: `[count_class_0, count_class_1]` — leaf node sample counts.

**Throws**: If traversal exceeds `MAX_TRAVERSAL_DEPTH` (1000), indicating a corrupt tree with cycles.

#### Helper Functions

| Function | Returns | Description |
|---|---|---|
| `countLeafNodes(tree)` | `number` | Count leaf nodes in a tree |
| `getTreeDepth(tree)` | `number` | Maximum depth of a tree |

---

### `loadForestModel()` function (`forestLoader.js`)

Fetches and validates a Random Forest model.

```javascript
loadForestModel(source)
```

| Param | Type | Description |
|---|---|---|
| `source` | `string \| object` | URL (string) or pre-parsed JSON object |

**Returns**: `Promise<object>` — validated model object.

**Throws**: If source is invalid, network fails, or validation fails.

### `validateModel()` function (`forestLoader.js`)

Validates model structure without fetching.

```javascript
validateModel(model)
```

| Param | Type | Description |
|---|---|---|
| `model` | `object` | Parsed JSON model |

**Returns**: `object` — the same model (validated in-place).

**Throws**: If any required field is missing or has invalid values. Validates:
- `n_features`, `n_classes`, `n_estimators` are positive numbers
- `feature_names` is an array of correct length
- `trees` is an array of correct length
- Each tree has `children_left`, `children_right`, `threshold`, `feature`, `values`
- All arrays in a tree have the same length
- Feature indices are within valid range

---

## 2. Feature Extractor (`src/featureExtractor/`)

### `extractFeatures()` function (`featureBuilder.js`)

Main feature extraction function.

```javascript
extractFeatures(url, overrides?)
```

| Param | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | required | Raw URL to analyze |
| `overrides` | `object` | `{}` | Override values for external features |

**Returns**:

```javascript
{
  features: number[],         // 33-element array
  featureMap: {
    directory_length: number,
    domain_length: number,
    // ... all 33 features
  },
  featureOrder: string[],     // Feature names in order
  urlComponents: ParsedUrl,   // Parsed URL breakdown
  warnings: string[]          // Non-fatal warnings
}
```

**Notes**:
- Features `qty_mx_servers` and `qty_redirects` default to `0` (see `FEATURE_EXTRACTION.md`)
- Pass overrides: `extractFeatures(url, { qty_redirects: 3 })`

### `parseUrl()` function (`urlParser.js`)

Splits a URL into components.

```javascript
parseUrl(rawUrl)
```

| Param | Type | Description |
|---|---|---|
| `rawUrl` | `string` | Raw URL from browser |

**Returns**:

```javascript
{
  fullUrl: string,     // Normalized URL
  domain: string,       // Hostname (e.g., "www.example.com")
  directory: string,    // Path without last segment
  file: string,         // Last path segment
  params: string,       // Query string (without '?')
  valid: boolean        // Whether parsing succeeded
}
```

If parsing fails, `valid` is `false` and all string fields are empty.

### `extractDomainFeatures()` function (`domainFeatures.js`)

```javascript
extractDomainFeatures(domain)
```

| Param | Type | Description |
|---|---|---|
| `domain` | `string` | Hostname |

**Returns**:

```javascript
{
  domain_length: number,
  qty_dot_domain: number,
  qty_hyphen_domain: number,
  qty_vowels_domain: number
}
```

### `countTldUrl()` function (`domainFeatures.js`)

```javascript
countTldUrl(domain)  // → number
```

Returns the count of `.` in the domain (same as `qty_dot_domain`).

### `detectEmailInUrl()` function (`domainFeatures.js`)

```javascript
detectEmailInUrl(fullUrl)  // → 0 | 1
```

Returns `1` if the URL contains an email pattern matching `/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/`.

### `countChar()` function (`charCounter.js`)

```javascript
countChar(str, char)  // → number
```

Counts occurrences of a single character in a string.

### `countVowels()` function (`charCounter.js`)

```javascript
countVowels(str)  // → number
```

Counts vowels (`a`, `e`, `i`, `o`, `u` — case-insensitive) in a string.

### Utility Functions

```javascript
getExternalFeatures()  // → { qty_mx_servers: {...}, qty_redirects: {...} }
getFeatureOrder()      // → string[] (copy of FEATURE_ORDER)
```

---

## 3. Storage (`src/utils/`)

### Storage Functions (`storage.js`)

All storage functions use `chrome.storage.sync` with automatic fallback to defaults.

#### Generic

| Function | Returns | Description |
|---|---|---|
| `get(key?)` | `Promise<any>` | Get single key or all stored values |
| `set(keyOrMap, value?)` | `Promise<void>` | Set single key or multiple values |
| `resetToDefaults()` | `Promise<void>` | Clear all stored values |

#### Typed Accessors

| Function | Returns | Description |
|---|---|---|
| `isProtectionEnabled()` | `Promise<boolean>` | Default: `true` |
| `setProtectionEnabled(enabled)` | `Promise<void>` | — |
| `getThreshold()` | `Promise<number>` | Default: `0.5` |
| `setThreshold(threshold)` | `Promise<void>` | — |
| `getTheme()` | `Promise<string>` | Default: `'light'` |
| `setTheme(theme)` | `Promise<void>` | — |
| `isNotificationsEnabled()` | `Promise<boolean>` | Default: `true` |
| `setNotificationsEnabled(enabled)` | `Promise<void>` | — |
| `getWarningMode()` | `Promise<string>` | Default: `'block'` |
| `setWarningMode(mode)` | `Promise<void>` | — |

### Constants (`constants.js`)

```javascript
PREDICTION:       { SAFE: 'safe', PHISHING: 'phishing', ERROR: 'error' }
PREDICTION_ZONE:  { SAFE: 'safe', GRAY_ZONE: 'gray_zone', PHISHING: 'phishing' }
THRESHOLD_CONFIG: { GRAY_ZONE_MARGIN: 0.10, DEFAULT: 0.85, MIN: 0.0, MAX: 1.0 }
STORAGE_KEYS:     { PROTECTION_ENABLED, THEME, NOTIFICATIONS_ENABLED, THRESHOLD, WARNING_MODE }
DEFAULTS:         { PROTECTION_ENABLED: true, THEME: 'light', ... }
WARNING_MODES:    { BLOCK: 'block', WARN: 'warn', LOG: 'log' }
WARNING_PAGE:     { PATH: '/warning/warning.html', URL_PARAM: 'targetUrl', PROB_PARAM: 'probability' }
EXTENSION_NAME:   'HonEx'
```

---

## 4. Background (`src/background/`)

### Message API (`service_worker.js`)

| Message Type | Request Payload | Response |
|---|---|---|
| `CHECK_URL` | `{ url: string }` | `{ prediction, probability, zone, error? }` |
| `GET_STATUS` | `{}` | `{ protectionEnabled, threshold, modelLoaded }` |
| `SET_PROTECTION` | `{ enabled: boolean }` | `{ success }` or `{ error }` |
| `SET_THRESHOLD` | `{ threshold: number }` | `{ success }` or `{ error }` |
| `BYPASS_URL` | `{ url: string }` | `{ success }` or `{ error }` |
| `NAVIGATE_TO_URL` | `{ tabId: number, url: string }` | `{ success }` or `{ error }` |
| `GO_BACK` | (none) | `{ success }` or `{ error }` |

### `analyzeUrl()` (`navigationHandler.js`)

```javascript
analyzeUrl(url, redirectHistory?)
```

| Param | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | required | URL to analyze |
| `redirectHistory` | `Map<string, number>` | `new Map()` | Per-domain redirect counts for `qty_redirects` override |

**Returns**: `Promise<AnalyzeResult>`

```javascript
{
  prediction: 'safe' | 'phishing' | 'error',
  probability: number,        // 0.0 – 1.0
  rawProbability: number,     // before post-processing
  zone: 'safe' | 'gray_zone' | 'phishing',
  aiVerdict?: 'phishing',     // present if typosquatting detected
  aiReason?: string,          // explanation from typosquatting detector
  error: string | null        // null unless prediction === 'error'
}
```

Skips internal URLs (`chrome-extension://`, `chrome://`, `about:`, etc.). In gray zone, performs secondary checks: brand whitelist → DNS resolve → typosquatting detection.

### `handleNavigation()` (`navigationHandler.js`)

Event handler for `chrome.webNavigation.onCommitted`.

```javascript
handleNavigation(details, bypassedUrls, domainRedirectHistory)
```

| Param | Type | Description |
|---|---|---|
| `details` | `object` | Navigation event details from `chrome.webNavigation` |
| `bypassedUrls` | `Set<string>` | URLs whitelisted via "Continue Anyway" (30s TTL) |
| `domainRedirectHistory` | `Map<string, number>` | Per-domain redirect counts for feature override |

Only processes main frame navigations (`details.frameId === 0`). Respects protection toggle and warning mode.

**Decision Flow**:

1. **Safe zone** (prob < 0.75) → Allow navigation
2. **Phishing zone** (prob > 0.95) → Block/warn based on warning mode
3. **Gray zone** (0.75–0.95) → Secondary checks:
   - Brand whitelist match → reclassify as safe
   - DNS resolve fail → notify only (don't block)
   - Typosquatting detected → block as phishing
   - All clear → non-blocking notification

### `getPredictor()` (`modelManager.js`)

Returns the singleton `Predictor` instance, loading it on first call.

```javascript
getPredictor()  // → Promise<Predictor>
```

### `isModelLoaded()` (`modelManager.js`)

```javascript
isModelLoaded()  // → boolean
```

### `resetModel()` (`modelManager.js`)

Resets the cached model (useful for testing). Next call to `getPredictor()` will reload.

---

## 5. Error Handling

All public functions throw descriptive errors:

| Module | Error Scenario | Message |
|---|---|---|
| `Predictor.predict` | Wrong feature count | `"Jumlah fitur tidak sesuai: diharapkan 33, diterima 5"` |
| `Predictor.predict` | NaN value | `"Fitur[5] ("qty_params_length") bernilai NaN"` |
| `validateModel` | Missing key | `"Field wajib tidak ditemukan: "trees""` |
| `validateTree` | Invalid feature index | `"Tree[3] Node[12]: feature index 99 di luar range [0, 32]"` |
| `loadForestModel` | Network error | `"Gagal memuat model dari ... : HTTP 404"` |
| `walkTree` | Max depth exceeded | `"Traversal melebihi kedalaman maksimum (1000)"` |

All background message handlers catch errors and return `{ error: message }` rather than throwing.
