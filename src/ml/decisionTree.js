const MAX_TRAVERSAL_DEPTH = 1000;

export function walkTree(tree, features) {
  let node = 0;
  let depth = 0;
  while (tree.children_left[node] !== -1) {
    if (depth++ > MAX_TRAVERSAL_DEPTH) {
      throw new Error(
        `Traversal melebihi kedalaman maksimum (${MAX_TRAVERSAL_DEPTH}). ` +
        'Kemungkinan tree rusak atau memiliki cycle.'
      );
    }
    const featureIndex = tree.feature[node];
    const threshold = tree.threshold[node];
    const featureValue = features[featureIndex];
    if (featureValue <= threshold) {
      node = tree.children_left[node];
    } else {
      node = tree.children_right[node];
    }
  }
  return tree.values[node][0];
}

export function countLeafNodes(tree) {
  let count = 0;
  for (let i = 0; i < tree.children_left.length; i++) {
    if (tree.children_left[i] === -1) {
      count++;
    }
  }
  return count;
}

export function getTreeDepth(tree) {
  function depthOf(node) {
    if (tree.children_left[node] === -1) {
      return 0;
    }
    const leftDepth = depthOf(tree.children_left[node]);
    const rightDepth = depthOf(tree.children_right[node]);
    return 1 + Math.max(leftDepth, rightDepth);
  }
  return depthOf(0);
}
