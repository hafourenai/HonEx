# ML Pipeline

This document describes the end-to-end machine learning pipeline: from raw dataset to a JavaScript-compatible Random Forest model running inside a Chrome Extension.

---

## Overview

```
Dataset (CSV)
    │
    ▼
Exploratory Data Analysis (EDA)
    │
    ▼
Data Cleaning
    │
    ▼
Feature Audit
    │
    ▼
Feature Selection (33 features)
    │
    ▼
Model Training (RandomForestClassifier)
    │
    ▼
Hyperparameter Tuning (GridSearchCV)
    │
    ▼
Evaluation (test set, metrics)
    │
    ▼
Model Export (rf_trees.json)
    │
    ▼
JavaScript Inference Engine
```

---

## 1. Dataset

The model was trained on a labeled dataset of URLs classified as either **legitimate** (0) or **phishing** (1).

| Property | Value |
|---|---|
| Source | Public phishing URL datasets (phishing and legitimate URLs) |
| Total samples | 20,000+ |
| Features (raw) | 50+ URL-derived attributes |
| Features (selected) | 33 |
| Target | `phishing` (0 = legitimate, 1 = phishing) |
| Class balance | Approximately balanced |

The raw dataset is stored at `trash/dataset2.csv` and `trash/dataset2_cleaned.csv`.

---

## 2. Exploratory Data Analysis (EDA)

The notebook `trash/notebook/HonEx(data_cleaning).ipynb` contains the initial EDA:

- Distribution of URL lengths
- Correlation matrix of features
- Missing value analysis
- Outlier detection
- Class balance verification

Key findings:
- Phishing URLs tend to have longer directory paths, more special characters (`@`, `-`, `%`), and more subdomain levels
- Legitimate URLs generally have shorter lengths and fewer anomalous characters
- No significant missing data issues

---

## 3. Data Cleaning

Cleaning steps applied to the raw dataset:

1. **Remove duplicates** — identical URL entries removed
2. **Handle missing values** — rows with null critical features dropped
3. **Normalize URLs** — ensure consistent scheme handling (`http://` prefix for scheme-less URLs)
4. **Remove invalid URLs** — entries that cannot be parsed by `urllib.parse`
5. **Stratified split** — 80/20 train/test split preserving class distribution

---

## 4. Feature Audit

The notebook `trash/notebook/feature_audit.ipynb` performs a systematic audit of all available features:

- **Variance analysis** — remove near-zero variance features
- **Correlation analysis** — remove highly correlated feature pairs (|r| > 0.95)
- **Mutual information** — rank features by information gain
- **Feature importance** — preliminary Random Forest importance scores

Results are saved to `trash/hasil/feature_order.json` (the final 33 features in their required order) and `trash/hasil/selected_features.json` (model metadata including top-10 feature importance).

---

## 5. Feature Selection

From the initial pool of 50+ features, 33 were selected based on:

1. **Non-zero variance** — features that actually vary across samples
2. **Low inter-correlation** — remove redundant features
3. **High importance** — keep features with highest Random Forest importance scores

The 33 selected features:

| # | Feature | Description |
|---|---|---|
| 0 | `directory_length` | Length of the URL directory path |
| 1 | `domain_length` | Length of the domain name |
| 2 | `email_in_url` | Whether an email pattern exists in the URL |
| 3 | `file_length` | Length of the file segment |
| 4 | `length_url` | Total URL length |
| 5 | `params_length` | Length of query parameters |
| 6 | `qty_and_url` | Count of `&` in the URL |
| 7 | `qty_asterisk_directory` | Count of `*` in directory |
| 8 | `qty_at_directory` | Count of `@` in directory |
| 9 | `qty_at_url` | Count of `@` in full URL |
| 10 | `qty_dot_directory` | Count of `.` in directory |
| 11 | `qty_dot_domain` | Count of `.` in domain |
| 12 | `qty_dot_params` | Count of `.` in params |
| 13 | `qty_dot_url` | Count of `.` in full URL |
| 14 | `qty_equal_url` | Count of `=` in URL |
| 15 | `qty_hyphen_directory` | Count of `-` in directory |
| 16 | `qty_hyphen_domain` | Count of `-` in domain |
| 17 | `qty_hyphen_file` | Count of `-` in file |
| 18 | `qty_hyphen_params` | Count of `-` in params |
| 19 | `qty_hyphen_url` | Count of `-` in full URL |
| 20 | `qty_mx_servers` | MX record count (external — default 2, DNS lookup unavailable in browser) |
| 21 | `qty_percent_directory` | Count of `%` in directory |
| 22 | `qty_percent_params` | Count of `%` in params |
| 23 | `qty_questionmark_directory` | Count of `?` in directory |
| 24 | `qty_questionmark_params` | Count of `?` in params |
| 25 | `qty_redirects` | Number of redirects (external — default 1, tracked via `webNavigation` API) |
| 26 | `qty_slash_params` | Count of `/` in params |
| 27 | `qty_slash_url` | Count of `/` in full URL |
| 28 | `qty_tld_url` | TLD segment count |
| 29 | `qty_underline_directory` | Count of `_` in directory |
| 30 | `qty_underline_params` | Count of `_` in params |
| 31 | `qty_underline_url` | Count of `_` in full URL |
| 32 | `qty_vowels_domain` | Count of vowels in domain |

---

## 6. Model Training

**Algorithm**: `scikit-learn` `RandomForestClassifier`

**Configuration** (from `trash/hasil/selected_features.json`):

```python
{
    "n_features": 33,
    "target_column": "phishing",
    "model_type": "RandomForestClassifier",
    "best_params": {
        "max_depth": null,          # Unlimited depth
        "max_features": "sqrt",     # sqrt(n_features) per split
        "min_samples_leaf": 1,      # No minimum leaf size
        "min_samples_split": 5,     # Minimum 5 samples to split
        "n_estimators": 100         # 100 trees in the forest
    }
}
```

Training is performed in `trash/notebook/modelTraining.ipynb`.

---

## 7. Hyperparameter Tuning

The notebook `trash/notebook/modelTuning.ipynb` performs `GridSearchCV` (5-fold cross-validation) over:

| Parameter | Values Tested | Selected |
|---|---|---|
| `n_estimators` | [50, 100, 200] | 100 |
| `max_depth` | [None, 10, 20, 30] | None |
| `min_samples_split` | [2, 5, 10] | 5 |
| `min_samples_leaf` | [1, 2, 4] | 1 |
| `max_features` | ['sqrt', 'log2', None] | 'sqrt' |

---

## 8. Evaluation

Test set results (held-out 20% of original data):

| Metric | Value |
|---|---|
| **Accuracy** | 95.16% |
| **Precision** | 93.12% |
| **Recall** | 93.02% |
| **F1 Score** | 93.07% |
| **ROC-AUC** | 0.9876 |

### Confusion Matrix

```
                Predicted
              Legit   Phishing
Actual Legit   9,512      613
Actual Phish    484    9,391
```

### Top-10 Features by Importance

| Feature | Importance |
|---|---|
| `directory_length` | 0.1497 |
| `length_url` | 0.0835 |
| `file_length` | 0.0828 |
| `qty_asterisk_directory` | 0.0765 |
| `qty_hyphen_file` | 0.0732 |
| `qty_hyphen_directory` | 0.0655 |
| `qty_slash_url` | 0.0529 |
| `qty_at_directory` | 0.0489 |
| `qty_percent_directory` | 0.0484 |
| `qty_questionmark_directory` | 0.0367 |

---

## 9. Model Export (Python → JavaScript)

This is the critical step that enables client-side inference.

### scikit-learn Tree Structure

Each decision tree in scikit-learn is stored as an array of nodes. Each node has:

| Field | Type | Description |
|---|---|---|
| `children_left` | int array | Left child index (−1 for leaf) |
| `children_right` | int array | Right child index (−1 for leaf) |
| `threshold` | float array | Split threshold (−2 for leaf) |
| `feature` | int array | Feature index for split (−2 for leaf) |
| `value` | float array | `[[c0, c1]]` sample counts at node |

### JSON Serialization

The notebook `trash/notebook/ExportRFTreesToJson.ipynb` performs:

1. Extract each tree's internal node structure
2. Serialize to JSON preserving the exact array format
3. Wrap in a top-level object with metadata:
   ```json
   {
     "n_features": 33,
     "n_classes": 2,
     "n_estimators": 100,
     "feature_names": ["directory_length", "domain_length", ...],
     "trees": [
       {
         "children_left": [1, 2, 3, ...],
         "children_right": [14, 5, 12, ...],
         "threshold": [0.5, 1.23, -2.0, ...],
         "feature": [0, 3, -2, ...],
         "values": [[[45.0, 55.0]], [[60.0, 40.0]], ...]
       },
       // ... 99 more trees
     ]
   }
   ```

### Deployment to Extension

The exported `rf_trees.json` is placed in `src/ml/rf_trees.json` and loaded at runtime by `forestLoader.js` via `fetch(chrome.runtime.getURL('ml/rf_trees.json'))`.

---

## 10. JavaScript Inference

The JavaScript inference engine reimplements scikit-learn's tree traversal logic 1:1:

```javascript
// decisionTree.js — walk one tree
export function walkTree(tree, features) {
  let node = 0;
  while (tree.children_left[node] !== -1) {
    const featureIndex = tree.feature[node];
    const threshold = tree.threshold[node];
    if (features[featureIndex] <= threshold) {
      node = tree.children_left[node];
    } else {
      node = tree.children_right[node];
    }
  }
  return tree.values[node][0]; // [count_c0, count_c1]
}
```

```javascript
// randomForest.js — aggregate all trees
for (let t = 0; t < this.trees.length; t++) {
  const leafVotes = walkTree(this.trees[t], features);
  scores[0] += leafVotes[0];
  scores[1] += leafVotes[1];
}
const phishingProbability = scores[1] / nEstimators;
```

This produces identical results to scikit-learn's `predict_proba()` because the tree structure, thresholds, and leaf values are exact replicas.

---

## Limitations

- **`qty_mx_servers`** — Requires DNS MX record lookup. Not available in browser JavaScript. Defaults to 2 (typical for legitimate sites).
- **`qty_redirects`** — Requires tracking HTTP redirect chain. Tracked in real-time via `webNavigation` API (`onBeforeRedirect`); defaults to 1 for unseen domains.
- **Model size** — ≈ 23 MB uncompressed JSON. This is large for a Chrome Extension and could be optimized with quantization or pruning.
