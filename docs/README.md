# HonEx — AI Phishing Protection

**HonEx** (Honor + Examine) is a privacy-first Chrome Extension that detects phishing websites in real time using on-device machine learning. All analysis runs locally inside the browser — no data ever leaves your device.

---

## Motivation

Phishing attacks remain one of the most common and damaging cybersecurity threats. Existing solutions either rely on cloud-based APIs (raising privacy concerns) or static blocklists that cannot keep up with newly registered malicious domains.

HonEx addresses both problems:

- **Privacy**: The entire ML model runs client-side. URLs are never sent to external servers.
- **Zero-delay detection**: A Random Forest classifier with 100 trees analyzes URL structure instantly, catching zero-hour phishing attempts that blocklists miss.

---

## Features

| Feature                    | Description                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------- |
| **On-device ML**           | 100-tree Random Forest runs entirely in the browser via pure JavaScript             |
| **Real-time interception** | `webNavigation` API blocks phishing pages before they load                          |
| **33 URL features**        | Extracts character counts, domain metrics, structural patterns, and anomaly signals |
| **95.16% accuracy**        | Trained on real-world phishing datasets with 93.12% precision and 93.02% recall     |
| **Privacy-first**          | No network requests, no telemetry, no third-party APIs                              |
| **Dashboard**              | Live protection status, model health, and toggle controls                           |
| **Settings**               | Persistent configuration via `chrome.storage.sync`                                  |
| **Warning page**           | Clear threat display with confidence score, Go Back, and Continue Anyway            |

---

## Technologies Used

| Layer               | Technology                                                |
| ------------------- | --------------------------------------------------------- |
| Extension Framework | Chrome Manifest V3                                        |
| ML Model            | scikit-learn RandomForestClassifier (100 estimators)      |
| Inference Engine    | Pure JavaScript (zero dependencies)                       |
| Feature Extraction  | Native `URL` API + custom parsers                         |
| Storage             | `chrome.storage.sync`                                     |
| UI                  | Vanilla HTML/CSS/JS                                       |
| Training            | Python 3, pandas, numpy, scikit-learn, Jupyter            |
| Model Export        | Custom JSON serialization of scikit-learn tree structures |

---

## Folder Structure

```
HonEx/
├── src/                    # Chrome Extension source
│   ├── assets/             Icons, logo, developer photo
│   ├── background/         Service worker, navigation handler, model manager
│   ├── dashboard/          About / status page
│   ├── featureExtractor/   URL parsing & 33-feature extraction
│   ├── ml/                 Random Forest inference engine
│   ├── popup/              Extension popup UI
│   ├── settings/           Settings page (Chrome Storage API)
│   ├── utils/              Constants, storage wrapper
│   ├── warning/            Phishing warning page
│   └── manifest.json       Extension manifest (MV3)
├── docs/                   Project documentation
├── trash/                  Deprecated files & ML training artifacts
└── README.md               This file
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHROME BROWSER                             │
│                                                                 │
│  ┌──────────┐   webNavigation    ┌──────────────────────────┐   │
│  │  User    │ ──────────────────▸│  Background Worker       │   │
│  │  clicks  │                    │  (service_worker.js)     │   │
│  │  link    │                    │                          │   │
│  └──────────┘                    │  ┌─────────────────────┐ │   │ 
│                                  │  │ Navigation Handler  │ │   │
│       ┌──────────────────┐       │  │                     │ │   │
│       │  Warning Page    │◂──────│  │ analyzeUrl()        │ │   │
│       │  (redirect if    │       │  │ bypass check        │ │   │
│       │   phishing)      │       │  │ redirectToWarning() │ │   │
│       └──────────────────┘       │  └─────────┬───────────┘ │   │
│                                  │            │             │   │
│  ┌──────────────────┐            │            ▼             │   │
│  │  Popup UI        │◂───msg─────│  ┌─────────────────────┐ │   │
│  │  (toggle status) │            │  │  Feature Extractor  │ │   │
│  └──────────────────┘            │  │  + Predictor        │ │   │
│                                  │  │  + Calibration      │ │   │
│  ┌──────────────────┐            │  └─────────────────────┘ │   │
│  │  Dashboard       │◂───msg─────│                          │   │
│  │  (status/health) │            │  Redirect Tracking:      │   │
│  └──────────────────┘            │  onBeforeRedirect        │   │
│                                  │  → domainRedirectHistory │   │
│  ┌──────────────────┐            │  Bypass:                 │   │
│  │  Settings        │  chrome.   │  bypassedUrls Set (30s)  │   │
│  │  (persistent)    │  storage   └──────────────────────────┘   │
│  └──────────────────┘  .sync                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow Overview

1. User clicks a link or types a URL
2. `chrome.webNavigation.onBeforeNavigate` fires in the background service worker
3. The navigation handler extracts 33 structural features from the URL
4. The Random Forest engine scores the URL (100 decision trees, majority vote)
5. **If safe** → navigation proceeds normally (no delay)
6. **If phishing** → tab redirects to the local warning page with confidence score
7. User can **Go Back** or **Continue Anyway** (with a 30-second bypass window)

---

## Installation

**For users** — Download the latest release from the [Releases page](https://github.com/hafourenai/HonEx/releases), extract the `src/` folder, and load it into Chrome.

**For developers** — Clone the repository to modify or contribute:

```bash
git clone https://github.com/hafourenai/HonEx.git
cd HonEx
```

### Loading into Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `src/` folder

No build step, no package manager, no dependencies. The extension is ready to load as-is.

Detailed instructions in [`INSTALLATION.md`](INSTALLATION.md).

---

## Performance

| Metric         | Value                       |
| -------------- | --------------------------- |
| Model Accuracy | 95.16%                      |
| Precision      | 93.12%                      |
| Recall         | 93.02%                      |
| F1 Score       | 93.07%                      |
| ROC-AUC        | 0.9876                      |
| Features       | 33                          |
| Decision Trees | 100                         |
| Inference Time | < 5ms (typical)             |
| Model Size     | ≈ 23 MB (uncompressed JSON) |

---

## Troubleshooting

| Problem                                                 | Solution                                   |
| ------------------------------------------------------- | ------------------------------------------ |
| Extension won't load                                    | Verify Chrome version ≥ 88 (MV3 support)   |
| Model not loading                                       | Check that `rf_trees.json` is in `src/ml/` |
| Warning page loops                                      | Fixed in v1.0.0 — bypass mechanism active  |
| Protection not working                                  | Check toggle in popup or settings          |
| See [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for more |
