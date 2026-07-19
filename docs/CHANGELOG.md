# Changelog

All notable changes to HonEx are documented in this file.

---

## [1.0.0] — 2026-07-19

### Initial Release

#### Machine Learning

- Random Forest classifier with 100 decision trees
- 33 URL-derived features for phishing detection
- 95.16% accuracy, 93.12% precision, 93.02% recall
- 0.9876 ROC-AUC score
- Model trained on 20,000+ labeled URLs with GridSearchCV hyperparameter tuning
- Full Python → JavaScript model export pipeline (scikit-learn → JSON)

#### Chrome Extension

- **Manifest V3** architecture with module-type background service worker
- **Navigation interception** via `chrome.webNavigation.onBeforeNavigate`
- **Real-time classification** — URLs analyzed before pages load
- **Warning page** with threat confidence score, Go Back, and Continue Anyway
- **Temporary bypass** mechanism (30-second window) for false positives
- **Popup UI** with protection status, toggle, and navigation menu
- **Dashboard** with live protection status, model health, and version info
- **Settings page** with persistent configuration (Protection, Theme, Notifications, Warning Mode)
- **Privacy-first** — 100% local inference, no external API calls, no telemetry

#### Feature Extraction

- URL component parser (domain, directory, file, params)
- Character counting engine (20+ special character features)
- Domain-specific metrics (length, dots, hyphens, vowels)
- Email detection in URLs
- Graceful handling of unparseable URLs and external features

#### Project Structure

- Clean directory layout with separation of concerns
- No build tools required — plain JavaScript loads directly
- Comprehensive documentation (10 Markdown files with diagrams)
- Deprecated files organized in `trash/` for reference

### Fixed

- Navigation loop bug: "Continue Anyway" now properly bypasses detection
- Feature extraction index mismatch: verified against `feature_order.json`
- Storage fallback: all `chrome.storage.sync` reads fall back to defaults

### Known Limitations

- `qty_mx_servers` defaults to 0 (DNS MX lookup not available in browser)
- `qty_redirects` defaults to 0 (redirect tracking not yet implemented)
- Model file is ≈ 23 MB (uncompressed JSON — quantization planned)
- No content script for DOM-level phishing detection on already-loaded pages

---

## [Unreleased]

### Planned

- Model quantization / pruning to reduce bundle size
- Content script for login form analysis
- Local statistics dashboard (blocked sites count, detection rate)
- Threshold sensitivity slider
- WebAssembly-accelerated tree traversal
- Automated test suite for CI/CD
- Chrome Web Store submission package

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0.0 | 2026-07-19 | Initial production release |
| 0.x | 2026 Q2 | Development iterations (ML training + extension prototyping) |
