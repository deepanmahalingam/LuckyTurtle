import { CONFIG } from '../config.js';

/**
 * Lightweight neural network implementation for browser.
 * Uses a simple feedforward network trained on recent draw patterns.
 * No TensorFlow.js dependency - pure JavaScript for fast loading.
 */
export class NeuralPredictor {
  constructor(draws) {
    this.draws = draws;
    this.windowSize = 10;
    this.hiddenSize = 64;
    this.learningRate = 0.01;
    this.epochs = 50;
    this.weights = null;
  }

  /**
   * Initialize and train the network
   */
  async init() {
    const { inputs, outputs } = this.prepareData();
    this.train(inputs, outputs);
  }

  /**
   * Prepare training data: sliding window of recent draws encoded as binary vectors
   */
  prepareData() {
    const draws = this.draws.slice(-500); // Use last 500 draws for training
    const inputs = [];
    const outputs = [];

    for (let i = this.windowSize; i < draws.length; i++) {
      // Input: flatten windowSize draws into a binary vector
      const input = [];
      for (let w = 0; w < this.windowSize; w++) {
        const vec = new Array(CONFIG.NUMBERS_MAX).fill(0);
        draws[i - this.windowSize + w].numbers.forEach(n => vec[n - 1] = 1);
        input.push(...vec);
      }
      inputs.push(input);

      // Output: binary vector for the target draw
      const output = new Array(CONFIG.NUMBERS_MAX).fill(0);
      draws[i].numbers.forEach(n => output[n - 1] = 1);
      outputs.push(output);
    }

    return { inputs, outputs };
  }

  /**
   * Simple 2-layer network: input -> hidden (ReLU) -> output (sigmoid)
   */
  train(inputs, outputs) {
    const inputSize = this.windowSize * CONFIG.NUMBERS_MAX;
    const hiddenSize = this.hiddenSize;
    const outputSize = CONFIG.NUMBERS_MAX;

    // Xavier initialization
    const scale1 = Math.sqrt(2 / inputSize);
    const scale2 = Math.sqrt(2 / hiddenSize);

    // Weight matrices
    let w1 = Array.from({ length: hiddenSize }, () =>
      Array.from({ length: inputSize }, () => (Math.random() - 0.5) * scale1)
    );
    let b1 = new Array(hiddenSize).fill(0);

    let w2 = Array.from({ length: outputSize }, () =>
      Array.from({ length: hiddenSize }, () => (Math.random() - 0.5) * scale2)
    );
    let b2 = new Array(outputSize).fill(0);

    // Mini-batch SGD
    const batchSize = 32;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      // Shuffle indices
      const indices = Array.from({ length: inputs.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let batch = 0; batch < indices.length; batch += batchSize) {
        const batchIndices = indices.slice(batch, batch + batchSize);

        // Accumulate gradients
        const dw1 = Array.from({ length: hiddenSize }, () => new Array(inputSize).fill(0));
        const db1 = new Array(hiddenSize).fill(0);
        const dw2 = Array.from({ length: outputSize }, () => new Array(hiddenSize).fill(0));
        const db2 = new Array(outputSize).fill(0);

        for (const idx of batchIndices) {
          const x = inputs[idx];
          const y = outputs[idx];

          // Forward pass
          const hidden = new Array(hiddenSize);
          for (let h = 0; h < hiddenSize; h++) {
            let sum = b1[h];
            for (let i = 0; i < inputSize; i++) {
              sum += w1[h][i] * x[i];
            }
            hidden[h] = Math.max(0, sum); // ReLU
          }

          const out = new Array(outputSize);
          for (let o = 0; o < outputSize; o++) {
            let sum = b2[o];
            for (let h = 0; h < hiddenSize; h++) {
              sum += w2[o][h] * hidden[h];
            }
            out[o] = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, sum)))); // Sigmoid
          }

          // Backward pass
          const dOut = new Array(outputSize);
          for (let o = 0; o < outputSize; o++) {
            dOut[o] = (out[o] - y[o]) * out[o] * (1 - out[o]);
          }

          const dHidden = new Array(hiddenSize).fill(0);
          for (let h = 0; h < hiddenSize; h++) {
            for (let o = 0; o < outputSize; o++) {
              dHidden[h] += w2[o][h] * dOut[o];
              dw2[o][h] += dOut[o] * hidden[h];
            }
            dHidden[h] *= hidden[h] > 0 ? 1 : 0; // ReLU derivative
            db1[h] += dHidden[h];
          }

          for (let o = 0; o < outputSize; o++) {
            db2[o] += dOut[o];
          }

          for (let h = 0; h < hiddenSize; h++) {
            for (let i = 0; i < inputSize; i++) {
              dw1[h][i] += dHidden[h] * x[i];
            }
          }
        }

        // Update weights
        const lr = this.learningRate / batchIndices.length;
        for (let h = 0; h < hiddenSize; h++) {
          b1[h] -= lr * db1[h];
          for (let i = 0; i < inputSize; i++) {
            w1[h][i] -= lr * dw1[h][i];
          }
        }
        for (let o = 0; o < outputSize; o++) {
          b2[o] -= lr * db2[o];
          for (let h = 0; h < hiddenSize; h++) {
            w2[o][h] -= lr * dw2[o][h];
          }
        }
      }
    }

    this.weights = { w1, b1, w2, b2 };
  }

  /**
   * Generate prediction using the trained network
   */
  predict() {
    if (!this.weights) {
      // Fallback: random weighted by frequency
      return this.fallbackPredict();
    }

    const { w1, b1, w2, b2 } = this.weights;
    const inputSize = this.windowSize * CONFIG.NUMBERS_MAX;
    const hiddenSize = this.hiddenSize;

    // Build input from last windowSize draws
    const recentDraws = this.draws.slice(-this.windowSize);
    const input = [];
    for (const draw of recentDraws) {
      const vec = new Array(CONFIG.NUMBERS_MAX).fill(0);
      draw.numbers.forEach(n => vec[n - 1] = 1);
      input.push(...vec);
    }

    // Forward pass
    const hidden = new Array(hiddenSize);
    for (let h = 0; h < hiddenSize; h++) {
      let sum = b1[h];
      for (let i = 0; i < inputSize; i++) {
        sum += w1[h][i] * input[i];
      }
      hidden[h] = Math.max(0, sum);
    }

    const scores = new Array(CONFIG.NUMBERS_MAX);
    for (let o = 0; o < CONFIG.NUMBERS_MAX; o++) {
      let sum = b2[o];
      for (let h = 0; h < hiddenSize; h++) {
        sum += w2[o][h] * hidden[h];
      }
      scores[o] = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, sum))));
    }

    // Select top 6 numbers with some stochasticity
    const numbered = scores.map((s, i) => ({ num: i + 1, score: s }));

    // Add small random noise for variety
    numbered.forEach(n => {
      n.score += (Math.random() - 0.5) * 0.05;
    });

    numbered.sort((a, b) => b.score - a.score);
    const selected = numbered.slice(0, 6).map(n => n.num).sort((a, b) => a - b);

    // Confidence based on score spread
    const topScores = numbered.slice(0, 6).map(n => n.score);
    const avgTop = topScores.reduce((s, v) => s + v, 0) / 6;
    const confidence = Math.min(92, Math.max(35, avgTop * 120));

    return {
      numbers: selected,
      confidence: Math.round(confidence),
      algorithm: 'neural',
      details: {
        topScores: numbered.slice(0, 10).map(n => ({ num: n.num, score: n.score.toFixed(4) }))
      }
    };
  }

  fallbackPredict() {
    const freq = new Map();
    for (let i = 1; i <= CONFIG.NUMBERS_MAX; i++) freq.set(i, 0);
    for (const draw of this.draws.slice(-200)) {
      draw.numbers.forEach(n => freq.set(n, freq.get(n) + 1));
    }
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const pool = sorted.slice(0, 20);
    const selected = [];
    while (selected.length < 6) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!selected.includes(pick[0])) selected.push(pick[0]);
    }
    selected.sort((a, b) => a - b);
    return { numbers: selected, confidence: 35, algorithm: 'neural', details: { fallback: true } };
  }
}
