# Installation Guide

This guide walks you through installing HonEx in Google Chrome step by step. No build tools or package managers are required — the extension is ready to load as-is.

---

## Prerequisites

| Requirement   | Minimum Version                           |
| ------------- | ----------------------------------------- |
| Google Chrome | 88+ (Manifest V3 support)                 |
| Node.js       | Not required (optional for running tests) |

No npm packages, no build step, no compilers.

---

## Step 1: Download the Extension

Download the latest release (recommended for users) or clone the repository (for developers):

```bash
# Option A — Download from Releases (recommended)
# Go to: https://github.com/hafourenai/HonEx/releases
# Download the latest Source code (zip) or HonEx.zip
# Extract the src/ folder to a location on your computer

# Option B — Clone with Git (for development/contribution)
git clone https://github.com/hafourenai/HonEx.git
cd HonEx
```

> **Note**: The extension source code is in the `src/` folder. If you downloaded from Releases, ensure the `src/` folder is extracted correctly.

---

## Step 2: Open Chrome Extensions

Open Google Chrome and navigate to:

```
chrome://extensions
```

You can also access this via:

1. Click the three-dot menu (⋮) in the top-right corner
2. Go to **Extensions** → **Manage Extensions**

---

## Step 3: Enable Developer Mode

Toggle **Developer mode** on in the top-right corner of the Extensions page.

```
┌─────────────────────────────────────────────────────────────┐
│  Extensions                                                  │
│                                                             │
│  ┌───────────────────────────────────────────────────┐      │
│  │  ┌────────────────────────────────────────────┐   │      │
│  │  │  Developer mode  ────────────────── [ON]   │   │      │
│  │  └────────────────────────────────────────────┘   │      │
│  │                                                    │      │
│  │  [Load unpacked]  [Pack extension]  [Update]      │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

When Developer mode is enabled, three new buttons appear: **Load unpacked**, **Pack extension**, and **Update**.

---

## Step 4: Load the Extension

Click the **Load unpacked** button.

A file dialog will open. Navigate to the HonEx project folder and **select the `src/` folder** (not the root project folder).

```
HonEx/
├── src/          ◄── Select this folder
│   ├── manifest.json
│   ├── background/
│   ├── popup/
│   ├── warning/
│   └── ...
├── docs/
└── trash/
```

After selecting the folder, the extension should appear in the extensions list:

```
HonEx - AI Phishing Protection
┌────────────────────────────────────────────────────────────┐
│  HonEx - AI Phishing Protection                            │
│  ID: abcdefghijklmnopabcdefghijklmnop                       │
│  Version: 1.0.0                                             │
│  Real-time phishing detection powered by on-device          │
│  machine learning. All analysis happens locally in your     │
│  browser.                                                   │
│                                                             │
│  [Details]  [Remove]  [Service Worker]                      │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Errors: 0 │ Warnings: 0 │  │  ───  │  ○        │      │
│  └──────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
```

> **Troubleshooting**: If you see an error, check that you selected the `src/` folder (which contains `manifest.json`), not the project root.

---

## Step 5: Verify Installation

### Check the Icon

The HonEx icon (shield with "H") should appear in the Chrome toolbar:

```
┌─────────────────────────────────────────────────────────────┐
│  ⋮  ○  ○  ○  ○  ○  ○  ○  ○  ○  ○  ○  ○  ○  ○  │  H  │  ⋮  │
└─────────────────────────────────────────────────────────────┘
                                    ▲
                              HonEx icon
```

### Pin the Extension

Click the puzzle piece (Extensions) icon in the toolbar, then click the pin icon next to HonEx to keep it visible.

### Open the Popup

Click the HonEx icon to open the popup:

```
┌──────────────────────┐
│  HonEx       [Active]│
│                      │
│  ● Protection Active │
│                      │
│  PROTECTION          │
│  Enable Protection [ON]│
│                      │
│  SETTINGS            │
│  ⚙ Settings      →   │
│  ℹ About         →   │
│                      │
│  Random Forest |     │
│  Model Loaded        │
└──────────────────────┘
```

### Test the Extension

1. **Verify protection is active** — The popup should show "Protection Active" and the toggle should be on
2. **Open a safe website** — Visit `https://www.google.com` — it should load normally
3. **Check model status** — The popup should show "Random Forest | Model Loaded"
4. **Open Dashboard** — Click "About" in the popup menu to open the full dashboard
5. **Open Settings** — Click "Settings" to see the options page

---

## Step 6: Verify the Warning Page

To verify the warning page works correctly, you can simulate a phishing URL detection:

1. Enable protection (toggle ON)
2. Open the background console:
   - Go to `chrome://extensions`
   - Click **Service Worker** (or **Inspect views: background page**)
   - You should see: `[HonEx] Model loaded successfully`
3. Visit any URL — the console will log analysis results

---

## Step 7: (Optional) Running Tests

If you have Node.js installed, you can verify the ML engine works correctly:

```bash
cd trash/tests
node test_inference.mjs
node test_features.mjs
```

These tests validate:

- Model loading and validation
- Feature extraction with real URLs
- End-to-end prediction accuracy
- Edge case handling (invalid URLs, NaN values)

---

## Troubleshooting Installation

| Problem                                                                 | Solution                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **"Manifest is not valid JSON"**                                        | Open `src/manifest.json` and check for syntax errors (missing commas, trailing commas)           |
| **"Permission 'webNavigation' is unknown or URL pattern is malformed"** | Verify you're using Chrome 88+ (MV3 requirement)                                                 |
| **Extension loads but model won't load**                                | Check `src/ml/rf_trees.json` exists (≈ 23 MB). If missing, copy from `trash/hasil/rf_trees.json` |
| **"Failed to load extension" with no details**                          | Open Chrome DevTools → Console for the extensions page to see detailed errors                    |
| **Icon not showing in toolbar**                                         | Click the puzzle piece icon → Find HonEx → Click the pin icon                                    |
| See [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for more                 |

---

## Updating the Extension

After making changes to the source code:

1. Go to `chrome://extensions`
2. Find HonEx
3. Click the **⟳ Refresh** icon on the extension card
4. Or press <kbd>Ctrl+R</kbd> (<kbd>Cmd+R</kbd> on Mac) on the extensions page
