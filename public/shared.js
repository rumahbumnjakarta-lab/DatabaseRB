// ============================================
//   shared.js — App Shell + Division Logic v3
//   Odoo-style sidebar + auth guard
// ============================================

// ─── Build Sidebar HTML ───
function buildSidebar(user, activePage) {
  const isStaff = user && user.role === 'staff';
  const roleClass = isStaff ? 'role-staff' : 'role-internship';
  const roleLabel = isStaff ? 'Staff' : 'Internship';
  const initial = (user && user.name) ? user.name.charAt(0).toUpperCase() : '?';

  const navItems = [
    { href: '/index.html', icon: '🏠', label: 'Dashboard', key: 'dashboard' },
    { divider: true, label: 'Absensi' },
    { href: '/absen.html', icon: '📍', label: 'Absen Saya', key: 'absen' },
    { href: '/rekap-absen.html', icon: '📊', label: 'Rekap Absen', key: 'rekap-absen', staffOnly: true },
    { href: '/settings.html', icon: '👤', label: 'Setelan Profil', key: 'settings' },
    { divider: true, label: 'Divisi' },
    { href: '/business-development.html', icon: '📊', label: 'Business Dev', key: 'bd' },
    { href: '/sosmed.html', icon: '📱', label: 'Social Media', key: 'sosmed' },
    { href: '/design.html', icon: '🎨', label: 'Design', key: 'design' },
    { href: '/event.html', icon: '🎪', label: 'Event', key: 'event' },
    { href: '/admin.html', icon: '📋', label: 'Admin', key: 'admin', internOnly: true },
    { href: '/administrasi.html', icon: '📋', label: 'Administrasi', key: 'administrasi', staffOnly: true },
    { divider: true, label: 'Staff Only', staffOnly: true },
    { href: '/email.html', icon: '📧', label: 'Akun Email', key: 'email', staffOnly: true },
    { href: '/manage.html', icon: '⚙', label: 'Kelola Data', key: 'manage', staffOnly: true },
  ];

  let navHTML = '';
  navItems.forEach(item => {
    if (item.divider) {
      if (item.staffOnly && !isStaff) return;
      navHTML += `<div class="sidebar-section-title">${item.label}</div>`;
      return;
    }
    if (item.staffOnly && !isStaff) return;
    if (item.internOnly && isStaff) return;
    const isActive = item.key === activePage ? ' active' : '';
    navHTML += `
      <a href="${item.href}" class="sidebar-link${isActive}">
        <span class="sidebar-icon">${item.icon}</span>
        ${item.label}
      </a>`;
  });

  const avatarHTML = (user && user.avatar) 
    ? `<img src="${user.avatar}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` 
    : initial;

  return `
    <div class="sidebar" id="sidebar">
      <a class="sidebar-brand" href="/index.html">
        <img src="/FOTO/LOGO.png" alt="Logo" onerror="this.style.display='none'">
        <div class="sidebar-brand-text">
          <span class="sidebar-brand-name">Rumah BUMN</span>
          <span class="sidebar-brand-sub">Jakarta · Internal Hub</span>
        </div>
      </a>
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user-info">
          <div class="sidebar-avatar" id="sidebarAvatar">${avatarHTML}</div>
          <div class="sidebar-user-details">
            <div class="sidebar-user-name" id="sidebarName">${user ? (user.name || user.email) : '...'}</div>
            <span class="sidebar-user-role ${roleClass}">${roleLabel}</span>
          </div>
          <button class="sidebar-logout-btn" onclick="doLogout()" title="Keluar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </div><!-- Close sidebar -->
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>


    <!-- Mobile Bottom Navigation Bar -->
    <nav class="mobile-bottom-nav">
      <a href="/index.html" class="mobile-nav-item${activePage === 'dashboard' ? ' active' : ''}">
        <span class="mobile-nav-icon">🏠</span>
        <span>Beranda</span>
      </a>
      <a href="/absen.html" class="mobile-nav-item${activePage === 'absen' ? ' active' : ''}">
        <span class="mobile-nav-icon">📍</span>
        <span>Absen</span>
      </a>
      ${isStaff ? `
      <a href="/rekap-absen.html" class="mobile-nav-item${activePage === 'rekap-absen' ? ' active' : ''}">
        <span class="mobile-nav-icon">📊</span>
        <span>Rekap</span>
      </a>` : `
      <a href="/admin.html" class="mobile-nav-item${activePage === 'admin' ? ' active' : ''}">
        <span class="mobile-nav-icon">📋</span>
        <span>Admin</span>
      </a>`}
      <button class="mobile-nav-item" onclick="toggleSidebar()">
        <span class="mobile-nav-icon">☰</span>
        <span>Menu</span>
      </button>
    </nav>
  `;
}

// ─── Build Topbar HTML ───
function buildTopbar(title, subtitle) {
  return `
    <div class="app-topbar">
      <button class="sidebar-toggle" onclick="toggleSidebar()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="topbar-title">
        ${title}
        ${subtitle ? `<small>${subtitle}</small>` : ''}
      </div>
    </div>
  `;
}

// ─── Toggle sidebar on mobile ───
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

// ─── Logout ───
function doLogout() {
  window.location.href = '/auth/logout';
}

// ─── Auth guard + render shell ───
// activePage: dashboard, bd, sosmed, design, event, admin, email, manage
function initAppShell(activePage, onSuccess, staffOnly) {
  // Create loading screen if not exists
  if (!document.getElementById('authLoading')) {
    const loader = document.createElement('div');
    loader.id = 'authLoading';
    loader.innerHTML = `
      <div style="text-align:center;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted);font-family:Inter,sans-serif;font-size:13px;">Memeriksa akses...</p>
      </div>
    `;
    document.body.prepend(loader);
  }

  fetch('/api/me')
    .then(r => r.json())
    .then(user => {
      if (!user.loggedIn) { window.location.href = '/login.html'; return; }
      if (staffOnly && user.role !== 'staff') { window.location.href = '/index.html?error=forbidden'; return; }

      // Inject sidebar
      const sidebarContainer = document.getElementById('sidebarContainer');
      if (sidebarContainer) {
        sidebarContainer.innerHTML = buildSidebar(user, activePage);
      }

      // Hide loading
      const loading = document.getElementById('authLoading');
      if (loading) loading.style.display = 'none';

      // Show content
      const content = document.getElementById('appContent');
      if (content) content.style.display = 'block';

      // Run page-specific callback
      if (onSuccess) onSuccess(user);
    })
    .catch(() => { window.location.href = '/login.html'; });
}

// ─── SVG Icons ───
function iconSvg(name) {
  const icons = {
    open: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`,
    copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    eye:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  };
  return icons[name] || '';
}

// ─── Copy to clipboard ───
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✓ Tersalin';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 1600);
  }).catch(() => {});
}

// ─── Animate number ───
function animateCount(el, target) {
  if (!el) return;
  let start = 0;
  const step = Math.ceil(target / 20) || 1;
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, 30);
}

// ─── Main division page init function ───
function initDivisionPage(items) {
  const grid        = document.getElementById('grid');
  const chipRow     = document.getElementById('chipRow');
  const searchInput = document.getElementById('searchInput');
  const emptyState  = document.getElementById('emptyState');
  const statTotal   = document.getElementById('stat-total');
  const statCat     = document.getElementById('stat-cat');

  if (!grid || !searchInput) return;

  const categories = ['Semua', ...new Set(items.map(i => i.cat))];
  let activeCat = 'Semua';

  if (statTotal) animateCount(statTotal, items.length);
  if (statCat)   animateCount(statCat, categories.length - 1);

  function renderChips() {
    if (!chipRow) return;
    chipRow.innerHTML = '';
    categories.forEach(cat => {
      const el = document.createElement('div');
      el.className = 'chip' + (cat === activeCat ? ' active' : '');
      el.textContent = cat;
      el.addEventListener('click', () => { activeCat = cat; renderChips(); renderGrid(); });
      chipRow.appendChild(el);
    });
  }

  function renderGrid() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = items.filter(i => {
      const matchesCat = activeCat === 'Semua' || i.cat === activeCat;
      const hay = [i.title, i.cat, i.note || '', i.email || '', i.url || ''].join(' ').toLowerCase();
      return matchesCat && hay.includes(q);
    });

    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = filtered.length ? 'none' : 'flex';

    filtered.forEach((item, idx) => {
      const card = buildCard(item, idx);
      card.style.animationDelay = `${idx * 0.04}s`;
      card.style.animation = 'cardAppear 0.4s ease both';
      grid.appendChild(card);
      attachCardEvents(card, item, idx);
    });
  }

  function buildCard(item, idx) {
    const card = document.createElement('div');
    card.className = 'card' + (item.type === 'cred' ? ' credential' : '');
    if (item.type === 'link') {
      card.innerHTML = `
        <div class="card-top">
          <h3>${escHtml(item.title)}</h3>
          <span class="cat-tag">${escHtml(item.cat)}</span>
        </div>
        ${item.note ? `<p class="note">${escHtml(item.note)}</p>` : ''}
        <div class="card-actions">
          <a class="btn btn-open" href="${escHtml(item.url)}" target="_blank" rel="noopener noreferrer">
            ${iconSvg('open')} Buka Link
          </a>
          <button class="btn btn-copy" data-copy="${escHtml(item.url)}">
            ${iconSvg('copy')} Salin
          </button>
        </div>`;
    } else {
      const rowId = `cred-${idx}`;
      card.innerHTML = `
        <div class="card-top">
          <h3>${escHtml(item.title)}</h3>
          <span class="cat-tag">${escHtml(item.cat)}</span>
        </div>
        ${item.note ? `<p class="note">${escHtml(item.note)}</p>` : ''}
        <div class="cred-row">
          <span class="cred-label">Email</span>
          <span class="val">${escHtml(item.email)}</span>
          <button class="btn btn-copy" data-copy="${escHtml(item.email)}" title="Salin Email">${iconSvg('copy')}</button>
        </div>
        <div class="cred-row">
          <span class="cred-label">Sandi</span>
          <span class="val masked" id="${rowId}">••••••••••</span>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-copy" id="toggle-${rowId}" title="Tampilkan/Sembunyikan">${iconSvg('eye')}</button>
            <button class="btn btn-copy" data-copy="${escHtml(item.pass)}" title="Salin Sandi">${iconSvg('copy')}</button>
          </div>
        </div>
        <div class="warn-tag">⚠ Jaga kerahasiaan kredensial ini</div>`;
    }
    return card;
  }

  function attachCardEvents(card, item, idx) {
    card.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); copyToClipboard(btn.getAttribute('data-copy'), btn); });
    });
    if (item.type === 'cred') {
      const rowId  = `cred-${idx}`;
      const span   = card.querySelector(`#${rowId}`);
      const toggle = card.querySelector(`#toggle-${rowId}`);
      let revealed = false;
      if (toggle && span) {
        toggle.addEventListener('click', () => {
          revealed = !revealed;
          span.textContent = revealed ? item.pass : '••••••••••';
          span.classList.toggle('masked', !revealed);
          toggle.innerHTML = revealed ? iconSvg('eyeOff') : iconSvg('eye');
        });
      }
    }
  }

  // Inject animation style
  if (!document.getElementById('shared-anim-style')) {
    const style = document.createElement('style');
    style.id = 'shared-anim-style';
    style.textContent = `@keyframes cardAppear { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }`;
    document.head.appendChild(style);
  }

  searchInput.addEventListener('input', renderGrid);
  renderChips();
  renderGrid();
}

// ─── HTML escape ───
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
