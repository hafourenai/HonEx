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

## [1.1.0] — 2026-07-26

### Added

#### Three-Zone Decision Boundary

- **Three confidence zones**: `safe` (< 0.75), `gray_zone` (0.75–0.95), `phishing` (> 0.95)
- Gray zone URLs are no longer immediately blocked — instead, they go through secondary checks before deciding
- Configurable `grayZoneMargin` (±0.10 around threshold) on `Predictor`

#### Dynamic Post-Processing

- Heuristic boosts (no vowels, >2 dots, >2 hyphens, URL >200 chars) are now scaled by model uncertainty
- Only applies when raw probability ≥ 0.5 (doesn't push legitimate URLs toward phishing)
- Scaling formula: `boost × (1 − certainty)` — full boost when uncertain, near-zero when confident
- Previous behavior added fixed +0.08–0.23 boost unconditionally, causing false positives

#### Secondary Checks for Gray Zone

- **High-value brand whitelist** (~50 brands: Google, Mandiri, BCA, Gojek, etc.) — known brands in gray zone are automatically reclassified as safe
- **DNS resolution check** via `chrome.dns.resolve()` — domains that don't resolve remain flagged
- **Typosquatting Detector** (`src/ai/typosquattingDetector.js`) — Levenshtein distance + homoglyph decoder that catches domain impersonation (e.g., `g00gle.com`, `rnandiri.com`, `shopee-sale.com`) against 50+ protected brands
- Gray zone notification (non-blocking) when all secondary checks pass

### Changed

- `predict()` and `predictWithDetails()` now return `zone` (`safe`, `gray_zone`, `phishing`) and `rawProbability` in addition to `prediction` and `probability`
- `Predictor` constructor accepts `grayZoneMargin` option (default: `0.10`)
- `Predictor.setGrayZoneMargin(margin)` method added
- `getInfo()` now includes `grayZoneMargin`
- Post-processing log format improved for debugging: shows `raw`, `boost`, `scaled`, `final`
- `manifest.json` updated: added `"dns"` permission for domain resolution
- `package.json` updated: added `"type": "module"` for Node.js compatibility

### Fixed

- False positive root cause: post-processing no longer adds full boost to low-confidence legitimate URLs
- Domain brand detection now correctly handles subdomains (e.g., `mail.google.com` → `google`)
- Homoglyph detection: domains like `go0gle.com` with numeric character substitutions now properly detected

### File Changes

| File | Change |
|---|---|
| `src/ml/predictor.js` | Dynamic boost scaling, three-zone logic, `rawProbability` in output |
| `src/background/navigationHandler.js` | Gray zone handling, DNS resolve, brand whitelist check, typosquatting integration |
| `src/ai/typosquattingDetector.js` | **New** — pure JS typosquatting detector (3KB, zero dependencies) |
| `src/utils/constants.js` | Added `PREDICTION_ZONE`, `THRESHOLD_CONFIG` constants |
| `src/manifest.json` | Added `"dns"` permission |
| `package.json` | Added `"type": "module"` |

## [1.2.0] — 2026-07-26

### Added

#### Exact Brand Pre-Filter

- `isExactBrandDomain()` runs BEFORE the ML pipeline in `analyzeUrl()`
- If the second-level domain (SLD) exactly matches a known brand (e.g., `google`, `github`, `tokopedia`), the URL is immediately classified as SAFE — no RF inference needed
- Handles subdomains (`mail.google.com` → `google`) and two-part TLDs (`bca.co.id` → `bca`)
- Eliminates false positives for legitimate brand domains entirely

#### Shared Brand List (`src/ai/brands.js`)

- Centralized, authoritative list of 60 protected brands
- Used by both the typosquatting detector and navigation handler (brand whitelist)
- Single source of truth — add/remove brands in one place

#### `extractSld()` Domain Parser

- Replaced `getRegistrableDomain()` with `extractSld()` for correct subdomain handling
- Handles two-part TLDs (`.co.id`, `.co.uk`, `.com.au`, etc.) with a `KNOWN_TWO_PART_TLDS` list
- Correctly extracts `google` from `mail.google.com` and `bca` from `www.bca.co.id`

### Changed

- `src/ai/typosquattingDetector.js` now imports `BRAND_NAMES` from `src/ai/brands.js` instead of maintaining its own list
- Embedded brand check in typosquatting detector: only flags if extra characters contain hyphens, numbers, or suspicious words (`login`, `verify`, `secure`, etc.) — eliminates false positives on legitimate sub-brands like `googleapis.com`
- Levenshtein typosquatting check: skips if the original domain is itself a known brand — prevents `github` from being flagged as typosquatting `gitlab`

### Fixed

- `github.com/hafourenai` no longer flagged as phishing (pre-filter catches `github` as exact brand match)
- `googleapis.com`, `googleservices.com` no longer falsely detected as typosquatting (embedded check requires suspicious extra characters)
- `github.com` no longer falsely detected as typosquatting `gitlab` (brand-is-brand guard)
- Subdomain brand detection: `mail.google.com` now correctly identifies `google`

### File Changes

| File | Change |
|---|---|
| `src/ai/brands.js` | **New** — shared 60-brand list |
| `src/ai/typosquattingDetector.js` | Imports from `brands.js`, safer embedded check, brand-is-brand guard |
| `src/background/navigationHandler.js` | `extractSld()` replaces `getRegistrableDomain()`, `isExactBrandDomain()` pre-filter |
| `docs/CHANGELOG.md` | Updated |
| `docs/PROJECT_STRUCTURE.md` | Updated |
| `docs/API_REFERENCE.md` | Updated |

## [Unreleased]

### Planned

- Brand list expansion
- Content script for login form analysis
- Local statistics dashboard (blocked sites count, detection rate)
- WebAssembly-accelerated tree traversal
- Automated test suite for CI/CD
- Chrome Web Store submission package

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0.0 | 2026-07-19 | Initial production release |
| 0.x | 2026 Q2 | Development iterations (ML training + extension prototyping) |
