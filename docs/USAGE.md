# Usage Guide

This guide explains how to use HonEx — from installation to daily browsing.

---

## Quick Start

```
1. Install the extension     →  See INSTALLATION.md
2. Enable protection          →  Popup toggle (default: ON)
3. Browse the web normally    →  HonEx analyzes every URL
4. Safe websites load normally
5. Phishing sites → Warning page
```

---

## Interface Overview

HonEx has four main interfaces:

| Interface | How to Access | Purpose |
|---|---|---|
| **Popup** | Click the toolbar icon | Quick status, protection toggle, menu |
| **Dashboard** | Popup → About | Full status, how it works, developer info |
| **Settings** | Popup → Settings | Configure protection, theme, notifications |
| **Warning Page** | Automatically shown | Threat alert when phishing is detected |

---

## 1. Enabling / Disabling Protection

### Via Popup

1. Click the HonEx icon in the Chrome toolbar
2. The popup shows the current protection status
3. Click the **Enable Protection** toggle to turn protection ON or OFF
4. The status badge and dot update immediately

```
  ┌──────────────────────┐
  │  HonEx       [Active] │   ← Green badge = active
  │                       │      Red badge = inactive
  │  ● Protection Active  │
  │                       │
  │  Enable Protection  [●]│   ← Toggle ON = blue
  └──────────────────────┘
```

### Via Settings

1. Open the popup → Click **Settings**
2. Toggle **Enable Protection** on/off
3. Changes are saved automatically to `chrome.storage.sync`

### Via Dashboard

1. Open the popup → Click **About**
2. The dashboard hero section shows protection status with a toggle
3. Changes update the entire UI in real time

---

## 2. Normal Browsing (Safe URLs)

When protection is enabled and you visit a legitimate website:

1. The URL is intercepted by `chrome.webNavigation.onBeforeNavigate`
2. HonEx extracts 33 features from the URL
3. The Random Forest classifies the URL as **safe**
4. Navigation proceeds normally with zero visible delay
5. No popup, no warning, no interruption

There is **no visible performance impact** during normal browsing.

---

## 3. Phishing Detection (Warning Page)

When HonEx detects a phishing URL:

1. The page load is interrupted
2. Your tab is redirected to the local **Warning Page**
3. You see:

```
┌──────────────────────────────────────┐
│                  !                   │
│                                      │
│   Potential Phishing Website         │
│   Detected                           │
│                                      │
│   HonEx's AI model analyzed this     │
│   URL and found suspicious patterns  │
│                                      │
│   ┌──────────────────────────────┐   │
│   │ https://phishing-example.    │   │
│   │ com/login/verify             │   │
│   └──────────────────────────────┘   │
│                                      │
│   Threat Confidence                  │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░  94%        │
│                                      │
│   [  Go Back  ]  [Continue Anyway]   │
│                                      │
│   HonEx - AI Phishing Protection     │
└──────────────────────────────────────┘
```

The warning page displays:
- **The suspicious URL** — full URL so you can inspect it
- **Threat Confidence** — a progress bar and percentage (0–100%)
- **Go Back** button — returns to the previous page
- **Continue Anyway** button — proceeds to the URL despite the warning

---

## 4. Go Back

Click **Go Back** to return to the previous page:

- Uses `chrome.tabs.goBack()` API
- Falls back to `window.history.back()` if the tab API fails
- No further analysis of the blocked URL

---

## 5. Continue Anyway

Click **Continue Anyway** to proceed to the flagged URL:

1. HonEx sends a `BYPASS_URL` message to the background service worker
2. The URL is added to a temporary bypass list (30-second expiration)
3. The tab navigates to the original URL
4. During the bypass window, the URL is not re-flagged as phishing

> **⚠️ Warning**: Only use "Continue Anyway" if you are absolutely certain the website is safe. HonEx's ML model has 95% accuracy, but no model is perfect.

---

## 6. Settings

Open Settings from the popup menu to configure:

| Setting | Options | Default | Persistence |
|---|---|---|---|
| **Enable Protection** | ON / OFF | ON | `chrome.storage.sync` |
| **Theme** | Light / Dark | Light | `chrome.storage.sync` |
| **Phishing Alerts** | ON / OFF | ON | `chrome.storage.sync` |
| **Action on Threat** | Block / Warn Only / Log Only | Block | `chrome.storage.sync` |

### Warning Modes Explained

| Mode | Behavior |
|---|---|
| **Block** | Redirects to warning page and blocks navigation. User can click "Continue Anyway" to proceed |
| **Warn Only** | Does not block navigation. Only logs the detection to console |
| **Log Only** | No user-facing action. Detection is logged silently |

---

## 7. Dashboard

The Dashboard (popup → About) provides:

- **Protection Status** — Active/Inactive with green/red indicator
- **Protection Toggle** — Enable/disable protection
- **Model Status** — Shows whether the Random Forest model is loaded
- **Info Cards** — Model, Detection, Execution, Privacy
- **How It Works** — Visual workflow explanation
- **About** — Developer information and version number

---

## 8. Keyboard Shortcuts

Chrome does not support custom keyboard shortcuts for MV3 extensions by default. To access HonEx quickly:

- <kbd>Alt+Shift+H</kbd> — Open the HonEx popup (customize in `chrome://extensions/shortcuts`)

To set this up:
1. Go to `chrome://extensions/shortcuts`
2. Find **HonEx - AI Phishing Protection**
3. Click the pencil icon next to "Activate the extension"
4. Press your desired shortcut (e.g., <kbd>Ctrl+Shift+H</kbd>)

---

## Privacy

HonEx is designed with privacy as a core principle:

- **All analysis is local** — The ML model runs 100% in-browser
- **No data sent** — URLs are never transmitted to external servers
- **No telemetry** — No usage statistics collected
- **No accounts** — No login, no registration required
- **No persistent history** — Detected URLs are not stored (except temporary bypasses)

You can verify this by monitoring network requests in Chrome DevTools while using HonEx. You will see no outbound requests related to URL analysis.

---

## Tips

- **Keep protection ON** — HonEx has minimal performance impact but provides significant protection
- **Report false positives** — If a safe site is flagged, use "Continue Anyway" and note the URL
- **Stay updated** — Check for new versions to get model improvements
- **Trust but verify** — Even with 95% accuracy, use common sense when browsing
