const REQUIRED_MODEL_KEYS = ['n_features', 'n_classes', 'n_estimators', 'feature_names', 'trees'];
const REQUIRED_TREE_KEYS = ['children_left', 'children_right', 'threshold', 'feature', 'values'];

export function validateModel(model) {
  if (!model || typeof model !== 'object') {
    throw new Error('Model harus berupa objek JSON yang valid');
  }
  for (const key of REQUIRED_MODEL_KEYS) {
    if (!(key in model)) {
      throw new Error(`Field wajib tidak ditemukan: "${key}"`);
    }
  }
  if (typeof model.n_features !== 'number' || model.n_features < 1) {
    throw new Error(`n_features tidak valid: ${model.n_features}`);
  }
  if (typeof model.n_classes !== 'number' || model.n_classes < 2) {
    throw new Error(`n_classes tidak valid: ${model.n_classes}`);
  }
  if (typeof model.n_estimators !== 'number' || model.n_estimators < 1) {
    throw new Error(`n_estimators tidak valid: ${model.n_estimators}`);
  }
  if (!Array.isArray(model.feature_names) || model.feature_names.length !== model.n_features) {
    throw new Error(
      `feature_names harus array dengan ${model.n_features} elemen, ` +
      `ditemukan ${Array.isArray(model.feature_names) ? model.feature_names.length : typeof model.feature_names}`
    );
  }
  if (!Array.isArray(model.trees) || model.trees.length !== model.n_estimators) {
    throw new Error(
      `trees harus array dengan ${model.n_estimators} elemen, ` +
      `ditemukan ${Array.isArray(model.trees) ? model.trees.length : typeof model.trees}`
    );
  }
  for (let i = 0; i < model.trees.length; i++) {
    validateTree(model.trees[i], i, model.n_features);
  }
  return model;
}

function validateTree(tree, index, nFeatures) {
  for (const key of REQUIRED_TREE_KEYS) {
    if (!(key in tree)) {
      throw new Error(`Tree[${index}]: field wajib tidak ditemukan: "${key}"`);
    }
  }
  const nodeCount = tree.children_left.length;
  if (tree.children_right.length !== nodeCount) {
    throw new Error(`Tree[${index}]: children_right (${tree.children_right.length}) != children_left (${nodeCount})`);
  }
  if (tree.threshold.length !== nodeCount) {
    throw new Error(`Tree[${index}]: threshold (${tree.threshold.length}) != node count (${nodeCount})`);
  }
  if (tree.feature.length !== nodeCount) {
    throw new Error(`Tree[${index}]: feature (${tree.feature.length}) != node count (${nodeCount})`);
  }
  if (tree.values.length !== nodeCount) {
    throw new Error(`Tree[${index}]: values (${tree.values.length}) != node count (${nodeCount})`);
  }
  for (let n = 0; n < nodeCount; n++) {
    const isLeaf = tree.children_left[n] === -1;
    if (!isLeaf) {
      const featureIdx = tree.feature[n];
      if (featureIdx < 0 || featureIdx >= nFeatures) {
        throw new Error(
          `Tree[${index}] Node[${n}]: feature index ${featureIdx} di luar range [0, ${nFeatures - 1}]`
        );
      }
    }
  }
}

export async function loadForestModel(source) {
  let model;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Gagal memuat model dari ${source}: HTTP ${response.status}`);
    }
    model = await response.json();
  } else if (typeof source === 'object' && source !== null) {
    model = source;
  } else {
    throw new Error('Source harus berupa URL (string) atau objek JSON');
  }
  return validateModel(model);
}
