import { CONFIG } from '../config.js';
import { TurtleShellAlgorithm } from './turtle-shell-algorithm.js';

/**
 * ============================================================
 * TURTLE SHELL VALIDATOR - Sliding Window Backtesting & Learning
 * ============================================================
 *
 * Takes a block of draws (e.g. last 10), runs sliding window
 * predictions using the Turtle Shell Algorithm, compares each
 * prediction against the actual next draw, and learns correction
 * patterns from the differences.
 *
 * Sliding window example with 10 draws [0..9], window size 5:
 *   Round 1: predict from [0..4] → compare with draw[5]
 *   Round 2: predict from [1..5] → compare with draw[6]
 *   Round 3: predict from [2..6] → compare with draw[7]
 *   Round 4: predict from [3..7] → compare with draw[8]
 *   Round 5: predict from [4..8] → compare with draw[9]
 *
 * The validator then:
 *   1. Tracks which numbers were correctly predicted (hits)
 *   2. Tracks which numbers were missed (should have been predicted)
 *   3. Tracks which numbers were false positives (predicted but didn't appear)
 *   4. Builds a correction bias map for all 49 numbers
 *   5. Applies corrections to the next real prediction
 */
export class TurtleShellValidator {
  constructor(allDraws) {
    this.allDraws = allDraws;
    this.algorithm = new TurtleShellAlgorithm(allDraws);
    this.validationResults = [];
    this.correctionBias = new Map();
    this.windowSize = 9;    // Match current algorithm input size
    this.testBlocks = 10;   // Number of recent draws to use as test block
  }

  /**
   * Run full sliding window backtest on the last N draws.
   * @param {number} [blockSize=10] - Total draws to use (window + validation targets)
   * @returns {object} Full validation report
   */
  runBacktest(blockSize = 10) {
    // Take the last blockSize draws from history
    const totalDraws = this.allDraws.length;
    const block = this.allDraws.slice(totalDraws - blockSize);

    this.validationResults = [];

    // Slide the window: use windowSize draws to predict, compare with next
    const numRounds = blockSize - this.windowSize;

    for (let round = 0; round < numRounds; round++) {
      const windowStart = round;
      const windowEnd = round + this.windowSize;
      const targetIndex = windowEnd; // The draw we're trying to predict

      if (targetIndex >= block.length) break;

      // Get the input window and target draw
      const inputWindow = block.slice(windowStart, windowEnd);
      const targetDraw = block[targetIndex];

      // Run prediction using only the input window
      const prediction = this.algorithm.predict(inputWindow);

      // Compare prediction with actual
      const comparison = this.comparePrediction(
        prediction.numbers,
        targetDraw.numbers,
        round,
        targetDraw.date
      );

      this.validationResults.push(comparison);
    }

    // Build correction bias from all validation rounds
    this.buildCorrectionBias();

    // Generate the validation report
    return this.generateReport();
  }

  /**
   * Compare a prediction against actual draw results
   */
  comparePrediction(predicted, actual, roundIndex, drawDate) {
    const predictedSet = new Set(predicted);
    const actualSet = new Set(actual);

    // Hits: numbers correctly predicted
    const hits = predicted.filter(n => actualSet.has(n));

    // Misses: actual numbers we failed to predict
    const misses = actual.filter(n => !predictedSet.has(n));

    // False positives: predicted numbers that didn't appear
    const falsePositives = predicted.filter(n => !actualSet.has(n));

    // Positional accuracy: how close were our predictions to actual numbers?
    const proximityScore = this.calculateProximity(predicted, actual);

    // Sector accuracy: did we predict the right shell sectors?
    const predictedSectors = new Set(predicted.map(n => Math.floor((n - 1) / 7)));
    const actualSectors = new Set(actual.map(n => Math.floor((n - 1) / 7)));
    const sectorHits = [...predictedSectors].filter(s => actualSectors.has(s)).length;

    return {
      round: roundIndex,
      drawDate,
      predicted,
      actual,
      hits,
      hitCount: hits.length,
      misses,
      falsePositives,
      hitRate: hits.length / CONFIG.DRAW_SIZE,
      proximityScore,
      sectorHits,
      sectorAccuracy: sectorHits / Math.max(predictedSectors.size, actualSectors.size),
    };
  }

  /**
   * Calculate how "close" predictions were to actual numbers
   * (average minimum distance from each predicted number to nearest actual)
   */
  calculateProximity(predicted, actual) {
    let totalDist = 0;
    for (const p of predicted) {
      let minDist = Infinity;
      for (const a of actual) {
        minDist = Math.min(minDist, Math.abs(p - a));
      }
      totalDist += minDist;
    }
    // Normalize: 0 = perfect, lower = better
    // Max possible avg distance ~24 (opposite ends of 1-49)
    const avgDist = totalDist / predicted.length;
    // Convert to 0-100 score where 100 = perfect
    return Math.round(Math.max(0, 100 - (avgDist / 24) * 100));
  }

  /**
   * Build correction bias map from validation results.
   * Numbers that were frequently missed get a BOOST.
   * Numbers that were frequently false positives get a PENALTY.
   * Numbers that were correctly hit are NEUTRAL.
   */
  buildCorrectionBias() {
    this.correctionBias = new Map();

    // Initialize all numbers
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      this.correctionBias.set(n, {
        hitCount: 0,     // Times correctly predicted
        missCount: 0,    // Times appeared but wasn't predicted
        fpCount: 0,      // Times predicted but didn't appear
        bias: 0,         // Final correction bias
      });
    }

    // Accumulate stats from all validation rounds
    for (const result of this.validationResults) {
      for (const num of result.hits) {
        const entry = this.correctionBias.get(num);
        entry.hitCount++;
      }
      for (const num of result.misses) {
        const entry = this.correctionBias.get(num);
        entry.missCount++;
      }
      for (const num of result.falsePositives) {
        const entry = this.correctionBias.get(num);
        entry.fpCount++;
      }
    }

    // Calculate bias for each number
    const rounds = this.validationResults.length || 1;
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const entry = this.correctionBias.get(n);
      // Positive bias = boost (was missed, should be included more)
      // Negative bias = penalty (was false positive, should be included less)
      entry.bias = (entry.missCount - entry.fpCount) / rounds;
    }
  }

  /**
   * Apply learned corrections to a raw prediction.
   * Re-scores numbers using the correction bias and re-selects top 6.
   * @param {number[]} originalPrediction - The 6 numbers from base algorithm
   * @param {Map} compositeScores - Original composite scores from algorithm
   * @returns {number[]} Corrected 6 numbers
   */
  applyCorrectedPrediction(originalPrediction, compositeScores) {
    if (this.correctionBias.size === 0 || this.validationResults.length === 0) {
      return originalPrediction; // No backtest data yet
    }

    // Adjust scores using correction bias
    const adjustedScores = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const baseScore = compositeScores?.get(n) || 0;
      const correction = this.correctionBias.get(n)?.bias || 0;
      // Apply correction: boost missed numbers, penalize false positives
      adjustedScores.set(n, baseScore + correction * 2);
    }

    // Re-select top 6
    const sorted = [...adjustedScores.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 6).map(([num]) => num).sort((a, b) => a - b);
  }

  /**
   * Generate a comprehensive validation report
   */
  generateReport() {
    const rounds = this.validationResults.length;
    if (rounds === 0) return { rounds: 0, error: 'No validation data' };

    // Aggregate statistics
    const totalHits = this.validationResults.reduce((s, r) => s + r.hitCount, 0);
    const totalPossible = rounds * CONFIG.DRAW_SIZE;
    const avgHitRate = totalHits / totalPossible;
    const avgProximity = this.validationResults.reduce((s, r) => s + r.proximityScore, 0) / rounds;
    const avgSectorAccuracy = this.validationResults.reduce((s, r) => s + r.sectorAccuracy, 0) / rounds;

    // Best and worst rounds
    const bestRound = this.validationResults.reduce((best, r) =>
      r.hitCount > best.hitCount ? r : best
    );
    const worstRound = this.validationResults.reduce((worst, r) =>
      r.hitCount < worst.hitCount ? r : worst
    );

    // Numbers most frequently missed (should boost these)
    const boostCandidates = [...this.correctionBias.entries()]
      .filter(([, v]) => v.bias > 0)
      .sort((a, b) => b[1].bias - a[1].bias)
      .slice(0, 8)
      .map(([num, v]) => ({ number: num, bias: v.bias.toFixed(2), missed: v.missCount }));

    // Numbers most frequently false-positive (should suppress these)
    const suppressCandidates = [...this.correctionBias.entries()]
      .filter(([, v]) => v.bias < 0)
      .sort((a, b) => a[1].bias - b[1].bias)
      .slice(0, 8)
      .map(([num, v]) => ({ number: num, bias: v.bias.toFixed(2), falsePos: v.fpCount }));

    return {
      rounds,
      windowSize: this.windowSize,
      totalHits,
      totalPossible,
      avgHitRate: Math.round(avgHitRate * 100),
      avgProximity: Math.round(avgProximity),
      avgSectorAccuracy: Math.round(avgSectorAccuracy * 100),
      bestRound: {
        round: bestRound.round,
        hits: bestRound.hitCount,
        predicted: bestRound.predicted,
        actual: bestRound.actual,
        hitNumbers: bestRound.hits,
        date: bestRound.drawDate,
      },
      worstRound: {
        round: worstRound.round,
        hits: worstRound.hitCount,
        date: worstRound.drawDate,
      },
      roundDetails: this.validationResults,
      boostCandidates,
      suppressCandidates,
      correctionBias: this.correctionBias,
    };
  }

  /**
   * Run a CORRECTED prediction: first backtest, learn, then predict.
   * This is the main method the UI should call.
   */
  predictWithValidation() {
    // Step 1: Run backtest on last 19 draws (9 window + 10 validation targets)
    const report = this.runBacktest(19);

    // Step 2: Run a fresh prediction using the full draw set
    const basePrediction = this.algorithm.predict();

    // Step 3: Apply corrections from backtest
    // Get composite scores from a fresh run to adjust
    const freshScores = this.getCompositeScores();
    const correctedNumbers = this.applyCorrectedPrediction(
      basePrediction.numbers,
      freshScores
    );

    // Step 4: Calculate corrected confidence
    // Higher confidence when backtest shows good avg hit rate
    const backtestBoost = report.avgHitRate / 100; // 0 to 1
    const proximityBoost = report.avgProximity / 100; // 0 to 1
    const correctedConfidence = Math.min(96, Math.round(
      basePrediction.confidence * 0.5 +
      (75 + backtestBoost * 15 + proximityBoost * 10) * 0.5
    ));

    return {
      ...basePrediction,
      numbers: correctedNumbers,
      confidence: correctedConfidence,
      validationReport: report,
      originalNumbers: basePrediction.numbers,
      correctionApplied: !this.arraysEqual(basePrediction.numbers, correctedNumbers),
    };
  }

  /**
   * Get composite scores by running the algorithm's 7 layers
   */
  getCompositeScores() {
    const draws = this.allDraws;
    const last9 = draws.slice(-9);
    const last18 = draws.slice(-18);
    const algo = this.algorithm;

    const layers = [
      algo.layer1_shellSectors(last9),
      algo.layer2_ripplePropagation(last9),
      algo.layer3_momentumVectors(last18),
      algo.layer4_deltaConvergence(last9),
      algo.layer5_magneticPairs(last9),
      algo.layer6_goldenSpiral(last9),
      algo.layer7_crossDrawTransition(last9),
    ];

    // Normalize and combine
    const composite = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) composite.set(n, 0);

    for (const scores of layers) {
      const values = [...scores.values()];
      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = max - min || 1;
      for (const [num, score] of scores) {
        composite.set(num, composite.get(num) + (score - min) / range);
      }
    }
    return composite;
  }

  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
}
