# Architecture

HonEx is a Manifest V3 Chrome Extension with a pure-JavaScript machine learning inference engine. This document describes the system architecture at three levels: Chrome Extension, Machine Learning, and Module Relationships.

---

## 1. Chrome Extension Architecture

HonEx follows the standard Chrome Extension MV3 architecture with a non-persistent background service worker, an action popup, and extension pages.

```
┌──────────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION LAYER                        │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │         Background Service Worker             │               │
│  │         (service_worker.js)                   │               │
│  │                                              │               │
│  │  ┌──────────────┐    ┌──────────────────┐   │               │
│  │  │ Message      │    │ Navigation       │   │               │
│  │  │ Router       │───▸│ Handler          │   │               │
│  │  │              │    │                  │   │               │
│  │  │ CHECK_URL    │    │ analyzeUrl()     │   │               │
│  │  │ GET_STATUS   │    │ shouldSkipUrl()  │   │               │
│  │  │ SET_PROTECT  │    │ redirectToWarn() │   │               │
│  │  │ BYPASS_URL   │    └────────┬─────────┘   │               │
│  │  │ NAVIGATE_TO  │             │              │               │
│  │  │ GO_BACK      │             ▼              │               │
│  │  └──────┬───────┘    ┌──────────────────┐   │               │
│  │         │            │ Model Manager    │   │               │
│  │         │            │ (modelManager.js)│   │               │
│  │         │            │                  │   │               │
│  │         │            │ getPredictor()   │   │               │
│  │         │            │ isModelLoaded()  │   │               │
│  │         │            │ resetModel()      │   │               │
│  │         │            └────────┬─────────┘   │               │
│  │         │                     │              │               │
│  │         ▼                     ▼              │               │
│  │  ┌─────────────────────────────────────┐    │               │
│  │  │     Feature Extractor + Predictor   │    │               │
│  │  │     (Pure JS — no dependencies)     │    │               │
│  │  └─────────────────────────────────────┘    │               │
│  └──────────────────────────────────────────────┘               │
│                       │              ▲                          │
│          chrome.tabs   │              │ chrome.runtime           │
│          .update()     │              │ .sendMessage()           │
│          .goBack()     ▼              │                          │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Popup      │  │ Warning  │  │Dashboard │  │ Settings   │  │
│  │  (popup/)   │  │ (warning/│  │(dashboard│  │ (settings/ │  │
│  │             │  │  .html)  │  │  /index  │  │  .html)    │  │
│  │ Status      │  │ Threat   │  │ .html)   │  │            │  │
│  │ Toggle      │  │ Score    │  │ Status    │  │ Protection │  │
│  │ Menu        │  │ Go Back  │  │ Toggle    │  │ Theme      │  │
│  │             │  │ Continue │  │ Version   │  │ Notif.     │  │
│  └──────────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Lifecycle

1. **Install / Startup**: `service_worker.js` → `modelManager.loadModel()` → fetches `rf_trees.json` → validates → instantiates `Predictor`
2. **Navigation**: `chrome.webNavigation.onBeforeNavigate` → `navigationHandler.handleNavigation()` → `analyzeUrl()` → `features` → `predictor.predict()` → redirect or allow
3. **User Interaction**: Popup / Dashboard / Settings send messages → `service_worker.onMessage` handles each type
4. **Model Reset**: Service worker can be terminated by Chrome at any time (MV3). Model is re-loaded on next activation via `getPredictor()`

---

## 2. Machine Learning Architecture

The ML system is a Random Forest classifier exported from scikit-learn and reimplemented in pure JavaScript.

```
┌────────────────────────────────────────────────────────────┐
│                MACHINE LEARNING PIPELINE                    │
│                                                            │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Dataset  │───▸│  Feature     │───▸│  Random Forest   │  │
│  │  (CSV)   │    │  Extraction  │    │  Classifier      │  │
│  │          │    │  (33 cols)   │    │  (100 trees)     │  │
│  └──────────┘    └──────────────┘    └────────┬─────────┘  │
│                                               │             │
│                                               ▼             │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Model Export Pipeline                  │     │
│  │                                                     │     │
│  │  scikit-learn Tree DecisionTreeClassifier           │     │
│  │         │                                           │     │
│  │         ▼                                           │     │
│  │  Custom JSON Serialization                          │     │
│  │  (children_left, children_right, threshold,         │     │
│  │   feature, values for each node)                     │     │
│  │         │                                           │     │
│  │         ▼                                           │     │
│  │  rf_trees.json                                      │     │
│  │  (n_features, n_classes, n_estimators,              │     │
│  │   feature_names, trees[])                            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │           JavaScript Inference Engine               │     │
│  │                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │     │
│  │  │ forestLoader │─▸│  Predictor   │─▸│ Random   │  │     │
│  │  │ .js          │  │  .js         │  │ Forest   │  │     │
│  │  │              │  │              │  │ .js      │  │     │
│  │  │ validate     │  │ validateFeat │  │          │  │     │
│  │  │ fetch        │  │ predict()    │  │ predict()│  │     │
│  │  │ parse        │  │ predictBatch│  │          │  │     │
│  │  └──────────────┘  │ setThreshold │  └────┬─────┘  │     │
│  │                     └──────────────┘       │        │     │
│  │                                            ▼        │     │
│  │                                      ┌──────────┐   │     │
│  │                                      │decision  │   │     │
│  │                                      │Tree.js   │   │     │
│  │                                      │          │   │     │
│  │                                      │walkTree()│   │     │
│  │                                      │countLeaf │   │     │
│  │                                      │getDepth  │   │     │
│  │                                      └──────────┘   │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### Inference Algorithm

1. **Input**: Array of 33 numerical features in fixed order
2. **Validation**: Check array length, type (must be `number`), no `NaN` values
3. **Tree Traversal**: For each of 100 trees:
   - Start at root node (index 0)
   - Compare `features[feature_index]` to `threshold`
   - Navigate left (≤) or right (>) until leaf (`children_left === -1`)
   - Record leaf votes `[count_class_0, count_class_1]`
4. **Aggregation**: Sum votes across all trees → divide by 100 → class probabilities
5. **Decision**: `phishingProbability > threshold` (default 0.5) → phishing

---

## 3. Module Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    MODULE DEPENDENCY GRAPH                       │
│                                                                 │
│  service_worker.js                                               │
│       │                                                         │
│       ├── navigationHandler.js                                   │
│       │       ├── featureBuilder.js                              │
│       │       │       ├── urlParser.js                           │
│       │       │       ├── charCounter.js                         │
│       │       │       └── domainFeatures.js                      │
│       │       │               └── charCounter.js                 │
│       │       │                                                  │
│       │       ├── modelManager.js                                │
│       │       │       ├── predictor.js                           │
│       │       │       │       ├── forestLoader.js                │
│       │       │       │       └── randomForest.js                │
│       │       │       │               └── decisionTree.js        │
│       │       │       │                                          │
│       │       │       └── forestLoader.js                        │
│       │       │                                                  │
│       │       └── storage.js ─── constants.js                    │
│       │                                                          │
│       └── storage.js ─── constants.js                            │
│                                                                  │
│  popup.js ─────────→ chrome.runtime.sendMessage ───→ service_    │
│  warning.js ───────→ chrome.runtime.sendMessage ───→ worker.js   │
│  dashboard.js ─────→ chrome.runtime.sendMessage ───→ (message    │
│  settings.js ──────→ chrome.storage.sync           │  router)    │
│                                                       │          │
│  All pages ←── chrome.tabs.update / goBack ←─────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow (End-to-End)

### Safe URL Flow

```
User clicks link (https://example.com/page)
         │
         ▼
webNavigation.onBeforeNavigate fires
         │
         ▼
handleNavigation(details)
         │
         ├── isProtectionEnabled() → true
         │
         ├── getWarningMode() → "block"
         │
         ├── shouldSkipUrl(url) → false
         │
         ├── analyzeUrl(url)
         │       │
         │       ├── extractFeatures(url)
         │       │       ├── parseUrl(url)
         │       │       ├── countChar() × 20
         │       │       ├── extractDomainFeatures()
         │       │       └── assemble 33-feature vector
         │       │
         │       ├── predictor.predict(features)
         │       │       ├── validateFeatures()
         │       │       ├── randomForest.predict()
         │       │       │       └── walkTree() × 100
         │       │       └── return { isPhishing: false, probability: 0.03 }
         │       │
         │       └── return { prediction: "safe", probability: 0.03 }
         │
         └── prediction === SAFE → do nothing (navigation proceeds)
```

### Phishing URL Flow

```
User clicks link (https://phish.example.com/login?ref=evil)
         │
         ▼
webNavigation.onBeforeNavigate fires
         │
         ▼
handleNavigation(details)
         │
         ├── analyzeUrl(url) → { prediction: "phishing", probability: 0.94 }
         │
         ├── prediction === PHISHING
         │
         ├── redirectToWarning(tabId, url, 0.94)
         │       │
         │       └── chrome.tabs.update(tabId, {
         │             url: "warning.html?targetUrl=...&probability=0.94"
         │           })
         │
         ▼
    Warning Page displays:
    - Original URL
    - Confidence: 94%
    - [Go Back] [Continue Anyway]
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
        webNavigation.onBeforeNavigate fires
                 │
                 ├── handleNavigation()
                 │       └── analyzeUrl() → PHISHING
                 │
                 ├── BUT: bypassedUrls.has(url) → true
                 │       → return { prediction: "safe", bypassed: true }
                 │
                 └── Navigation proceeds to original URL
```

---

## 5. Component Responsibilities

| Component | Responsibility |
|---|---|
| **Service Worker** | Message router, navigation listener, model lifecycle |
| **Navigation Handler** | URL analysis orchestration, skip-list, warning redirect |
| **Model Manager** | Singleton predictor cache, lazy loading |
| **Predictor** | Feature validation, threshold config, result formatting |
| **Random Forest** | Soft-voting aggregation, class probability computation |
| **Decision Tree** | Single tree traversal following scikit-learn node structure |
| **Forest Loader** | Model fetch, parse, structural validation |
| **Feature Builder** | 33-feature extraction orchestration |
| **URL Parser** | URL → {domain, directory, file, params} decomposition |
| **Domain Features** | Domain-specific metrics (length, dots, hyphens, vowels) |
| **Char Counter** | Character occurrence counting utility |
| **Storage** | `chrome.storage.sync` wrapper with typed accessors |
| **Constants** | Enums, storage keys, defaults, warning page config |
