import { CONFIG } from '../config.js';
import { FrequencyAnalyzer } from './frequency-analyzer.js';
import { NeuralPredictor } from './neural-predictor.js';
import { PatternAnalyzer } from './pattern-analyzer.js';
import { GapAnalyzer } from './gap-analyzer.js';
import { BayesianModel } from './bayesian-model.js';
import { UniquenessValidator } from './uniqueness-validator.js';

export class PredictionEngine {
  constructor(draws) {
    this.draws = draws;
    this.analyzers = {};
    this.validator = new UniquenessValidator(draws);
    this.ready = false;
  }

  async init() {
    // Initialize all analyzers
    this.analyzers.frequency = new FrequencyAnalyzer(this.draws);
    this.analyzers.neural = new NeuralPredictor(this.draws);
    this.analyzers.pattern = new PatternAnalyzer(this.draws);
    this.analyzers.gap = new GapAnalyzer(this.draws);
    this.analyzers.bayesian = new BayesianModel(this.draws);

    // Train neural network
    await this.analyzers.neural.init();

    this.ready = true;
  }

  /**
   * Generate prediction using selected algorithms.
   * @param {string[]} selectedAlgos - Array of algorithm keys to use
   * @returns {object} Combined prediction result
   */
  predict(selectedAlgos = CONFIG.ALGORITHMS) {
    if (!this.ready) throw new Error('Engine not initialized');

    const results = {};
    const allScores = new Map();

    // Initialize scores
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      allScores.set(n, 0);
    }

    // Run each selected algorithm
    let totalWeight = 0;
    for (const algoKey of selectedAlgos) {
      if (!this.analyzers[algoKey]) continue;

      const result = this.analyzers[algoKey].predict();
      results[algoKey] = result;

      const weight = CONFIG.ALGORITHM_WEIGHTS[algoKey] || 0.1;
      totalWeight += weight;

      // Add weighted scores for each number in the prediction
      for (const num of result.numbers) {
        allScores.set(num, allScores.get(num) + weight * (result.confidence / 100));
      }
    }

    // Normalize weights
    if (totalWeight > 0) {
      for (const [n, score] of allScores) {
        allScores.set(n, score / totalWeight);
      }
    }

    // Select top 6 numbers from ensemble scores
    const sorted = [...allScores.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    let ensembleNumbers;
    if (sorted.length >= 6) {
      // Take top candidates with slight randomization in the top pool
      const pool = sorted.slice(0, 12);
      ensembleNumbers = [];

      // Weighted random selection from pool
      while (ensembleNumbers.length < 6 && pool.length > 0) {
        const weights = pool.map(([, s]) => s);
        const totalW = weights.reduce((sum, w) => sum + w, 0);
        let r = Math.random() * totalW;

        for (let i = 0; i < pool.length; i++) {
          r -= weights[i];
          if (r <= 0) {
            ensembleNumbers.push(pool[i][0]);
            pool.splice(i, 1);
            break;
          }
        }
      }
    } else {
      // Fallback: pick from available
      ensembleNumbers = sorted.slice(0, 6).map(([n]) => n);
      while (ensembleNumbers.length < 6) {
        const n = Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1;
        if (!ensembleNumbers.includes(n)) ensembleNumbers.push(n);
      }
    }

    ensembleNumbers.sort((a, b) => a - b);

    // Ensure uniqueness
    const uniqueResult = this.validator.ensureUnique(() => {
      // On regeneration, reshuffle slightly
      const nums = [...ensembleNumbers];
      // Replace one number randomly
      const replaceIdx = Math.floor(Math.random() * 6);
      let newNum;
      do {
        newNum = Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1;
      } while (nums.includes(newNum));
      nums[replaceIdx] = newNum;
      nums.sort((a, b) => a - b);
      return { numbers: nums };
    });

    // Use the unique result if original wasn't unique
    if (!this.validator.isUnique(ensembleNumbers)) {
      ensembleNumbers = uniqueResult.numbers;
    }

    // Calculate ensemble confidence
    const individualConfidences = Object.values(results).map(r => r.confidence);
    const ensembleConfidence = Math.round(
      individualConfidences.reduce((sum, c) => sum + c, 0) / individualConfidences.length
    );

    return {
      numbers: ensembleNumbers,
      confidence: ensembleConfidence,
      algorithm: 'ensemble',
      individualResults: results,
      isUnique: true,
      timestamp: new Date().toISOString()
    };
  }
}
