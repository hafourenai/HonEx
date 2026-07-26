import { loadForestModel } from './forestLoader.js';
import { RandomForest } from './randomForest.js';
import { THRESHOLD_CONFIG } from '../utils/constants.js';

const DEFAULT_THRESHOLD = THRESHOLD_CONFIG.DEFAULT;
const DEFAULT_GRAY_ZONE_MARGIN = THRESHOLD_CONFIG.GRAY_ZONE_MARGIN;

export class Predictor {
  constructor(model, options = {}) {
    this.forest = new RandomForest(model);
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.grayZoneMargin = options.grayZoneMargin ?? DEFAULT_GRAY_ZONE_MARGIN;
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

    let scaledBoost = 0;
    if (boost > 0) {
      if (rawProbability >= 0.5) {
        const certainty = 2 * Math.abs(rawProbability - 0.5);
        const scalingFactor = 1 - certainty;
        scaledBoost = boost * scalingFactor;
      }
    }

    const probability = Math.min(rawProbability + scaledBoost, 1.0);

    if (boost > 0) {
      console.log(
        `[HonEx] Post-process: raw=${rawProbability.toFixed(4)} boost=${boost.toFixed(2)}` +
        ` scaled=${scaledBoost.toFixed(4)} final=${probability.toFixed(4)}`
      );
    }

    return probability;
  }

  _determineZone(probability) {
    const lower = this.threshold - this.grayZoneMargin;
    const upper = this.threshold + this.grayZoneMargin;
    if (probability >= upper) return 'phishing';
    if (probability <= lower) return 'safe';
    return 'gray_zone';
  }

  predict(features) {
    this.validateFeatures(features);
    const rfResult = this.forest.predict(features);
    const rawProbability = rfResult.phishingProbability;
    const probability = this._applyPostProcess(features, rawProbability);
    const isPhishing = probability > this.threshold;
    const zone = this._determineZone(probability);
    return {
      prediction: isPhishing ? 'phishing' : 'legitimate',
      isPhishing,
      zone,
      probability,
      rawProbability,
      confidence: rfResult.confidence,
      threshold: this.threshold,
      grayZoneMargin: this.grayZoneMargin
    };
  }

  predictWithDetails(features) {
    this.validateFeatures(features);
    const rfResult = this.forest.predict(features);
    const rawProbability = rfResult.phishingProbability;
    const probability = this._applyPostProcess(features, rawProbability);
    const isPhishing = probability > this.threshold;
    const zone = this._determineZone(probability);
    const featureValues = {};
    for (let i = 0; i < this.forest.featureNames.length; i++) {
      featureValues[this.forest.featureNames[i]] = features[i];
    }
    return {
      prediction: isPhishing ? 'phishing' : 'legitimate',
      isPhishing,
      zone,
      probability,
      rawProbability,
      confidence: rfResult.confidence,
      threshold: this.threshold,
      grayZoneMargin: this.grayZoneMargin,
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

  setGrayZoneMargin(margin) {
    if (typeof margin !== 'number' || margin < 0 || margin > 0.5) {
      throw new Error('Gray zone margin harus berupa angka antara 0.0 dan 0.5');
    }
    this.grayZoneMargin = margin;
  }

  getInfo() {
    return {
      ...this.forest.getModelInfo(),
      threshold: this.threshold,
      grayZoneMargin: this.grayZoneMargin
    };
  }
}
