import { CONFIG } from '../config.js';
import { DataTransformer } from '../data/data-transformer.js';

export class PatternAnalyzer {
  constructor(draws) {
    this.draws = draws;
  }

  predict() {
    const recent = this.draws.slice(-300);
    const pairMatrix = DataTransformer.buildPairMatrix(recent);

    // Analyze even/odd distribution in recent draws
    const evenOddDist = this.analyzeEvenOdd(recent.slice(-50));
    // Analyze sum ranges
    const sumRange = this.analyzeSumRange(recent.slice(-100));
    // Analyze number range distribution (low/mid/high)
    const rangeDist = this.analyzeRangeDist(recent.slice(-50));

    // Find strongest pairs
    const pairs = [];
    for (let i = 1; i <= CONFIG.NUMBERS_MAX; i++) {
      for (let j = i + 1; j <= CONFIG.NUMBERS_MAX; j++) {
        pairs.push({ a: i, b: j, count: pairMatrix[i][j] });
      }
    }
    pairs.sort((a, b) => b.count - a.count);

    // Score each number based on pair strength
    const scores = new Map();
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) scores.set(n, 0);

    // Top 50 pairs contribute to scores
    for (const pair of pairs.slice(0, 50)) {
      scores.set(pair.a, scores.get(pair.a) + pair.count);
      scores.set(pair.b, scores.get(pair.b) + pair.count);
    }

    // Apply even/odd balance preference
    const targetEven = evenOddDist.avgEven;
    const targetOdd = 6 - targetEven;

    // Apply range distribution preference
    const candidates = [...scores.entries()]
      .map(([num, score]) => ({
        num,
        score,
        isEven: num % 2 === 0,
        range: num <= 16 ? 'low' : num <= 33 ? 'mid' : 'high'
      }))
      .sort((a, b) => b.score - a.score);

    const selected = [];
    let evenCount = 0;
    let rangeCount = { low: 0, mid: 0, high: 0 };

    // Greedy selection with constraints
    for (const cand of candidates) {
      if (selected.length >= 6) break;

      const wouldBeEven = evenCount + (cand.isEven ? 1 : 0);
      const wouldBeOdd = selected.length + 1 - wouldBeEven;

      // Don't exceed 4 even or 4 odd
      if (wouldBeEven > 4 || wouldBeOdd > 4) continue;

      // Don't put more than 3 in one range
      if (rangeCount[cand.range] >= 3) continue;

      selected.push(cand.num);
      if (cand.isEven) evenCount++;
      rangeCount[cand.range]++;
    }

    // Fill remaining
    while (selected.length < 6) {
      const n = Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1;
      if (!selected.includes(n)) selected.push(n);
    }

    selected.sort((a, b) => a - b);

    // Confidence based on pattern strength
    const avgScore = selected.reduce((s, n) => s + (scores.get(n) || 0), 0) / 6;
    const maxScore = Math.max(...[...scores.values()]);
    const confidence = Math.min(88, Math.max(35, (avgScore / maxScore) * 90));

    return {
      numbers: selected,
      confidence: Math.round(confidence),
      algorithm: 'pattern',
      details: {
        topPairs: pairs.slice(0, 5).map(p => `${p.a}-${p.b} (${p.count})`),
        evenOdd: `${evenCount}E/${6 - evenCount}O`,
        sumTarget: sumRange.avgSum
      }
    };
  }

  analyzeEvenOdd(draws) {
    let totalEven = 0;
    for (const draw of draws) {
      totalEven += draw.numbers.filter(n => n % 2 === 0).length;
    }
    return { avgEven: Math.round(totalEven / draws.length) };
  }

  analyzeSumRange(draws) {
    let totalSum = 0;
    for (const draw of draws) {
      totalSum += draw.numbers.reduce((s, n) => s + n, 0);
    }
    return { avgSum: Math.round(totalSum / draws.length) };
  }

  analyzeRangeDist(draws) {
    let low = 0, mid = 0, high = 0;
    for (const draw of draws) {
      draw.numbers.forEach(n => {
        if (n <= 16) low++;
        else if (n <= 33) mid++;
        else high++;
      });
    }
    const total = draws.length;
    return {
      avgLow: (low / total).toFixed(1),
      avgMid: (mid / total).toFixed(1),
      avgHigh: (high / total).toFixed(1)
    };
  }
}
