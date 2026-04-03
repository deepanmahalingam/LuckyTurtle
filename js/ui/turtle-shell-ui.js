import { BallAnimator } from './ball-animator.js';
import { TurtleShellAlgorithm } from '../ml/turtle-shell-algorithm.js';
import { TurtleShellValidator } from '../ml/turtle-shell-validator.js';
import { UniquenessValidator } from '../ml/uniqueness-validator.js';

export class TurtleShellUI {
  static algorithm = null;
  static shellValidator = null;
  static validator = null;
  static history = [];
  static draws = [];

  static init(draws) {
    TurtleShellUI.draws = draws;
    TurtleShellUI.algorithm = new TurtleShellAlgorithm(draws);
    TurtleShellUI.shellValidator = new TurtleShellValidator(draws);
    TurtleShellUI.validator = new UniquenessValidator(draws);
    TurtleShellUI.renderLastDraws(draws.slice(-9));
    TurtleShellUI.bindEvents();
  }

  static bindEvents() {
    const btn = document.getElementById('btn-turtle-predict');
    if (btn) btn.addEventListener('click', () => TurtleShellUI.runPrediction());

    const validateBtn = document.getElementById('btn-turtle-validate');
    if (validateBtn) validateBtn.addEventListener('click', () => TurtleShellUI.runValidation());

    const clearBtn = document.getElementById('btn-turtle-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      TurtleShellUI.history = [];
      TurtleShellUI.renderHistory();
    });
  }

  static renderLastDraws(draws) {
    const container = document.getElementById('turtle-last5-draws');
    if (!container) return;

    container.innerHTML = '';
    const count = draws.length;

    draws.forEach((draw, i) => {
      const row = document.createElement('div');
      row.className = 'turtle-draw-row';

      const labelText = i === count - 1 ? 'Latest' : `Draw -${count - i}`;
      const label = document.createElement('span');
      label.className = `turtle-draw-label ${i === count - 1 ? 'latest' : ''}`;
      label.textContent = labelText;

      const balls = document.createElement('div');
      balls.className = 'turtle-draw-balls';
      BallAnimator.renderBalls(balls, draw.numbers, { size: 'small', animate: false });

      const date = document.createElement('span');
      date.className = 'turtle-draw-label';
      date.style.minWidth = 'auto';
      date.textContent = draw.date.toLocaleDateString('de-DE');

      row.appendChild(label);
      row.appendChild(balls);
      row.appendChild(date);
      container.appendChild(row);
    });
  }

  static async runPrediction() {
    const btn = document.getElementById('btn-turtle-predict');
    if (btn) { btn.classList.add('loading'); btn.disabled = true; }

    // Small delay for UX
    await new Promise(r => setTimeout(r, 400));

    try {
      let result = TurtleShellUI.algorithm.predict();

      // Ensure uniqueness
      if (!TurtleShellUI.validator.isUnique(result.numbers)) {
        result = TurtleShellUI.validator.ensureUnique(
          () => TurtleShellUI.algorithm.predict()
        );
      }

      // Render all result panels
      TurtleShellUI.renderShellGrid(result);
      TurtleShellUI.renderPredictionResult(result);
      TurtleShellUI.renderLayerAgreement(result);
      TurtleShellUI.renderPatternDetails(result);

      // Add to history
      TurtleShellUI.history.unshift(result);
      TurtleShellUI.renderHistory();

      // Show cards
      ['turtle-grid-card', 'turtle-result-card', 'turtle-layers-card', 'turtle-details-card']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = '';
        });

    } catch (err) {
      console.error('Turtle Shell prediction failed:', err);
    } finally {
      if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
    }
  }

  static renderShellGrid(result) {
    const container = document.getElementById('turtle-shell-grid');
    const badge = document.getElementById('turtle-confidence-badge');
    if (!container) return;

    if (badge) badge.textContent = result.confidence + '%';

    const grid = result.shellGrid;
    const maxScore = Math.max(...grid.map(c => c.score));
    const minScore = Math.min(...grid.map(c => c.score));
    const range = maxScore - minScore || 1;

    container.innerHTML = '';

    for (const cell of grid) {
      const intensity = (cell.score - minScore) / range;
      const isSelected = result.numbers.includes(cell.number);

      const div = document.createElement('div');
      div.className = `turtle-shell-cell ${isSelected ? 'selected' : ''}`;

      // Color: dark -> emerald -> gold -> red based on intensity
      const color = TurtleShellUI.getConvergenceColor(intensity);
      div.style.backgroundColor = color;
      div.style.color = intensity > 0.5 ? 'white' : 'var(--color-text-primary)';

      const numSpan = document.createElement('span');
      numSpan.textContent = cell.number;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'cell-score';
      scoreSpan.textContent = (intensity * 100).toFixed(0) + '%';

      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip';
      tooltip.textContent = `#${cell.number} | Sector ${cell.sector + 1} | Score: ${cell.score.toFixed(2)}`;

      div.appendChild(numSpan);
      div.appendChild(scoreSpan);
      div.appendChild(tooltip);
      container.appendChild(div);
    }
  }

  static getConvergenceColor(intensity) {
    if (intensity <= 0.2) return TurtleShellUI.lerp('#1E293B', '#065F46', intensity / 0.2);
    if (intensity <= 0.4) return TurtleShellUI.lerp('#065F46', '#059669', (intensity - 0.2) / 0.2);
    if (intensity <= 0.6) return TurtleShellUI.lerp('#059669', '#10B981', (intensity - 0.4) / 0.2);
    if (intensity <= 0.8) return TurtleShellUI.lerp('#10B981', '#FBBF24', (intensity - 0.6) / 0.2);
    return TurtleShellUI.lerp('#FBBF24', '#EF4444', (intensity - 0.8) / 0.2);
  }

  static lerp(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bv = Math.round(ab + (bb - ab) * t);
    return `rgb(${r}, ${g}, ${bv})`;
  }

  static renderPredictionResult(result) {
    const container = document.getElementById('turtle-prediction-balls');
    const confText = document.getElementById('turtle-confidence-text');
    const verification = document.getElementById('turtle-verification');
    if (!container) return;

    BallAnimator.renderBallsWithDelay(container, result.numbers, 200);

    if (confText) confText.textContent = result.confidence + '% Pattern Confidence';
    if (verification) {
      verification.innerHTML = `
        <p>&#10003; Verified: never drawn in 70+ years of history</p>
        <p style="margin-top:4px;font-size:0.7rem;">7 convergence layers analyzed across last 9 draws</p>
      `;
    }
  }

  static renderLayerAgreement(result) {
    const container = document.getElementById('turtle-layers');
    if (!container) return;

    container.innerHTML = '';

    for (const layer of result.layerAgreement) {
      const item = document.createElement('div');
      item.className = 'turtle-layer-item';

      const pct = layer.percentage;
      const fillColor = pct >= 83 ? '#10B981' : pct >= 50 ? '#FBBF24' : '#EF4444';
      const pctColor = pct >= 83 ? 'var(--color-primary)' : pct >= 50 ? 'var(--color-accent)' : 'var(--color-danger)';

      item.innerHTML = `
        <span class="turtle-layer-icon">${layer.icon}</span>
        <div class="turtle-layer-info">
          <div class="turtle-layer-name">${layer.name}</div>
          <div class="turtle-layer-agreement">${layer.agreement} of 6 numbers agreed</div>
        </div>
        <div class="turtle-layer-bar">
          <div class="turtle-layer-fill" style="width: ${pct}%; background: ${fillColor};"></div>
        </div>
        <span class="turtle-layer-pct" style="color: ${pctColor};">${pct}%</span>
      `;

      container.appendChild(item);
    }

    // Overall convergence summary
    const totalAgree = result.layerAgreement.reduce((s, l) => s + l.agreement, 0);
    const maxPossible = result.layerAgreement.length * 6;
    const summary = document.createElement('div');
    summary.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: var(--space-md); margin-top: var(--space-sm); border-top: 1px solid var(--color-border); font-size: 0.85rem;';
    summary.innerHTML = `
      <strong style="color: var(--color-primary);">Overall Convergence: ${totalAgree}/${maxPossible}</strong>
      <span style="color: var(--color-text-muted);"> &mdash; ${result.confidence}% pattern confidence</span>
    `;
    container.appendChild(summary);
  }

  static renderPatternDetails(result) {
    const container = document.getElementById('turtle-pattern-details');
    if (!container || !result.patternDetails) return;

    const pd = result.patternDetails;
    container.innerHTML = `
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${pd.sectorCount}/7</div>
        <div class="turtle-detail-label">Active Sectors</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${pd.evenOdd}</div>
        <div class="turtle-detail-label">Even / Odd</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${pd.sum}</div>
        <div class="turtle-detail-label">Number Sum</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${pd.sumDelta > 0 ? '+' : ''}${pd.sumDelta}</div>
        <div class="turtle-detail-label">Sum vs Last</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${pd.rangeSpread}</div>
        <div class="turtle-detail-label">Range Spread</div>
      </div>
    `;
  }

  // ==================== VALIDATION & BACKTEST ====================

  static async runValidation() {
    const btn = document.getElementById('btn-turtle-validate');
    if (btn) { btn.classList.add('loading'); btn.disabled = true; }

    await new Promise(r => setTimeout(r, 500));

    try {
      // Re-create validator with latest draws
      TurtleShellUI.shellValidator = new TurtleShellValidator(TurtleShellUI.draws);
      const result = TurtleShellUI.shellValidator.predictWithValidation();

      // Render all validation panels
      TurtleShellUI.renderBacktestSummary(result.validationReport);
      TurtleShellUI.renderRoundsDetail(result.validationReport);
      TurtleShellUI.renderCorrectionBias(result.validationReport);
      TurtleShellUI.renderCorrectedPrediction(result);

      // Show cards
      ['turtle-backtest-summary', 'turtle-rounds-card', 'turtle-bias-card', 'turtle-corrected-card']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = '';
        });

      // Also add corrected result to history
      TurtleShellUI.history.unshift(result);
      TurtleShellUI.renderHistory();

    } catch (err) {
      console.error('Turtle Shell validation failed:', err);
    } finally {
      if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
    }
  }

  static renderBacktestSummary(report) {
    const container = document.getElementById('turtle-backtest-stats');
    if (!container) return;

    const hitClass = report.avgHitRate >= 20 ? 'color:var(--color-primary)' : report.avgHitRate >= 10 ? 'color:var(--color-accent)' : 'color:#EF4444';

    container.innerHTML = `
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${report.rounds}</div>
        <div class="turtle-detail-label">Test Rounds</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value" style="${hitClass}">${report.avgHitRate}%</div>
        <div class="turtle-detail-label">Avg Hit Rate</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${report.totalHits}/${report.totalPossible}</div>
        <div class="turtle-detail-label">Total Hits</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${report.avgProximity}%</div>
        <div class="turtle-detail-label">Proximity Score</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value">${report.avgSectorAccuracy}%</div>
        <div class="turtle-detail-label">Sector Accuracy</div>
      </div>
      <div class="turtle-detail-item">
        <div class="turtle-detail-value" style="color:var(--color-primary)">${report.bestRound.hits}</div>
        <div class="turtle-detail-label">Best Round Hits</div>
      </div>
    `;
  }

  static renderRoundsDetail(report) {
    const container = document.getElementById('turtle-rounds-list');
    if (!container) return;

    container.innerHTML = '';

    for (const round of report.roundDetails) {
      const item = document.createElement('div');
      item.className = `turtle-round-item hit-${round.hitCount}`;

      const hitClass = round.hitCount >= 3 ? 'good' : round.hitCount >= 1 ? 'ok' : 'poor';
      const dateStr = round.drawDate ? round.drawDate.toLocaleDateString('de-DE') : '';

      // Build number tags
      const actualSet = new Set(round.actual);
      const predictedSet = new Set(round.predicted);

      // Predicted row: hits in green, false positives struck through
      let predictedTags = round.predicted.map(n =>
        actualSet.has(n)
          ? `<span class="num-tag hit">${n}</span>`
          : `<span class="num-tag fp">${n}</span>`
      ).join('');

      // Actual row: hits in green, misses in red
      let actualTags = round.actual.map(n =>
        predictedSet.has(n)
          ? `<span class="num-tag hit">${n}</span>`
          : `<span class="num-tag miss">${n}</span>`
      ).join('');

      item.innerHTML = `
        <div class="turtle-round-header">
          <span class="turtle-round-label">Round ${round.round + 1} ${dateStr ? '&mdash; ' + dateStr : ''}</span>
          <span class="turtle-round-hits ${hitClass}">${round.hitCount}/6 hits</span>
        </div>
        <div class="turtle-round-numbers">
          <span class="turtle-round-row-label">Predicted:</span>
          ${predictedTags}
        </div>
        <div class="turtle-round-numbers" style="margin-top:4px;">
          <span class="turtle-round-row-label">Actual:</span>
          ${actualTags}
        </div>
        <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:6px;">
          Proximity: ${round.proximityScore}% &bull; Sectors: ${round.sectorHits} matched
        </div>
      `;

      container.appendChild(item);
    }
  }

  static renderCorrectionBias(report) {
    const boostContainer = document.getElementById('turtle-boost-list');
    const suppressContainer = document.getElementById('turtle-suppress-list');
    if (!boostContainer || !suppressContainer) return;

    // Find max bias for bar scaling
    const allBias = [...report.boostCandidates, ...report.suppressCandidates];
    const maxBias = Math.max(...allBias.map(c => Math.abs(parseFloat(c.bias))), 0.1);

    // Render boost candidates
    boostContainer.innerHTML = '';
    if (report.boostCandidates.length === 0) {
      boostContainer.innerHTML = '<p style="font-size:0.75rem;color:var(--color-text-muted);">No boost candidates found</p>';
    } else {
      for (const c of report.boostCandidates) {
        const pct = Math.round((Math.abs(parseFloat(c.bias)) / maxBias) * 100);
        boostContainer.innerHTML += `
          <div class="turtle-bias-item">
            <span class="turtle-bias-num" style="color:#10B981;">#${c.number}</span>
            <div class="turtle-bias-bar">
              <div class="turtle-bias-fill boost" style="width:${pct}%"></div>
            </div>
            <span class="turtle-bias-val">+${c.bias}</span>
          </div>
        `;
      }
    }

    // Render suppress candidates
    suppressContainer.innerHTML = '';
    if (report.suppressCandidates.length === 0) {
      suppressContainer.innerHTML = '<p style="font-size:0.75rem;color:var(--color-text-muted);">No suppress candidates found</p>';
    } else {
      for (const c of report.suppressCandidates) {
        const pct = Math.round((Math.abs(parseFloat(c.bias)) / maxBias) * 100);
        suppressContainer.innerHTML += `
          <div class="turtle-bias-item">
            <span class="turtle-bias-num" style="color:#EF4444;">#${c.number}</span>
            <div class="turtle-bias-bar">
              <div class="turtle-bias-fill suppress" style="width:${pct}%"></div>
            </div>
            <span class="turtle-bias-val">${c.bias}</span>
          </div>
        `;
      }
    }
  }

  static renderCorrectedPrediction(result) {
    const container = document.getElementById('turtle-corrected-balls');
    const confBadge = document.getElementById('turtle-corrected-confidence');
    const info = document.getElementById('turtle-corrected-info');
    if (!container) return;

    BallAnimator.renderBallsWithDelay(container, result.numbers, 200);

    if (confBadge) confBadge.textContent = result.confidence + '%';

    if (info) {
      if (result.correctionApplied) {
        const orig = result.originalNumbers.join(', ');
        info.innerHTML = `
          <div class="turtle-correction-diff">
            <span>Original: <strong>${orig}</strong></span>
            <span class="turtle-correction-arrow">&#10140;</span>
            <span>Corrected: <strong>${result.numbers.join(', ')}</strong></span>
          </div>
          <p style="margin-top:8px;font-size:0.7rem;">&#10003; Corrections applied from backtest learning</p>
        `;
      } else {
        info.innerHTML = '<p>&#10003; No corrections needed &mdash; original prediction was optimal</p>';
      }
    }
  }

  static renderHistory() {
    const container = document.getElementById('turtle-history');
    if (!container) return;

    if (TurtleShellUI.history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128034;</div>
          <p>Run the Turtle Shell Algorithm to see results</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    for (const pred of TurtleShellUI.history.slice(0, 20)) {
      const item = document.createElement('div');
      item.className = 'prediction-item';

      const ballsDiv = document.createElement('div');
      ballsDiv.className = 'prediction-balls';
      BallAnimator.renderBalls(ballsDiv, pred.numbers, { size: 'small', animate: false });

      const meta = document.createElement('div');
      meta.className = 'prediction-meta';
      const time = new Date(pred.timestamp);
      meta.innerHTML = `<strong style="color:var(--color-primary)">${pred.confidence}%</strong><br>${time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

      item.appendChild(ballsDiv);
      item.appendChild(meta);
      container.appendChild(item);
    }
  }
}
