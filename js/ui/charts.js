import { CONFIG } from '../config.js';
import { DataTransformer } from '../data/data-transformer.js';
import { ThemeManager } from './theme-manager.js';

export class Charts {
  static charts = {};

  static getColors() {
    const isDark = ThemeManager.current === 'dark';
    return {
      text: isDark ? '#CBD5E1' : '#475569',
      grid: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)',
      primary: '#10B981',
      accent: '#F59E0B',
      danger: '#EF4444',
      blue: '#3B82F6',
      purple: '#8B5CF6',
    };
  }

  static init(draws) {
    Charts.draws = draws;

    // Wait for Chart.js to be available
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded');
      return;
    }

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = Charts.getColors().text;

    Charts.renderFrequencyChart();
    Charts.renderGapChart();
    Charts.renderDistributionChart();
    Charts.renderYearlyChart();

    // Update on theme change
    const observer = new MutationObserver(() => {
      Chart.defaults.color = Charts.getColors().text;
      Object.values(Charts.charts).forEach(c => c.update());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  static renderFrequencyChart() {
    const ctx = document.getElementById('chart-frequency');
    if (!ctx) return;

    const freq = DataTransformer.buildFrequencyTable(Charts.draws);
    const labels = [];
    const data = [];
    const colors = [];

    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      labels.push(n);
      data.push(freq.get(n) || 0);
      if (n <= 9) colors.push('#EF4444');
      else if (n <= 19) colors.push('#F59E0B');
      else if (n <= 29) colors.push('#10B981');
      else if (n <= 39) colors.push('#3B82F6');
      else colors.push('#8B5CF6');
    }

    Charts.charts.frequency = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Times Drawn',
          data,
          backgroundColor: colors.map(c => c + '99'),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Number ${items[0].label}`,
              label: (item) => `Drawn ${item.raw} times`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, font: { size: 9 } }
          },
          y: {
            grid: { color: Charts.getColors().grid },
            beginAtZero: true,
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }

  static renderGapChart() {
    const ctx = document.getElementById('chart-gaps');
    if (!ctx) return;

    const gaps = DataTransformer.buildGapTable(Charts.draws);
    const labels = [];
    const data = [];
    const colors = [];

    // Sort by gap descending
    const sorted = [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

    for (const [num, gap] of sorted) {
      labels.push(`#${num}`);
      data.push(gap);
      colors.push(gap > 15 ? '#EF4444' : gap > 8 ? '#F59E0B' : '#10B981');
    }

    Charts.charts.gaps = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Draws Since Last Appearance',
          data,
          backgroundColor: colors.map(c => c + 'BB'),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.raw} draws overdue`
            }
          }
        },
        scales: {
          x: {
            grid: { color: Charts.getColors().grid },
            beginAtZero: true,
            ticks: { font: { size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10, weight: 'bold' } }
          }
        }
      }
    });
  }

  static renderDistributionChart() {
    const ctx = document.getElementById('chart-distribution');
    if (!ctx) return;

    const freq = DataTransformer.buildFrequencyTable(Charts.draws);

    // Group into ranges
    const ranges = [
      { label: '1-9', color: '#EF4444', sum: 0 },
      { label: '10-19', color: '#F59E0B', sum: 0 },
      { label: '20-29', color: '#10B981', sum: 0 },
      { label: '30-39', color: '#3B82F6', sum: 0 },
      { label: '40-49', color: '#8B5CF6', sum: 0 },
    ];

    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      const rangeIdx = Math.min(4, Math.floor((n - 1) / 10));
      ranges[rangeIdx].sum += freq.get(n) || 0;
    }

    Charts.charts.distribution = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ranges.map(r => r.label),
        datasets: [{
          data: ranges.map(r => r.sum),
          backgroundColor: ranges.map(r => r.color + 'CC'),
          borderColor: ranges.map(r => r.color),
          borderWidth: 2,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 15, usePointStyle: true, font: { size: 11 } }
          }
        }
      }
    });
  }

  static renderYearlyChart() {
    const ctx = document.getElementById('chart-yearly');
    if (!ctx) return;

    const yearCounts = {};
    for (const draw of Charts.draws) {
      const year = draw.date.getFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }

    const years = Object.keys(yearCounts).sort();
    // Show only every 5th year if too many
    const step = years.length > 30 ? 5 : 1;
    const filteredYears = years.filter((_, i) => i % step === 0 || _ === years[years.length - 1]);

    Charts.charts.yearly = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: 'Draws Per Year',
          data: years.map(y => yearCounts[y]),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Year ${items[0].label}`,
              label: (item) => `${item.raw} draws`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              font: { size: 9 },
              callback: function(val, idx) {
                const label = this.getLabelForValue(val);
                return years.length > 30 ? (idx % 5 === 0 ? label : '') : label;
              }
            }
          },
          y: {
            grid: { color: Charts.getColors().grid },
            beginAtZero: true,
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }
}
