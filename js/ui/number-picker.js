import { CONFIG } from '../config.js';
import { BallAnimator } from './ball-animator.js';

export class NumberPicker {
  static selected = new Set();
  static draws = [];

  static init(draws) {
    NumberPicker.draws = draws;
    NumberPicker.renderGrid();
    NumberPicker.bindEvents();
  }

  static renderGrid() {
    const grid = document.getElementById('picker-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const cell = document.createElement('div');
      cell.className = 'picker-cell';
      cell.textContent = n;
      cell.dataset.number = n;
      cell.addEventListener('click', () => NumberPicker.toggleNumber(n, cell));
      grid.appendChild(cell);
    }
  }

  static toggleNumber(num, cell) {
    if (NumberPicker.selected.has(num)) {
      NumberPicker.selected.delete(num);
      cell.classList.remove('selected');
    } else if (NumberPicker.selected.size < CONFIG.DRAW_SIZE) {
      NumberPicker.selected.add(num);
      cell.classList.add('selected');
    }
    NumberPicker.updateCounter();
  }

  static updateCounter() {
    const counter = document.getElementById('picker-count');
    const checkBtn = document.getElementById('btn-check-numbers');
    if (counter) counter.textContent = NumberPicker.selected.size;
    if (checkBtn) checkBtn.disabled = NumberPicker.selected.size !== CONFIG.DRAW_SIZE;
  }

  static bindEvents() {
    const checkBtn = document.getElementById('btn-check-numbers');
    const clearBtn = document.getElementById('btn-clear-picker');
    const luckyBtn = document.getElementById('btn-lucky-pick');

    if (checkBtn) checkBtn.addEventListener('click', () => NumberPicker.checkNumbers());
    if (clearBtn) clearBtn.addEventListener('click', () => NumberPicker.clear());
    if (luckyBtn) luckyBtn.addEventListener('click', () => NumberPicker.luckyPick());
  }

  static clear() {
    NumberPicker.selected.clear();
    document.querySelectorAll('.picker-cell').forEach(c => c.classList.remove('selected'));
    NumberPicker.updateCounter();

    const card = document.getElementById('match-results-card');
    if (card) card.style.display = 'none';
  }

  static luckyPick() {
    NumberPicker.clear();
    const nums = new Set();
    while (nums.size < CONFIG.DRAW_SIZE) {
      nums.add(Math.floor(Math.random() * CONFIG.NUMBERS_MAX) + 1);
    }

    // Animate selection with stagger
    const sorted = [...nums].sort((a, b) => a - b);
    sorted.forEach((num, i) => {
      setTimeout(() => {
        NumberPicker.selected.add(num);
        const cell = document.querySelector(`.picker-cell[data-number="${num}"]`);
        if (cell) {
          cell.classList.add('selected');
          cell.style.transform = 'scale(1.2)';
          setTimeout(() => cell.style.transform = '', 200);
        }
        NumberPicker.updateCounter();
      }, i * 120);
    });
  }

  static checkNumbers() {
    const selected = [...NumberPicker.selected].sort((a, b) => a - b);
    const card = document.getElementById('match-results-card');
    const resultsDiv = document.getElementById('match-results');
    if (!card || !resultsDiv) return;

    // Check exact matches
    const selectedKey = selected.join(',');
    let exactMatches = 0;

    // Check subset matches (how many draws contain at least N of these numbers)
    const matchCounts = { 6: 0, 5: 0, 4: 0, 3: 0, 2: 0 };

    for (const draw of NumberPicker.draws) {
      const drawSet = new Set(draw.numbers);
      const overlap = selected.filter(n => drawSet.has(n)).length;

      if (overlap >= 2) matchCounts[Math.min(overlap, 6)]++;
      if (overlap === 6) exactMatches++;
    }

    // Find nearest draw (most matching numbers)
    let bestMatch = { draw: null, count: 0 };
    for (const draw of NumberPicker.draws) {
      const drawSet = new Set(draw.numbers);
      const overlap = selected.filter(n => drawSet.has(n)).length;
      if (overlap > bestMatch.count) {
        bestMatch = { draw, count: overlap };
      }
    }

    card.style.display = 'block';
    resultsDiv.innerHTML = `
      <div class="match-result">
        <div class="match-count">${exactMatches}</div>
        <div class="match-label">Exact match${exactMatches !== 1 ? 'es' : ''} in history</div>
      </div>
      <div style="display:flex;gap:var(--space-md);justify-content:center;flex-wrap:wrap;margin:var(--space-lg) 0;">
        ${Object.entries(matchCounts).reverse().map(([n, count]) =>
          `<div style="text-align:center;padding:var(--space-sm) var(--space-md);background:var(--color-surface-hover);border-radius:var(--radius-md);">
            <div style="font-size:1.2rem;font-weight:800;color:var(--color-primary);">${count}</div>
            <div style="font-size:0.7rem;color:var(--color-text-muted);">${n} of 6</div>
          </div>`
        ).join('')}
      </div>
      ${bestMatch.draw ? `
        <div class="match-details">
          <p style="margin-bottom:var(--space-sm);">Best historical match: <strong>${bestMatch.count} of 6</strong> numbers</p>
          <p style="font-size:0.8rem;color:var(--color-text-muted);">
            Draw on ${bestMatch.draw.date.toLocaleDateString('de-DE')}: ${bestMatch.draw.numbers.join(', ')}
          </p>
        </div>
      ` : ''}
    `;

    // Scroll to results
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
