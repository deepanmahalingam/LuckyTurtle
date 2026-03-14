import { CONFIG } from '../config.js';
import { DataTransformer } from '../data/data-transformer.js';

export class Heatmap {
  static init(draws) {
    Heatmap.draws = draws;
    Heatmap.render('all');
    Heatmap.bindEvents();
  }

  static bindEvents() {
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const range = e.target.dataset.range;
        Heatmap.render(range);
      });
    });
  }

  static render(range) {
    const container = document.getElementById('heatmap-grid');
    if (!container) return;

    const lastN = range === 'all' ? null : parseInt(range);
    const freq = DataTransformer.buildFrequencyTable(Heatmap.draws, lastN);

    const values = [...freq.values()];
    const minFreq = Math.min(...values);
    const maxFreq = Math.max(...values);
    const freqRange = maxFreq - minFreq || 1;

    container.innerHTML = '';

    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const count = freq.get(n) || 0;
      const intensity = (count - minFreq) / freqRange; // 0 to 1

      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.textContent = n;

      // Color interpolation: cold (blue) -> cool -> warm -> hot (red)
      const color = Heatmap.getHeatColor(intensity);
      cell.style.backgroundColor = color;
      cell.style.color = intensity > 0.6 ? 'white' : 'var(--color-text-primary)';

      // Tooltip
      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip';
      tooltip.textContent = `#${n}: ${count} times`;
      cell.appendChild(tooltip);

      container.appendChild(cell);
    }
  }

  static getHeatColor(intensity) {
    // Interpolate through: #DBEAFE (cold) -> #93C5FD -> #FDE68A -> #FBBF24 -> #EF4444 (hot)
    if (intensity <= 0.25) {
      return Heatmap.lerpColor('#DBEAFE', '#93C5FD', intensity / 0.25);
    } else if (intensity <= 0.5) {
      return Heatmap.lerpColor('#93C5FD', '#FDE68A', (intensity - 0.25) / 0.25);
    } else if (intensity <= 0.75) {
      return Heatmap.lerpColor('#FDE68A', '#FBBF24', (intensity - 0.5) / 0.25);
    } else {
      return Heatmap.lerpColor('#FBBF24', '#EF4444', (intensity - 0.75) / 0.25);
    }
  }

  static lerpColor(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16);
    const bg = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);

    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bv = Math.round(ab + (bb - ab) * t);

    return `rgb(${r}, ${g}, ${bv})`;
  }
}
