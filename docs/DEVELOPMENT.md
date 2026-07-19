# Development Guide

This guide is for developers who want to contribute to HonEx or extend its functionality.

---

## Development Workflow

```
1. Set up environment     →  Git clone, Chrome, optional Node.js
2. Make changes           →  Edit files in src/
3. Reload extension       →  chrome://extensions → Refresh
4. Test                   →  Verify behavior in Chrome
5. Repeat
```

There is **no build step**. All changes are reflected immediately after refreshing the extension.

---

## Code Conventions

### JavaScript Style

- **Vanilla JavaScript** — No TypeScript, no transpilers, no frameworks
- **ES Modules** — Use `import` / `export` consistently
- **No external dependencies** — All code must be self-contained
- **async/await** — Prefer over raw Promises for readability
- **Descriptive names** — Use clear, self-documenting variable and function names

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | `camelCase.js` | `navigationHandler.js` |
| Classes | `PascalCase` | `class RandomForest` |
| Functions | `camelCase` | `extractFeatures()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_TRAVERSAL_DEPTH` |
| Exports | Named exports preferred | `export function analyzeUrl()` |
| Variables | `camelCase` | `const modelUrl` |

### Code Organization

- **Single responsibility** — Each file should have one clear purpose
- **Barrel exports** — Use `index.js` to re-export related modules
- **Pure functions** where possible — Minimize side effects
- **Error handling** — Every async operation should have try/catch

---

## Folder Conventions

```
src/
├── ml/               Machine learning inference engine
├── featureExtractor/ URL feature extraction
├── background/       Extension background (service worker)
├── popup/            Popup UI
├── warning/          Warning page
├── dashboard/        Dashboard / About page
├── settings/         Settings page
├── utils/            Shared utilities
└── assets/           Static resources
```

### Adding a New Directory

1. Create the directory under `src/`
2. Add an `index.js` barrel export if it has multiple modules
3. Import from other modules using relative paths (e.g., `'../ml/predictor.js'`)

---

## How to Add a New Feature

### Example: Add a "Blocked Sites Counter"

**Step 1: Create the module**

`src/analytics/stats.js`:
```javascript
import { get, set } from '../utils/storage.js';

const STATS_KEY = 'blockedCount';

export async function getBlockedCount() {
  return await get(STATS_KEY) || 0;
}

export async function incrementBlockedCount() {
  const current = await getBlockedCount();
  await set(STATS_KEY, current + 1);
}
```

**Step 2: Integrate with background**

In `src/background/navigationHandler.js`:
```javascript
import { incrementBlockedCount } from '../analytics/stats.js';

// In redirectToWarning() before redirecting:
await incrementBlockedCount();
```

**Step 3: Expose via message API**

In `src/background/service_worker.js`:
```javascript
import { getBlockedCount } from '../analytics/stats.js';

case 'GET_STATS':
  const count = await getBlockedCount();
  sendResponse({ blockedCount: count });
  return true;
```

**Step 4: Display in UI**

In `src/dashboard/dashboard.js`:
```javascript
const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
document.getElementById('blockedCount').textContent = stats.blockedCount;
```

---

## How to Modify the ML Model

### Retraining the Model

1. Open Jupyter notebooks in `trash/notebook/`
2. Modify the training pipeline (`modelTraining.ipynb`)
3. Re-run hyperparameter tuning if needed (`modelTuning.ipynb`)
4. Re-export to JSON (`ExportRFTreesToJson.ipynb`)

### Exporting a New Model

The export notebook saves to `trash/hasil/rf_trees.json`. Copy it:

```bash
cp trash/hasil/rf_trees.json src/ml/rf_trees.json
```

### Updating Feature Order

If you add or remove features:

1. Update `feature_order.json` in the Python pipeline
2. Update `FEATURE_ORDER` in `src/featureExtractor/featureBuilder.js`
3. Update model metadata in `trash/hasil/selected_features.json`
4. Ensure the JavaScript validation tests pass

---

## How to Update Exported Model Files

When the Python training pipeline produces new artifacts:

| Artifact | Source | Destination |
|---|---|---|
| `rf_trees.json` | `trash/hasil/` | `src/ml/` |
| `feature_order.json` | `trash/hasil/` (reference) | Mirror in `featureBuilder.js` |
| `selected_features.json` | `trash/hasil/` (reference) | Documentation |

---

## Testing

### Manual Testing

1. **Load the extension** in Chrome
2. **Open background console** (`chrome://extensions` → Inspect views: background page)
3. **Monitor logs** — HonEx logs navigation events and model status
4. **Test with known URLs**:
   - Safe: `https://www.google.com`, `https://github.com`, `https://www.wikipedia.org`
   - Suspicious: `http://secure-login.paypal.com.evil-site.net/signin/confirm.php?user=test@email.com`

### Automated Tests (Node.js)

Test scripts are in `trash/tests/`:

```bash
node trash/tests/test_inference.mjs
node trash/tests/test_features.mjs
```

These test:
- Model loading and validation
- Feature extraction edge cases
- Prediction determinism
- NaN and invalid input handling
- Batch prediction
- Feature order alignment

### What to Test After Changes

| Change | Test |
|---|---|
| Modified feature extraction | Run `node test_features.mjs` |
| Updated model | Run `node test_inference.mjs` |
| Changed import paths | Reload extension, check for console errors |
| Added UI elements | Open popup/dashboard/warning, check for errors |
| Changed storage keys | Open settings, toggle settings, reload extension |

---

## Debugging Tips

### Background Worker Console

```
chrome://extensions
    → Find HonEx
    → Click "Service Worker" link
    → Console opens with [HonEx] prefixed logs
```

### Extension-Specific DevTools

1. Right-click the popup → **Inspect**
2. Right-click the warning page → **Inspect**
3. Dashboard/settings pages → <kbd>F12</kbd> as normal

### Common Debugging Commands

```javascript
// Check model status (in background console)
await (await import('./modelManager.js')).isModelLoaded()

// Analyze a URL manually (in background console)
const { analyzeUrl } = await import('./navigationHandler.js');
await analyzeUrl('https://example.com');

// Check storage values (in any console)
await chrome.storage.sync.get(null);

// Reset all settings to defaults
await chrome.storage.sync.clear();
```

---

## Build Pipeline

Currently there is no build pipeline. The extension works as plain JavaScript files.

If you want to add one (recommended for production), consider:

- **Vite** — Fast bundler with ES module support
- **Webpack** — Mature ecosystem with Chrome Extension plugins
- **ESBuild** — Extremely fast, good for simple bundling

Benefits of a build pipeline:
- Tree-shaking to reduce model + code size
- Minification for smaller bundles
- TypeScript support for type safety
- Asset optimization for images

---

## Code Review Checklist

Before submitting a pull request:

- [ ] All imports are correct (relative paths)
- [ ] No `console.log()` left in production code (use `console.log` with `[HonEx]` prefix for intentional logging)
- [ ] Error handling covers async operations
- [ ] New constants are added to `constants.js`
- [ ] New storage keys are added to `storage.js`
- [ ] Feature order in `featureBuilder.js` matches `feature_order.json`
- [ ] Extension loads without errors in Chrome
- [ ] Popup, warning, dashboard, and settings pages all work
