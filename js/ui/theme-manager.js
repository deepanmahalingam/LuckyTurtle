export class ThemeManager {
  static init() {
    const saved = localStorage.getItem('lucky-turtle-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => ThemeManager.toggle());
    }
  }

  static toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lucky-turtle-theme', next);
  }

  static get current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
}
