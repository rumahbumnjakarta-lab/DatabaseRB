// ============================================
//   theme.js — Light / Dark Mode Manager
//   Follows system preference by default.
//   Manual override saved to localStorage.
// ============================================

(function () {
  const STORAGE_KEY = 'rb-theme';

  // ─── Get effective theme ───
  function getTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    // Follow system
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ─── Apply theme to <html> ───
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleBtn(theme);
  }

  // ─── Update toggle button icon & tooltip ───
  function updateToggleBtn(theme) {
    const btn     = document.getElementById('themeToggle');
    const tooltip = document.getElementById('themeTooltip');
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title       = isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap';
    if (tooltip) tooltip.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
  }

  // ─── Toggle handler ───
  function toggleTheme() {
    const current = getTheme();
    const next    = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);

    // Ripple micro-animation on button
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.style.transform = 'scale(1.35) rotate(20deg)';
      setTimeout(() => { btn.style.transform = ''; }, 220);
    }
  }

  // ─── Inject toggle button into DOM ───
  function injectToggle() {
    if (document.getElementById('themeToggle')) return;

    const btn = document.createElement('button');
    btn.id          = 'themeToggle';
    btn.className   = 'theme-toggle';
    btn.setAttribute('aria-label', 'Ganti mode warna');
    btn.addEventListener('click', toggleTheme);

    const tooltip = document.createElement('div');
    tooltip.id        = 'themeTooltip';
    tooltip.className = 'theme-toggle-tooltip';

    document.body.appendChild(btn);
    document.body.appendChild(tooltip);

    updateToggleBtn(getTheme());
  }

  // ─── Listen for system preference changes ───
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only follow system if user has no manual override
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // ─── Init: apply theme immediately (before paint) ───
  applyTheme(getTheme());

  // ─── Inject button after DOM ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }
})();
