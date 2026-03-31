import { CONFIG } from './config.js';
import { DataLoader } from './data/data-loader.js';
import { DataTransformer } from './data/data-transformer.js';
import { PredictionEngine } from './ml/prediction-engine.js';
import { ThemeManager } from './ui/theme-manager.js';
import { TabController } from './ui/tab-controller.js';
import { BallAnimator } from './ui/ball-animator.js';
import { Heatmap } from './ui/heatmap.js';
import { Charts } from './ui/charts.js';
import { NumberPicker } from './ui/number-picker.js';
import { TurtleShellUI } from './ui/turtle-shell-ui.js';

class LuckyTurtleApp {
  constructor() {
    this.draws = [];
    this.predictionEngine = null;
    this.predictions = [];
  }

  async init() {
    try {
      // 1. Theme & Navigation
      ThemeManager.init();
      TabController.init();

      // 2. Load data
      this.setLoading('Fetching 70+ years of lottery data...');
      const rawData = await DataLoader.load((msg) => this.setLoading(msg));

      // 3. Transform data
      this.setLoading('Processing historical draws...');
      this.draws = DataTransformer.parseDraws(rawData);

      if (this.draws.length === 0) {
        throw new Error('No valid draws found in data');
      }

      // 4. Initialize prediction engine
      this.setLoading('Training AI prediction models...');
      this.predictionEngine = new PredictionEngine(this.draws);
      await this.predictionEngine.init();

      // 5. Render dashboard
      this.setLoading('Rendering dashboard...');
      this.renderDashboard();

      // 6. Initialize analytics (deferred)
      setTimeout(() => {
        Heatmap.init(this.draws);
        Charts.init(this.draws);
        NumberPicker.init(this.draws);
        TurtleShellUI.init(this.draws);
      }, 100);

      // 7. Bind events
      this.bindEvents();

      // 8. Hide loading
      this.hideLoading();

      this.toast('Lucky Turtle is ready! Loaded ' + this.draws.length.toLocaleString() + ' historical draws.', 'success');
    } catch (err) {
      console.error('Init failed:', err);
      this.setLoading('Error: ' + err.message + '. Please refresh.');
    }
  }

  renderDashboard() {
    const totalDraws = this.draws.length;
    const lastDraw = this.draws[totalDraws - 1];
    const freq = DataTransformer.buildFrequencyTable(this.draws);

    // Find hottest and coldest
    let hottest = { num: 0, count: 0 };
    let coldest = { num: 0, count: Infinity };
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const c = freq.get(n) || 0;
      if (c > hottest.count) hottest = { num: n, count: c };
      if (c < coldest.count) coldest = { num: n, count: c };
    }

    // Update stats
    this.setText('stat-total-draws', totalDraws.toLocaleString());
    this.setText('stat-last-draw', lastDraw.date.toLocaleDateString('de-DE'));
    this.setText('stat-hottest', `#${hottest.num} (${hottest.count}x)`);
    this.setText('stat-coldest', `#${coldest.num} (${coldest.count}x)`);

    // Render latest draw balls
    this.setText('latest-draw-date', lastDraw.date.toLocaleDateString('de-DE'));
    const ballsContainer = document.getElementById('latest-draw-balls');
    if (ballsContainer) {
      BallAnimator.renderBalls(ballsContainer, lastDraw.numbers, { animate: true });
    }
  }

  bindEvents() {
    // Quick predict on dashboard
    const quickBtn = document.getElementById('btn-quick-predict');
    if (quickBtn) {
      quickBtn.addEventListener('click', () => this.quickPredict());
    }

    // Full predict
    const genBtn = document.getElementById('btn-generate');
    if (genBtn) {
      genBtn.addEventListener('click', () => this.generatePrediction());
    }

    // Select all algorithms
    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.algo-checkbox').forEach(cb => cb.checked = true);
      });
    }

    // Clear history
    const clearHistBtn = document.getElementById('btn-clear-history');
    if (clearHistBtn) {
      clearHistBtn.addEventListener('click', () => {
        this.predictions = [];
        this.renderPredictionHistory();
      });
    }
  }

  quickPredict() {
    if (!this.predictionEngine) return;

    let result;
    try {
      result = this.predictionEngine.predict();
    } catch (err) {
      console.error('Quick predict failed:', err);
      this.toast('Prediction error: ' + err.message, 'error');
      return;
    }
    const container = document.getElementById('dashboard-prediction');
    if (!container) return;

    container.classList.add('has-results');
    container.innerHTML = '';

    const ballsDiv = document.createElement('div');
    ballsDiv.className = 'balls-container';
    BallAnimator.renderBallsWithDelay(ballsDiv, result.numbers, 200);
    container.appendChild(ballsDiv);

    const info = document.createElement('p');
    info.style.cssText = 'margin-top:var(--space-md);font-size:0.8rem;color:var(--color-text-muted);';
    info.textContent = `Ensemble confidence: ${result.confidence}% | Verified unique`;
    container.appendChild(info);

    this.predictions.unshift(result);
    this.toast('AI prediction generated!', 'success');
  }

  async generatePrediction() {
    if (!this.predictionEngine) return;

    const genBtn = document.getElementById('btn-generate');
    if (genBtn) {
      genBtn.classList.add('loading');
      genBtn.disabled = true;
    }

    // Get selected algorithms
    const selectedAlgos = [...document.querySelectorAll('.algo-checkbox:checked')]
      .map(cb => cb.value);

    if (selectedAlgos.length === 0) {
      this.toast('Please select at least one algorithm', 'error');
      if (genBtn) { genBtn.classList.remove('loading'); genBtn.disabled = false; }
      return;
    }

    // Small delay for UX
    await new Promise(r => setTimeout(r, 500));

    try {
      const result = this.predictionEngine.predict(selectedAlgos);

      // Render results
      const resultsPanel = document.getElementById('predict-results');
      if (resultsPanel) {
        resultsPanel.classList.add('has-results');
        resultsPanel.innerHTML = '';

        const ballsDiv = document.createElement('div');
        ballsDiv.className = 'balls-container';
        BallAnimator.renderBallsWithDelay(ballsDiv, result.numbers, 200);
        resultsPanel.appendChild(ballsDiv);

        const meta = document.createElement('div');
        meta.style.cssText = 'margin-top:var(--space-md);font-size:0.8rem;color:var(--color-text-muted);text-align:center;';
        meta.innerHTML = `
          <p>Ensemble confidence: <strong style="color:var(--color-primary)">${result.confidence}%</strong></p>
          <p style="font-size:0.7rem;">&#10003; Verified: never drawn in history</p>
        `;
        resultsPanel.appendChild(meta);
      }

      // Update confidence meters
      this.updateConfidenceMeters(result);

      // Save to history
      this.predictions.unshift(result);
      this.renderPredictionHistory();

      this.toast('Prediction generated successfully!', 'success');
    } catch (err) {
      console.error('Prediction failed:', err);
      this.toast('Prediction failed: ' + err.message, 'error');
    } finally {
      if (genBtn) { genBtn.classList.remove('loading'); genBtn.disabled = false; }
    }
  }

  updateConfidenceMeters(result) {
    const algos = ['frequency', 'neural', 'pattern', 'gap', 'bayesian'];

    for (const algo of algos) {
      const fill = document.getElementById(`conf-${algo}`);
      const val = document.getElementById(`conf-val-${algo}`);
      const individual = result.individualResults?.[algo];

      if (fill && val && individual) {
        fill.style.width = individual.confidence + '%';
        val.textContent = individual.confidence + '%';
      } else if (fill && val) {
        fill.style.width = '0%';
        val.textContent = '--%';
      }
    }

    // Ensemble
    const ensFill = document.getElementById('conf-ensemble');
    const ensVal = document.getElementById('conf-val-ensemble');
    if (ensFill && ensVal) {
      ensFill.style.width = result.confidence + '%';
      ensVal.textContent = result.confidence + '%';
    }
  }

  renderPredictionHistory() {
    const container = document.getElementById('prediction-history');
    if (!container) return;

    if (this.predictions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128196;</div>
          <p>No predictions yet this session</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    for (const pred of this.predictions.slice(0, 20)) {
      const item = document.createElement('div');
      item.className = 'prediction-item';

      const ballsDiv = document.createElement('div');
      ballsDiv.className = 'prediction-balls';
      BallAnimator.renderBalls(ballsDiv, pred.numbers, { size: 'small', animate: false });

      const meta = document.createElement('div');
      meta.className = 'prediction-meta';
      const time = new Date(pred.timestamp);
      meta.innerHTML = `${pred.confidence}%<br>${time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

      item.appendChild(ballsDiv);
      item.appendChild(meta);
      container.appendChild(item);
    }
  }

  // === Utilities ===
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setLoading(message) {
    const msgEl = document.getElementById('loading-message');
    if (msgEl) msgEl.textContent = message;
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.style.display = 'none', 500);
    }
  }

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F' };
    toast.innerHTML = `
      <span>${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window._app = new LuckyTurtleApp();
  window._app.init();
});
