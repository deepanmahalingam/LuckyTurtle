import { CONFIG } from '../config.js';
import { DataTransformer } from '../data/data-transformer.js';

export class BayesianModel {
  constructor(draws) {
    this.draws = draws;
  }

  predict() {
    const totalDraws = this.draws.length;
    const allFreq = DataTransformer.buildFrequencyTable(this.draws);
    const recentFreq = DataTransformer.buildFrequencyTable(this.draws, 100);

    // Prior: historical frequency normalized as probability
    const prior = new Map();
    const totalNumbers = totalDraws * CONFIG.DRAW_SIZE;
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      prior.set(n, (allFreq.get(n) || 0) / totalNumbers);
    }

    // Likelihood: recent frequency as evidence update
    const recentTotal = Math.min(100, totalDraws) * CONFIG.DRAW_SIZE;
    const likelihood = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      likelihood.set(n, (recentFreq.get(n) || 0) / recentTotal);
    }

    // Posterior = Prior * Likelihood (normalized)
    const posterior = new Map();
    let posteriorSum = 0;
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const p = prior.get(n) * likelihood.get(n);
      posterior.set(n, p);
      posteriorSum += p;
    }

    // Normalize
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      posterior.set(n, posteriorSum > 0 ? posterior.get(n) / posteriorSum : 1 / CONFIG.NUMBERS_MAX);
    }

    // Apply consecutive draw correlation
    const lastDraw = this.draws[this.draws.length - 1];
    const consecutiveBoost = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      // Numbers adjacent to last draw numbers get a small boost
      let boost = 0;
      for (const lastNum of lastDraw.numbers) {
        if (Math.abs(n - lastNum) <= 2 && n !== lastNum) {
          boost += 0.02;
        }
      }
      // Numbers that appeared in last draw get a slight penalty (unlikely to repeat)
      if (lastDraw.numbers.includes(n)) {
        boost -= 0.03;
      }
      consecutiveBoost.set(n, boost);
    }

    // Final scores
    const scores = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      scores.set(n, posterior.get(n) + consecutiveBoost.get(n));
    }

    // Weighted random sampling based on posterior probabilities
    const selected = [];
    const available = [...scores.entries()].map(([num, score]) => ({ num, score }));

    while (selected.length < 6 && available.length > 0) {
      // Softmax-like selection
      const maxScore = Math.max(...available.map(a => a.score));
      const expScores = available.map(a => Math.exp((a.score - maxScore) * 20));
      const sumExp = expScores.reduce((s, v) => s + v, 0);

      let r = Math.random() * sumExp;
      for (let i = 0; i < available.length; i++) {
        r -= expScores[i];
        if (r <= 0) {
          selected.push(available[i].num);
          available.splice(i, 1);
          break;
        }
      }
    }

    selected.sort((a, b) => a - b);

    // Confidence based on posterior concentration
    const selectedPosterior = selected.map(n => posterior.get(n));
    const avgPosterior = selectedPosterior.reduce((s, v) => s + v, 0) / 6;
    const uniformProb = 1 / CONFIG.NUMBERS_MAX;
    const liftOverUniform = avgPosterior / uniformProb;
    const confidence = Math.min(82, Math.max(25, liftOverUniform * 55));

    return {
      numbers: selected,
      confidence: Math.round(confidence),
      algorithm: 'bayesian',
      details: {
        topPosterior: [...posterior.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([n, p]) => ({ number: n, probability: (p * 100).toFixed(2) + '%' }))
      }
    };
  }
}
