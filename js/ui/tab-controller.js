export class TabController {
  static init() {
    const nav = document.getElementById('app-nav');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const tab = e.target.closest('.nav-tab');
      if (!tab) return;

      const tabName = tab.dataset.tab;
      TabController.switchTo(tabName);
    });
  }

  static switchTo(tabName) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Update sections
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`section-${tabName}`);
    if (section) section.classList.add('active');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
