import { DataTransformer } from '../data/data-transformer.js';
import { CONFIG } from '../config.js';

export class UniquenessValidator {
  constructor(draws) {
    this.historicalSet = DataTransformer.buildHistoricalSet(draws);
  }

  /**
   * Check if a combination has appeared in history.
   * @param {number[]} numbers - Array of 6 sorted numbers
   * @returns {boolean} true if the combination is unique (never drawn before)
   */
  isUnique(numbers) {
    const key = [...numbers].sort((a, b) => a - b).join(',');
    return !this.historicalSet.has(key);
  }

  /**
   * Ensure a prediction is unique by regenerating if needed.
   * @param {Function} generateFn - Function that returns { numbers: number[], ... }
   * @param {number} maxAttempts - Maximum regeneration attempts
   * @returns {object} A unique prediction result
   */
  ensureUnique(generateFn, maxAttempts = 100) {
    for (let i = 0; i < maxAttempts; i++) {
      const result = generateFn();
      if (this.isUnique(result.numbers)) {
        return result;
      }
      // Mark that we had to regenerate
      if (result.details) result.details.regenerated = i + 1;
    }

    // Extremely unlikely to reach here with 6 numbers from 49
    // but as a safety net, generate a truly random unique combination
    const result = this.generateRandomUnique();
    return result;
  }

  generateRandomUnique() {
    let attempts = 0;
    while (attempts < 10000) {
      const nums = [];
      while (nums.length < CONFIG.DRAW_SIZE) {
        const n = Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1;
        if (!nums.includes(n)) nums.push(n);
      }
      nums.sort((a, b) => a - b);
      if (this.isUnique(nums)) {
        return {
          numbers: nums,
          confidence: 10,
          algorithm: 'random',
          details: { fallback: true, attempts }
        };
      }
      attempts++;
    }
    // Should never reach here mathematically
    return { numbers: [1, 2, 3, 4, 5, 6], confidence: 0, algorithm: 'random', details: { error: true } };
  }
}
