import { CONFIG } from '../config.js';
import { DataTransformer } from '../data/data-transformer.js';

export class FrequencyAnalyzer {
  constructor(draws) {
    this.draws = draws;
  }

  predict() {
    const allFreq = DataTransformer.buildFrequencyTable(this.draws);
    const recent50 = DataTransformer.buildFrequencyTable(this.draws, 50);
    const recent100 = DataTransformer.buildFrequencyTable(this.draws, 100);
    const recent200 = DataTransformer.buildFrequencyTable(this.draws, 200);

    const totalDraws = this.draws.length;
    const expected = DataTransformer.expectedFrequency(totalDraws);
    const scores = new Map();

    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const allScore = (allFreq.get(n) || 0) / totalDraws;
      const r50 = (recent50.get(n) || 0) / 50;
      const r100 = (recent100.get(n) || 0) / 100;
      const r200 = (recent200.get(n) || 0) / 200;

      // Weighted composite: recent trends matter more
      const composite = allScore * 0.15 + r200 * 0.20 + r100 * 0.25 + r50 * 0.40;

      // Z-score for deviation from expected
      const deviation = ((allFreq.get(n) || 0) - expected) / Math.sqrt(expected);

      scores.set(n, { composite, deviation, count: allFreq.get(n) || 0 });
    }

    // Sort by composite score
    const sorted = [...scores.entries()].sort((a, b) => b[1].composite - a[1].composite);

    // Hot pool (top 15) and cold pool (bottom 15) with overdue correction
    const hotPool = sorted.slice(0, 15).map(e => e[0]);
    const coldPool = sorted.slice(-15).map(e => e[0]);

    // Select: 4 from hot, 2 from cold (overdue correction)
    const selected = [];
    const usedHot = new Set();

    while (selected.length < 4 && hotPool.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(8, hotPool.length));
      const num = hotPool.splice(idx, 1)[0];
      if (!usedHot.has(num)) {
        selected.push(num);
        usedHot.add(num);
      }
    }

    while (selected.length < 6 && coldPool.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(8, coldPool.length));
      const num = coldPool.splice(idx, 1)[0];
      if (!selected.includes(num)) {
        selected.push(num);
      }
    }

    // Fill if needed
    while (selected.length < 6) {
      const n = Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1;
      if (!selected.includes(n)) selected.push(n);
    }

    selected.sort((a, b) => a - b);

    // Confidence: based on how much the selected numbers deviate positively
    const avgDeviation = selected.reduce((sum, n) => sum + Math.abs(scores.get(n).deviation), 0) / 6;
    const confidence = Math.min(95, Math.max(30, 50 + avgDeviation * 8));

    return {
      numbers: selected,
      confidence: Math.round(confidence),
      algorithm: 'frequency',
      details: {
        hotNumbers: sorted.slice(0, 6).map(e => e[0]),
        coldNumbers: sorted.slice(-6).map(e => e[0]),
      }
    };
  }
}
