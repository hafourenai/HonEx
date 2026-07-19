# Troubleshooting

Common problems encountered while installing, loading, or using HonEx, with solutions.

---

## Installation Problems

### Extension won't load in Chrome

**Symptoms**:
- "Failed to load extension" error
- "Manifest is not valid JSON"
- Extension appears but has errors

**Solutions**:

1. **Check Chrome version**: HonEx requires Chrome 88+ (Manifest V3). Go to `chrome://settings/help` to verify.

2. **Verify manifest JSON**: Open `src/manifest.json` and validate the JSON syntax:
   - No trailing commas
   - All keys and strings are double-quoted
   - No comments (JSON does not support `//` or `/* */`)

3. **Select the correct folder**: When loading unpacked, select the `src/` folder (containing `manifest.json`), not the project root.

4. **Check permissions**: Ensure `webNavigation`, `storage`, and `tabs` permissions are present in `manifest.json`.

5. **Check for conflicting extensions**: Temporarily disable other extensions that intercept navigation (ad blockers, security extensions) to isolate conflicts.

### "Permission 'webNavigation' is unknown" error

**Cause**: This error occurs on Chrome versions below 88 or on non-Chromium browsers (Firefox, Safari).

**Solution**: Upgrade to Chrome 88+. HonEx is designed exclusively for Chromium-based browsers.

### Model file not found

**Symptom**: Background console shows `"Gagal memuat model dari ... : HTTP 404"`.

**Solutions**:

1. Verify `src/ml/rf_trees.json` exists and is not empty:
   ```bash
   ls -la src/ml/rf_trees.json
   # Should be ≈ 23 MB
   ```

2. Check the web-accessible-resources in `manifest.json`:
   ```json
   "web_accessible_resources": [{
     "resources": ["ml/rf_trees.json", "warning/warning.html"],
     "matches": ["<all_urls>"]
   }]
   ```

3. If the file was accidentally deleted, restore it:
   ```bash
   cp trash/hasil/rf_trees.json src/ml/rf_trees.json
   ```

---

## Runtime Problems

### Protection not working

**Symptoms**:
- Phishing URLs load without warning
- Warning page never appears
- Popup shows "Protection Disabled"

**Solutions**:

1. **Check the toggle**: Open popup → verify "Enable Protection" is ON (blue).

2. **Check settings**: Open Settings → verify "Enable Protection" is ON.

3. **Check warning mode**: Open Settings → verify "Action on Threat" is set to "Block (Show Warning)".

4. **Reload the extension**: Go to `chrome://extensions` → click the Refresh icon on HonEx.

5. **Check background console**: Open `chrome://extensions` → "Service Worker" → look for error messages:
   - `[HonEx] Model loaded successfully` (good)
   - `[HonEx] Gagal memuat model...` (bad)
   - `[HonEx] PHISHING DETECTED: ...` (detection working)

### Warning page appears in a loop

**Symptom**: After clicking "Continue Anyway," the warning page reappears immediately.

**Cause**: The bypass mechanism is not working. The `BYPASS_URL` message is not reaching the background worker.

**Solutions**:

1. **Check message routing**: Open background console and verify the `BYPASS_URL` message is received:
   - Should show no error for the message type
   - `bypassedUrls` Set should contain the URL

2. **Reload the extension**: This resets the bypass Set and the service worker.

3. **Check for manifest errors**: Ensure `background.type` is set to `"module"` in `manifest.json`.

4. **Update warning.js**: Verify the Continue Anyway handler sends `BYPASS_URL` before navigation:
   ```javascript
   await chrome.runtime.sendMessage({
     type: 'BYPASS_URL',
     url: targetUrl
   });
   ```

### Popup not showing correct status

**Symptom**: Popup shows "Loading..." or incorrect status.

**Solutions**:

1. **Reload the extension**: The service worker may have been terminated (normal for MV3).

2. **Check message response**: Open popup inspect console (right-click popup → Inspect):
   ```javascript
   const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
   console.log(response);
   ```

3. **Verify storage values**: Check what's stored:
   ```javascript
   await chrome.storage.sync.get(null);
   ```

### Model loads slowly

**Symptom**: Extension works but there's a delay when Chrome starts or the extension is first activated.

**Cause**: The `rf_trees.json` file is ≈ 23 MB. Loading and parsing this file takes time.

**Solutions**:

1. **Pre-loading**: The extension already pre-loads on `onInstalled` and `onStartup`. This is normal behavior.

2. **Model optimization** (future): The model could be quantized or pruned to reduce size.

3. **Lazy loading**: Models load on first navigation request if pre-loading fails. Navigation is blocked briefly during first load.

---

## Development Problems

### Import errors in background worker

**Symptom**: Console shows `"Uncaught TypeError: Failed to resolve module specifier"`.

**Cause**: Incorrect relative import path after restructuring.

**Solution**: Check the import paths in background files:

| File | Import | Should Be |
|---|---|---|
| `service_worker.js` | `'../utils/storage.js'` | Check path from `background/` to `utils/` |
| `navigationHandler.js` | `'../featureExtractor/featureBuilder.js'` | From `background/` to `featureExtractor/` |
| `modelManager.js` | `'../ml/predictor.js'` | From `background/` to `ml/` |

Paths are relative to the importing file's location.

### "Cannot use import statement outside a module"

**Symptom**: Chrome shows this error for the service worker.

**Solution**: Ensure `manifest.json` has:
```json
"background": {
  "service_worker": "background/service_worker.js",
  "type": "module"
}
```

The `"type": "module"` is required for ES module `import`/`export` syntax.

### Predictions always return "legitimate"

**Symptom**: The model never detects phishing.

**Solutions**:

1. **Check feature extraction**: Log the feature vector to verify it's not all zeros:
   ```javascript
   const { features } = extractFeatures(url);
   console.log(features);
   ```

2. **Check model loading**: Verify `rf_trees.json` was loaded correctly:
   ```javascript
   const predictor = await getPredictor();
   console.log(predictor.getInfo());
   ```

3. **Check threshold**: If threshold is set to 1.0, nothing will be classified as phishing:
   ```javascript
   console.log(predictor.threshold);  // Should be 0.5
   ```

4. **Test with known phishing features**:
   ```javascript
   const phishFeatures = new Array(33).fill(0);
   phishFeatures[0] = 150;   // Long directory
   phishFeatures[4] = 250;   // Long URL
   const result = predictor.predict(phishFeatures);
   console.log(result);  // Should show phishing
   ```

### TypeError: Cannot read properties of undefined

**Symptom**: JavaScript errors when interacting with UI.

**Solutions**:

1. **Check element IDs**: Verify HTML element IDs match the `getElementById()` calls in JS files.

2. **Check DOM ready state**: Ensure scripts run after DOM is loaded:
   ```javascript
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', init);
   } else {
     init();
   }
   ```

3. **Check for renamed files**: After restructuring, verify HTML files reference the correct script paths (relative to the HTML file location).

---

## Browser-Specific Issues

### Chrome blocks the extension

**Symptom**: Chrome shows "This extension may have been corrupted" or disables it.

**Solutions**:

1. **Re-install**: Remove the extension and load it again.
2. **Check Developer Mode**: Developer mode extensions may be disabled after browser updates. Re-enable and reload.

### Extension doesn't work in Incognito Mode

**Solution**: Go to `chrome://extensions` → HonEx → "Details" → toggle "Allow in incognito".

### Extension doesn't work on specific sites

**Solution**: Check if the site is an internal Chrome page:
- `chrome://*` pages are excluded (cannot be intercepted)
- `chrome-extension://*` pages are excluded
- `about:*` pages are excluded

---

## Still Having Issues?

If the above solutions don't help:

1. **Check the background console** for detailed error messages:
   ```
   chrome://extensions → HonEx → "Service Worker"
   ```

2. **Check the popup console**:
   ```
   Right-click popup → Inspect
   ```

3. **Enable verbose logging** (if available):
   ```javascript
   localStorage.setItem('honex_debug', 'true');
   // Reload the extension
   ```

4. **File an issue**: Report problems at the project repository with:
   - Chrome version
   - Operating system
   - Extension version
   - Steps to reproduce
   - Console error output
