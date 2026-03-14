import { CONFIG } from '../config.js';
import { DataTransformer } from '../data/data-transformer.js';

export class GapAnalyzer {
  constructor(draws) {
    this.draws = draws;
  }

  predict() {
    const gaps = DataTransformer.buildGapTable(this.draws);
    const freq = DataTransformer.buildFrequencyTable(this.draws);
    const totalDraws = this.draws.length;

    // Calculate average gap for each number
    const avgGaps = this.calculateAverageGaps();

    // Score: how overdue is each number relative to its average gap
    const scores = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const currentGap = gaps.get(n);
      const avgGap = avgGaps.get(n) || 8; // Default ~8 draws between appearances
      const overdueFactor = currentGap / avgGap;

      // Numbers more overdue get higher scores
      // But extremely overdue numbers might indicate removal from draw
      const score = overdueFactor > 5 ? overdueFactor * 0.5 : overdueFactor;

      scores.set(n, {
        score,
        currentGap,
        avgGap: avgGap.toFixed(1),
        overdueFactor: overdueFactor.toFixed(2)
      });
    }

    // Sort by overdue factor
    const sorted = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);

    // Select top overdue numbers with some randomization
    const pool = sorted.slice(0, 18);
    const selected = [];

    // Pick from different overdue levels
    while (selected.length < 6 && pool.length > 0) {
      // Weighted random: more overdue = higher probability
      const weights = pool.map(([, v]) => v.score);
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * totalWeight;

      for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          const [num] = pool.splice(i, 1);
          if (!selected.includes(num)) {
            selected.push(num);
          }
          break;
        }
      }
    }

    // Fill remaining
    while (selected.length < 6) {
      const n = Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1;
      if (!selected.includes(n)) selected.push(n);
    }

    selected.sort((a, b) => a - b);

    // Confidence based on average overdue factor of selected numbers
    const avgOverdue = selected.reduce((s, n) => s + (scores.get(n)?.score || 1), 0) / 6;
    const confidence = Math.min(85, Math.max(30, 40 + avgOverdue * 15));

    return {
      numbers: selected,
      confidence: Math.round(confidence),
      algorithm: 'gap',
      details: {
        mostOverdue: sorted.slice(0, 5).map(([n, v]) => ({
          number: n,
          gap: v.currentGap,
          avgGap: v.avgGap
        }))
      }
    };
  }

  calculateAverageGaps() {
    const lastSeen = new Map();
    const gapSums = new Map();
    const gapCounts = new Map();

    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      gapSums.set(n, 0);
      gapCounts.set(n, 0);
    }

    for (let i = 0; i < this.draws.length; i++) {
      for (const num of this.draws[i].numbers) {
        if (lastSeen.has(num)) {
          const gap = i - lastSeen.get(num);
          gapSums.set(num, gapSums.get(num) + gap);
          gapCounts.set(num, gapCounts.get(num) + 1);
        }
        lastSeen.set(num, i);
      }
    }

    const avgGaps = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const count = gapCounts.get(n);
      avgGaps.set(n, count > 0 ? gapSums.get(n) / count : 8);
    }
    return avgGaps;
  }
}
