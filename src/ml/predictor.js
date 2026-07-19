import { loadForestModel } from './forestLoader.js';
import { RandomForest } from './randomForest.js';

const DEFAULT_THRESHOLD = 0.85;

export class Predictor {
  constructor(model, options = {}) {
    this.forest = new RandomForest(model);
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
  }

  static async create(source, options = {}) {
    const model = await loadForestModel(source);
    return new Predictor(model, options);
  }

  validateFeatures(features) {
    if (!Array.isArray(features)) {
      throw new Error('Features harus berupa array');
    }
    const expected = this.forest.nFeatures;
    if (features.length !== expected) {
      throw new Error(
        `Jumlah fitur tidak sesuai: diharapkan ${expected}, diterima ${features.length}`
      );
    }
    for (let i = 0; i < features.length; i++) {
      if (typeof features[i] !== 'number') {
        throw new Error(
          `Fitur[${i}] ("${this.forest.featureNames[i]}") harus bertipe number, ` +
          `diterima ${typeof features[i]}`
        );
      }
      if (Number.isNaN(features[i])) {
        throw new Error(
          `Fitur[${i}] ("${this.forest.featureNames[i]}") bernilai NaN`
        );
      }
    }
  }

  _getFeatureIndex(name) {
    if (!this._nameIndexMap) {
      this._nameIndexMap = {};
      for (let i = 0; i < this.forest.featureNames.length; i++) {
        this._nameIndexMap[this.forest.featureNames[i]] = i;
      }
    }
    return this._nameIndexMap[name];
  }

  _applyPostProcess(features, rawProbability) {
    let boost = 0;

    const idxVowels = this._getFeatureIndex('qty_vowels_domain');
    if (idxVowels !== undefined && features[idxVowels] === 0) {
      boost += 0.08;
    }

    const idxDotDomain = this._getFeatureIndex('qty_dot_domain');
    if (idxDotDomain !== undefined && features[idxDotDomain] > 2) {
      boost += 0.05;
    }

    const idxHyphenDomain = this._getFeatureIndex('qty_hyphen_domain');
    if (idxHyphenDomain !== undefined && features[idxHyphenDomain] > 2) {
      boost += 0.05;
    }

    const idxLengthUrl = this._getFeatureIndex('length_url');
    if (idxLengthUrl !== undefined && features[idxLengthUrl] > 200) {
      boost += 0.05;
    }

    const probability = Math.min(rawProbability + boost, 1.0);

    if (boost > 0) {
      console.log(
        `[HonEx] Post-process boost: raw=${rawProbability.toFixed(4)} boost=${boost.toFixed(2)} final=${probability.toFixed(4)}`
      );
    }

    return probability;
  }

  predict(features) {
    this.validateFeatures(features);
    const rfResult = this.forest.predict(features);
    const rawProbability = rfResult.phishingProbability;
    const probability = this._applyPostProcess(features, rawProbability);
    const isPhishing = probability > this.threshold;
    return {
      prediction: isPhishing ? 'phishing' : 'legitimate',
      isPhishing,
      probability,
      confidence: rfResult.confidence,
      threshold: this.threshold
    };
  }

  predictWithDetails(features) {
    this.validateFeatures(features);
    const rfResult = this.forest.predict(features);
    const rawProbability = rfResult.phishingProbability;
    const probability = this._applyPostProcess(features, rawProbability);
    const isPhishing = probability > this.threshold;
    const featureValues = {};
    for (let i = 0; i < this.forest.featureNames.length; i++) {
      featureValues[this.forest.featureNames[i]] = features[i];
    }
    return {
      prediction: isPhishing ? 'phishing' : 'legitimate',
      isPhishing,
      probability,
      rawProbability,
      confidence: rfResult.confidence,
      threshold: this.threshold,
      classProbabilities: rfResult.classProbabilities,
      nEstimators: this.forest.nEstimators,
      featureValues
    };
  }

  predictBatch(featuresBatch) {
    return featuresBatch.map(features => this.predict(features));
  }

  setThreshold(threshold) {
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
      throw new Error('Threshold harus berupa angka antara 0.0 dan 1.0');
    }
    this.threshold = threshold;
  }

  getInfo() {
    return {
      ...this.forest.getModelInfo(),
      threshold: this.threshold
    };
  }
}
