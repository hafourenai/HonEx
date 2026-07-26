# Architecture

HonEx is a Manifest V3 Chrome Extension with a pure-JavaScript machine learning inference engine. This document describes the system architecture at three levels: Chrome Extension, Machine Learning, and Module Relationships.

---

## 1. Chrome Extension Architecture

HonEx follows the standard Chrome Extension MV3 architecture with a non-persistent background service worker, an action popup, and extension pages.

```
┌──────────────────────────────────────────────────────────────────────┐
│                      CHROME EXTENSION LAYER                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────┐               │
│  │              Background Service Worker             │               │
│  │              (service_worker.js)                   │               │
│  │                                                    │               │
│  │  ┌──────────────┐    ┌──────────────────────────┐  │               │
│  │  │ Message      │    │ Navigation Handler       │  │               │
│  │  │ Router       │───▸│ (navigationHandler.js)   │  │               │
│  │  │              │    │                          │  │               │
│  │  │ CHECK_URL    │    │ analyzeUrl()             │  │               │
│  │  │ GET_STATUS   │    │ shouldSkipUrl()          │  │               │
│  │  │ SET_PROTECT  │    │ redirectToWarning()      │  │               │
│  │  │ BYPASS_URL   │    └────────┬─────────────────┘  │               │
│  │  │ NAVIGATE_TO  │             │                    │               │
│  │  │ GO_BACK      │             ▼                    │               │
│  │  └──────┬───────┘    ┌─────────────────────┐      │               │
│  │         │            │ Model Manager        │      │               │
│  │         │            │ (modelManager.js)    │      │               │
│  │         │            │                     │      │               │
│  │         │            │ getPredictor()      │      │               │
│  │         │            │ isModelLoaded()     │      │               │
│  │         │            │ resetModel()        │      │               │
│  │         │            └────────┬────────────┘      │               │
│  │         │                     │                    │               │
│  │         ▼                     ▼                    │               │
│  │  ┌──────────────────────────────────────────┐      │               │
│  │  │     Feature Extractor + Predictor        │      │               │
│  │  │     (Pure JS — no dependencies)          │      │               │
│  │  └──────────────────────────────────────────┘      │               │
│  │                                                    │               │
│  │  Redirect tracking:                                 │               │
│  │  ┌─────────────────────┐                            │               │
│  │  │ onBeforeRedirect ──▸│ redirectCounts (tabId)     │               │
│  │  │ onCompleted ───────▸│ domainRedirectHistory     │               │
│  │  │ onErrorOccurred ───▸│ (domain → count)          │               │
│  │  └─────────────────────┘                            │               │
│  └──────────────────────────────────────────────────────┘               │
│                       │              ▲                                  │
│          chrome.tabs   │              │ chrome.runtime                   │
│          .update()     │              │ .sendMessage()                   │
│          .goBack()     ▼              │                                  │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐          │
│  │   Popup      │  │ Warning  │  │Dashboard │  │ Settings   │          │
│  │  (popup/)   │  │ (warning/│  │(dashboard│  │ (settings/ │          │
│  │             │  │  .html)  │  │  /index  │  │  .html)    │          │
│  │ Status      │  │ Threat   │  │ .html)   │  │            │          │
│  │ Toggle      │  │ Score    │  │ Status    │  │ Protection │          │
│  │ Menu        │  │ Go Back  │  │ Toggle    │  │ Theme      │          │
│  │             │  │ Continue │  │ Version   │  │ Warning    │          │
│  └──────────────┘  └──────────┘  └──────────┘  │ Mode       │          │
│                                                 └────────────┘          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Lifecycle

1. **Install / Startup**: `service_worker.js` → `modelManager.loadModel()` → fetches `rf_trees.json` → validates → instantiates `Predictor`
2. **Navigation**: `chrome.webNavigation.onCommitted` (skip `auto_toplevel`) → `navigationHandler.handleNavigation()` → checks `bypassedUrls` → `analyzeUrl()` → extract features (with `domainRedirectHistory` for accurate `qty_redirects`) → `predictor.predict()` → threshold comparison → block/warn/log based on warning mode
3. **Redirect Tracking**: `chrome.webNavigation.onBeforeRedirect` increments per-tab counter → `onCompleted` saves `(domain → count)` to `domainRedirectHistory` → used in subsequent navigations to same domain
4. **User Interaction**: Popup / Dashboard / Settings send messages → `service_worker.onMessage` handles each type
5. **Bypass**: User clicks "Continue Anyway" → URL added to `bypassedUrls` Set (30s TTL) → `handleNavigation` checks bypass before analysis
6. **Model Reset**: Service worker can be terminated by Chrome at any time (MV3). Model is re-loaded on next activation via `getPredictor()`

---

## 2. Machine Learning Architecture

The ML system is a Random Forest classifier exported from scikit-learn and reimplemented in pure JavaScript, with a calibration layer to correct model bias.

```
┌────────────────────────────────────────────────────────────────────┐
│                    MACHINE LEARNING PIPELINE                        │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Dataset  │───▸│  Feature     │───▸│  Random Forest           │  │
│  │  (CSV)   │    │  Extraction  │    │  Classifier              │  │
│  │          │    │  (33 cols)   │    │  (100 trees)             │  │
│  └──────────┘    └──────────────┘    └────────┬─────────────────┘  │
│                                               │                     │
│                                               ▼                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  Model Export Pipeline                      │    │
│  │                                                             │    │
│  │  scikit-learn Tree DecisionTreeClassifier                   │    │
│  │         │                                                   │    │
│  │         ▼                                                   │    │
│  │  Custom JSON Serialization                                  │    │
│  │  (children_left, children_right, threshold,                 │    │
│  │   feature, values for each node)                             │    │
│  │         │                                                   │    │
│  │         ▼                                                   │    │
│  │  rf_trees.json                                              │    │
│  │  (n_features, n_classes, n_estimators,                      │    │
│  │   feature_names, trees[])                                    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │               JavaScript Inference Engine                   │    │
│  │                                                             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐          │    │
│  │  │ forestLoader │─▸│  Predictor   │─▸│ Random   │          │    │
│  │  │ .js          │  │  .js         │  │ Forest   │          │    │
│  │  │              │  │              │  │ .js      │          │    │
│  │  │ validate     │  │ validateFeat │  │          │          │    │
│  │  │ fetch        │  │ predict()    │  │ predict()│          │    │
│  │  │ parse        │  │ predictBatch│  │          │          │    │
│  │  └──────────────┘  │ setThreshold │  └────┬─────┘          │    │
│  │                     └──────────────┘       │                │    │
│  │                                            ▼                │    │
│  │                                     ┌──────────────┐        │    │
│  │                                     │ decisionTree │        │    │
│  │                                     │ .js           │        │    │
│  │                                     │              │        │    │
│  │                                     │ walkTree()   │        │    │
│  │                                     └──────────────┘        │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

### Inference Algorithm

1. **Input**: Array of 33 numerical features in fixed order
2. **Validation**: Check array length, type (must be `number`), no `NaN` values
3. **Tree Traversal**: For each of 100 trees:
   - Start at root node (index 0)
   - Compare `features[feature_index]` to `threshold`
   - Navigate left (≤) or right (>) until leaf (`children_left === -1`)
   - Record leaf votes `[count_class_0, count_class_1]`
4. **Aggregation**: Sum votes across all trees → divide by 100 → raw class probabilities
5. **Decision**: `phishingProbability > threshold` (default 0.85) → phishing

---

## 3. Module Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MODULE DEPENDENCY GRAPH                             │
│                                                                         │
│  service_worker.js                                                       │
│       │  ┌──────────────────────────────────────────────┐               │
│       │  │ Redirect Tracking (local state):              │               │
│       │  │  redirectCounts: Map<tabId, count>            │               │
│       │  │  domainRedirectHistory: Map<domain, count>    │               │
│       │  └──────────────────────────────────────────────┘               │
│       │  bypassedUrls: Set<string>                                      │
│       │                                                                 │
│       ├── onBeforeNavigate → handleNavigation(details, bypassedUrls,    │
│       │                          domainRedirectHistory)                  │
│       │                                                                 │
│       ├── navigationHandler.js                                           │
│       │       ├── analyzeUrl(url, redirectHistory)                       │
│       │       │       ├── extractFeatures(url, overrides)               │
│       │       │       │       ├── urlParser.js                          │
│       │       │       │       ├── charCounter.js                        │
│       │       │       │       └── domainFeatures.js                     │
│       │       │       │               └── charCounter.js                │
│       │       │       │                                                 │
│       │       │       ├── getPredictor()                                │
│       │       │       │       └── predictor.js                          │
│       │       │       │               ├── forestLoader.js               │
│       │       │       │               ├── randomForest.js               │
│       │       │       │               │       └── decisionTree.js       │
│       │       │       │               └── calibrate() (Platt scaling)   │
│       │       │       │                                                 │
│       │       │       └── storage.js ─── constants.js                   │
│       │       │                                                         │
│       │       ├── shouldSkipUrl(url)                                    │
│       │       └── redirectToWarning(tabId, url, prob)                   │
│       │                                                                 │
│       ├── onBeforeRedirect → redirectCounts                             │
│       ├── onCompleted → domainRedirectHistory                           │
│       ├── onErrorOccurred → cleanup redirectCounts                      │
│       └── storage.js ─── constants.js                                   │
│                                                                         │
│  popup.js ─────────→ chrome.runtime.sendMessage ────→ service_          │
│  warning.js ───────→ chrome.runtime.sendMessage ────→ worker.js          │
│  dashboard.js ─────→ chrome.runtime.sendMessage ────→ (message           │
│  settings.js ──────→ chrome.storage.sync              │  router)         │
│                                                         │                │
│  All pages ←── chrome.tabs.update / goBack ←───────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow (End-to-End)

### Safe URL Flow

```
User clicks link (https://www.youtube.com)
         │
         ▼
webNavigation.onCommitted fires
         │
         ▼
handleNavigation(details, bypassedUrls, domainRedirectHistory)
         │
         ├── bypassedUrls.has(url) → false
         ├── isProtectionEnabled() → true
         ├── getWarningMode() → "block"
         ├── shouldSkipUrl(url) → false
         │
         ├── analyzeUrl(url, domainRedirectHistory)
         │       │
         │       ├── lookup domain in domainRedirectHistory
         │       │   → overrides.qty_redirects = 1
         │       │
         │       ├── extractFeatures(url, overrides) → 33-feature vector
         │       │
         │       ├── predictor.predict(features)
         │       │       └── probability = 0.77, zone = "safe"
         │       │
         │       └── return { prediction: "safe", zone: "safe" }
         │
         └── zone === SAFE → do nothing (navigation proceeds)
```

### Phishing URL Flow (High Confidence)

```
User clicks link (https://phish.example.com/login?ref=evil)
         │
         ▼
handleNavigation(details)
         │
         ├── analyzeUrl(url)
         │       ├── predictor.predict(features)
         │       │       └── probability = 0.96, zone = "phishing"
         │       └── return { prediction: "phishing", zone: "phishing" }
         │
         ├── zone === PHISHING → block/warn based on warningMode
         │
         └── "block" → redirectToWarning(tabId, url, 0.96)
                 │
                 └── chrome.tabs.update(tabId, {
                       url: "warning.html?targetUrl=...&probability=0.96"
                     })
```

### Gray Zone Flow (Medium Confidence)

```
User clicks link (https://cdn-cf-01.project.com/assets/main.js)
         │
         ▼
handleNavigation(details)
         │
         ├── analyzeUrl(url)
         │       ├── predictor.predict(features)
         │       │       └── probability = 0.84, zone = "gray_zone"
         │       │
         │       ├── [1] Brand whitelist check
         │       │   └── domain contains known brand?
         │       │       ├── YES → return { prediction: "safe", zone: "safe" }
         │       │       └── NO  → continue
         │       │
         │       ├── [2] DNS resolution check
         │       │   └── chrome.dns.resolve(domain)
         │       │       ├── no addresses → return { prediction: "phishing", zone: "gray_zone" }
         │       │       └── resolves     → continue
         │       │
         │       ├── [3] Typosquatting check
         │       │   └── typosquattingDetector.analyzeWithAI(url, domain)
         │       │       ├── DETECTED → return { prediction: "phishing", zone: "phishing" }
         │       │       └── clear    → continue
         │       │
         │       └── all checks pass
         │           → return { prediction: "legitimate", zone: "gray_zone" }
         │
         └── zone === GRAY_ZONE
             └── showGrayZoneNotification() — non-blocking notification
                 (page continues loading, user is informed but not blocked)
```

### Continue Anyway Flow

```
User clicks "Continue Anyway"
         │
         ▼
warning.js:
    chrome.runtime.sendMessage({ type: "BYPASS_URL", url })
         │
         ├── service_worker adds url to bypassedUrls Set
         │   (auto-expires after 30 seconds)
         │
         └── chrome.tabs.update(tab.id, { url })
                 │
                 ▼
        webNavigation.onCommitted fires
                 │
                 ├── handleNavigation()
                 │       ├── bypassedUrls.has(url) → true
                 │       │   → return early (skip analysis)
                 │       │
                 │       └── Navigation proceeds to original URL
                 │
                 ▼
        During navigation:
        - onBeforeRedirect fires → redirectCounts[tabId]++
        - onCompleted fires → save (domain → count) to
          domainRedirectHistory
        - Next visit to same domain uses stored redirect count
```

---

## 5. Component Responsibilities

| Component | Responsibility |
|---|---|
| **Service Worker** | Message router, navigation listener, model lifecycle, redirect tracking (`redirectCounts`, `domainRedirectHistory`), bypass set management |
| **Navigation Handler** | URL analysis orchestration (via `onCommitted`), bypass check, skip-list, domain redirect lookup, feature extraction with overrides, gray zone secondary checks (brand whitelist, DNS resolve, typosquatting), warning redirect (block) / notification (warn) |
| **Model Manager** | Singleton predictor cache, lazy loading |
| **Predictor** | Feature validation, threshold config, three-zone decision boundary, dynamic post-processing boost scaling, Random Forest inference, result formatting |
| **Random Forest** | Soft-voting aggregation, raw class probability computation |
| **Decision Tree** | Single tree traversal following scikit-learn node structure |
| **Forest Loader** | Model fetch, parse, structural validation |
| **Typosquatting Detector** | Levenshtein distance + homoglyph decoder for domain impersonation detection against 50+ protected brands |
| **Feature Builder** | 33-feature extraction orchestration, external feature defaults (`qty_mx_servers=2`, `qty_redirects=1`), override support |
| **URL Parser** | URL → {domain, directory, file, params} decomposition |
| **Domain Features** | Domain-specific metrics (length, dots, hyphens, vowels) |
| **Char Counter** | Character occurrence counting utility |
| **Storage** | `chrome.storage.sync` wrapper with typed accessors |
| **Constants** | Enums, storage keys, defaults (threshold=0.85), three-zone config, warning page config |

---

## 6. Key Configuration

| Parameter | Default | Description |
|---|---|---|
| **Threshold** | 0.85 | Minimum probability to classify as phishing |
| **Gray Zone Margin** | ±0.10 | Width of the gray zone around threshold (safe < 0.75, gray zone 0.75–0.95, phishing > 0.95) |
| **Warning Mode** | `block` | `block` = redirect to warning page, `warn` = show notification (page loads), `log` = console log only |
| **qty_mx_servers** | 2 | External feature default (DNS MX lookup unavailable in browser) |
| **qty_redirects** | 1 | External feature default (tracked via webNavigation API) |
| **Bypass TTL** | 30s | How long a bypassed URL remains whitelisted |

### Gray Zone Secondary Checks

| Check | When | Action on Match |
|---|---|---|
| **Brand whitelist** | Domain contains a known brand (Google, Mandiri, etc.) | Reclassify as **SAFE** |
| **DNS resolution** | Domain fails to resolve via `chrome.dns.resolve()` | Return **GRAY_ZONE** (notify only, don't block) |
| **Typosquatting** | Domain is a typosquat of a protected brand (Levenshtein ≤ threshold or homoglyph match) | Reclassify as **PHISHING** (block) |
