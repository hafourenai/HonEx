# Project Structure

This document describes every folder and file in the HonEx project.

---

## Root Directory

```
HonEx/
├── src/               Chrome Extension source code (loadable directly)
├── docs/              Project documentation
├── trash/             Deprecated files, ML training artifacts, datasets
└── README.md          Main project overview
```

---

## `src/` — Chrome Extension Source

The `src/` directory is the root of the unpacked Chrome Extension. It is loadable directly via `chrome://extensions` → Load unpacked.

### `src/manifest.json`

The Manifest V3 configuration file. Defines permissions (`webNavigation`, `storage`, `tabs`), the background service worker, popup, options page, icons, and web-accessible resources (the ML model and warning page).

### `src/assets/`

Static assets used by the extension's UI pages.

| File | Purpose |
|---|---|
| `icons/icon-16.svg` | 16×16 toolbar icon |
| `icons/icon-48.svg` | 48×48 extensions management icon |
| `icons/icon-128.svg` | 128×128 Chrome Web Store icon |
| `Logo.png` | HonEx logo (used in dashboard) |
| `Foto.png` | Developer photo (used in About section) |

### `src/ai/`

Lightweight AI-powered detection modules (pure JavaScript, zero dependencies, zero additional downloads).

| File | Purpose |
|---|---|---|
| `brands.js` | **Shared brand list.** Centralized, authoritative list of 60 protected brands (Google, Mandiri, BCA, Gojek, Github, Gitlab, etc.). Single source of truth consumed by both the typosquatting detector and navigation handler (brand whitelist). Add/remove brands in one place. |
| `typosquattingDetector.js` | Typosquatting detector using Levenshtein distance + homoglyph decoding. Imports `BRAND_NAMES` from `brands.js`. Catches `g00gle.com`, `rnandiri.com`, `shopee-sale.com`, etc. |

### `src/background/`

Contains the extension's persistent background service worker (Manifest V3).

| File | Purpose |
|---|---|
| `service_worker.js` | **Entry point.** Registers navigation listener, handles runtime messages from popup/warning/settings/dashboard, manages model pre-loading on install and startup |
| `navigationHandler.js` | URL analysis logic. Determines whether to skip internal URLs, runs feature extraction + prediction, handles gray zone (brand whitelist, DNS resolve, typosquatting check), and redirects to the warning page if phishing is confirmed |
| `modelManager.js` | Model lifecycle manager. Loads the `rf_trees.json` model file on first request, caches it in memory, and provides a singleton `Predictor` instance |

### `src/ml/`

The pure-JavaScript Random Forest inference engine. Zero dependencies.

| File | Purpose |
|---|---|
| `index.js` | Barrel exports for all ML modules |
| `predictor.js` | High-level prediction API. Validates feature input, runs inference, returns formatted results (prediction, probability, confidence, threshold) |
| `randomForest.js` | Random Forest aggregation engine. Iterates all 100 trees, collects leaf votes (soft voting), computes class probabilities |
| `decisionTree.js` | Decision tree traversal. Navigates each tree from root to leaf following scikit-learn's binary split logic |
| `forestLoader.js` | Model loader and validator. Fetches `rf_trees.json` from extension URL, validates structure (required keys, array lengths, feature indices) |
| `rf_trees.json` | Serialized Random Forest model (100 trees, 33 features). Exported from Python scikit-learn via custom JSON serialization |

### `src/featureExtractor/`

Extracts 33 numerical features from raw URLs for ML inference.

| File | Purpose |
|---|---|
| `index.js` | Barrel exports for all feature extraction modules |
| `featureBuilder.js` | **Orchestrator.** Parses the URL, delegates to sub-modules, assembles the 33-feature vector in the exact order required by the model (`FEATURE_ORDER`). Handles overrides for features that cannot be computed in-browser (`qty_mx_servers`, `qty_redirects`) |
| `urlParser.js` | URL component parser. Splits a URL into domain, directory, file, and query string components. Adds `http://` prefix if no scheme is present |
| `domainFeatures.js` | Domain-specific features: length, dot count, hyphen count, vowel count, TLD segment count, email address detection |
| `charCounter.js` | Low-level utilities for counting character occurrences and vowels in strings |

### `src/utils/`

Shared utilities across the extension.

| File | Purpose |
|---|---|
| `constants.js` | Enums and constants: prediction states (`SAFE`, `PHISHING`, `ERROR`), storage keys, default values, warning modes (`BLOCK`, `WARN`, `LOG`), warning page config |
| `storage.js` | Chrome Storage API wrapper. Provides typed `async get/set` functions for each configuration key (protection enabled, threshold, theme, notifications, warning mode). Falls back to defaults on error |

### `src/popup/`

The extension's action popup (clicking the toolbar icon).

| File | Purpose |
|---|---|
| `popup.html` | Popup UI (320×400px). Displays protection status badge, toggle switch, model info, and navigation links to Settings and About |
| `popup.js` | Popup logic. Communicates with background service worker via `chrome.runtime.sendMessage` to get/set status. Opens settings via `chrome.runtime.openOptionsPage()` and dashboard via `chrome.tabs.create` |

### `src/dashboard/`

The About / Status page (opened from the popup).

| File | Purpose |
|---|---|
| `index.html` | Full-page dashboard with protection status hero, info cards (Model, Detection, Execution, Privacy), How It Works timeline, and About the Developer section. Uses Tailwind CSS via CDN |
| `dashboard.js` | Connects the static dashboard to the extension API. Fetches protection status and model load state from background worker, controls the toggle, shows version info |

### `src/settings/`

The options page (opened via `chrome.runtime.openOptionsPage()`).

| File | Purpose |
|---|---|
| `settings.html` | Settings UI with toggles for Protection and Notifications, dropdowns for Theme and Warning Mode. Dark-mode-compatible styling |
| `settings.js` | Reads initial values from `chrome.storage.sync`, saves changes on interaction, shows a brief "Settings saved" confirmation |

### `src/warning/`

The phishing warning page displayed when a URL is classified as malicious.

| File | Purpose |
|---|---|
| `warning.html` | Warning page with dark red theme. Shows the suspicious URL, a threat confidence progress bar, and two action buttons: **Go Back** and **Continue Anyway** |
| `warning.js` | Parses URL and probability from query parameters. Handles Go Back (via `chrome.tabs.goBack`) and Continue Anyway (sends `BYPASS_URL` message to background, then navigates) |

---

## `trash/` — Deprecated Files

Files that are no longer part of the active extension but preserved for reference.

| Path | Content |
|---|---|
| `trash/hasil/` | Python ML outputs (feature_order.json, selected_features.json, model.pkl — the Python pickle version of the same model) |
| `trash/notebook/` | Jupyter notebooks for data cleaning, feature audit, model training, hyperparameter tuning, and RF-to-JSON export |
| `trash/tests/` | Node.js test scripts (test_inference.mjs, test_features.mjs) |
| `trash/done/` | Processed training/testing CSV datasets |
| `trash/dataset2.csv` | Raw phishing dataset used for training |
| `trash/content.js` | Empty content script placeholder (no longer needed) |

---

## `docs/` — Documentation

| File | Purpose |
|---|---|
| `README.md` | Main project overview and quickstart |
| `PROJECT_STRUCTURE.md` | This file — folder and file reference |
| `ARCHITECTURE.md` | Software and ML architecture with diagrams |
| `ML_PIPELINE.md` | End-to-end ML training and deployment pipeline |
| `FEATURE_EXTRACTION.md` | URL feature extraction methodology |
| `INSTALLATION.md` | Step-by-step installation for beginners |
| `USAGE.md` | User guide — how to interact with the extension |
| `DEVELOPMENT.md` | Developer guide — extending the project |
| `API_REFERENCE.md` | Class and module API documentation |
| `TROUBLESHOOTING.md` | Common problems and solutions |
| `CHANGELOG.md` | Version history |
