import { walkTree } from './decisionTree.js';

export const CLASS_LABELS = Object.freeze({
  0: 'legitimate',
  1: 'phishing'
});

export class RandomForest {
  constructor(model) {
    this.nFeatures = model.n_features;
    this.nClasses = model.n_classes;
    this.nEstimators = model.n_estimators;
    this.featureNames = model.feature_names;
    this.trees = model.trees;
  }

  predict(features) {
    const scores = new Array(this.nClasses).fill(0);
    for (let t = 0; t < this.trees.length; t++) {
      const leafVotes = walkTree(this.trees[t], features);
      for (let c = 0; c < this.nClasses; c++) {
        scores[c] += leafVotes[c];
      }
    }
    const classProbabilities = scores.map(s => s / this.nEstimators);
    const phishingProbability = classProbabilities[1];
    const predictedClass = phishingProbability > 0.5 ? 1 : 0;
    const confidence = Math.max(classProbabilities[0], classProbabilities[1]);
    return {
      classProbabilities,
      prediction: CLASS_LABELS[predictedClass],
      confidence,
      phishingProbability
    };
  }

  predictBatch(featuresBatch) {
    return featuresBatch.map(features => this.predict(features));
  }

  getModelInfo() {
    return {
      nFeatures: this.nFeatures,
      nClasses: this.nClasses,
      nEstimators: this.nEstimators,
      featureNames: [...this.featureNames],
      classLabels: { ...CLASS_LABELS }
    };
  }
}
