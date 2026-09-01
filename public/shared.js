// ============================================
//   shared.js — App Shell + Division Logic v3
//   Odoo-style sidebar + auth guard
// ============================================

// ─── Pages the topbar search can jump to (mirrors the sidebar + Kelola popup) ───
const SEARCH_PAGES = [
  { href: '/index.html', icon: 'layout-dashboard', label: 'Dashboard' },
  { href: '/chat.html', icon: 'message-circle', label: 'Chat' },
  { href: '/agenda-hub.html', icon: 'calendar-days', label: 'Silabus' },
  { href: '/absen.html', icon: 'map-pin', label: 'Absen Saya' },
  { href: '/perizinan.html', icon: 'file-check-2', label: 'Izin & Sakit' },
  { href: '/business-development.html', icon: 'trending-up', label: 'Business Dev' },
  { href: '/sosmed.html', icon: 'share-2', label: 'Social Media' },
  { href: '/design.html', icon: 'palette', label: 'Design' },
  { href: '/event-hub.html', icon: 'calendar', label: 'Event Hub' },
  { href: '/admin.html', icon: 'file-text', label: 'Admin' },
  { href: '/manage.html', icon: 'database', label: 'Kelola Data' },
  { href: '/administrasi.html', icon: 'shield-check', label: 'Administrasi', staffOnly: true },
  { href: '/email.html', icon: 'mail', label: 'Akun Email', staffOnly: true },
  { href: '/manage-users.html', icon: 'users', label: 'Kelola Akun', staffOnly: true },
  { href: '/rekap-absen.html', icon: 'bar-chart-3', label: 'Rekap Absensi', staffOnly: true },
];

// Which page shows a given data item, by items.division value.
const SEARCH_ITEM_PAGE = {
  bd: { href: '/business-development.html', label: 'Business Dev' },
  sosmed: { href: '/sosmed.html', label: 'Social Media' },
  design: { href: '/design.html', label: 'Design' },
  event: { href: '/event.html', label: 'Event' },
  admin: { href: '/admin.html', label: 'Admin' },
  administrasi: { href: '/administrasi.html', label: 'Administrasi' },
  email: { href: '/email.html', label: 'Akun Email' },
};

// ─── Build Sidebar HTML ───
function buildSidebar(user, activePage) {
  const isStaff = user && user.role === 'staff';
  const roleClass = isStaff ? 'role-staff' : 'role-internship';
  const roleLabel = isStaff ? 'Staff' : 'Internship';
  const initial = (user && user.name) ? user.name.charAt(0).toUpperCase() : '?';

  const navItems = [
    { href: '/index.html', icon: 'layout-dashboard', label: 'Dashboard', key: 'dashboard' },
    { href: '/chat.html', icon: 'message-circle', label: 'Chat', key: 'chat' },
    { divider: true, label: 'Silabus' },
    { href: '/agenda-hub.html', icon: 'calendar-days', label: 'Silabus', key: 'agenda' },
    { divider: true, label: 'Absensi' },
    { href: '/absen.html', icon: 'map-pin', label: 'Absen Saya', key: 'absen' },
    { href: '/perizinan.html', icon: 'file-check-2', label: 'Izin & Sakit', key: 'perizinan' },
    { divider: true, label: 'Divisi' },
    { href: '/business-development.html', icon: 'trending-up', label: 'Business Dev', key: 'bd' },
    { href: '/sosmed.html', icon: 'share-2', label: 'Social Media', key: 'sosmed' },
    { href: '/design.html', icon: 'palette', label: 'Design', key: 'design' },
    { href: '/event-hub.html', icon: 'calendar', label: 'Event Hub', key: 'event' },
    { href: '/admin.html', icon: 'file-text', label: 'Admin', key: 'admin' },
    { divider: true, label: 'Staff Only', staffOnly: true },
    { href: '/administrasi.html', icon: 'shield-check', label: 'Administrasi', key: 'administrasi', staffOnly: true },
    { href: '/email.html', icon: 'mail', label: 'Akun Email', key: 'email', staffOnly: true },
    { href: isStaff ? '#' : '/manage.html', icon: 'settings', label: 'Kelola', key: 'manage', onclick: isStaff ? 'openManagePopup(event)' : null },
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
    const isActive = (item.key === activePage || (item.key === 'manage' && (activePage === 'manage' || activePage === 'manage-users' || activePage === 'rekap-absen'))) ? ' active' : '';
    const onclickAttr = item.onclick ? `onclick="${item.onclick}"` : '';
    // The Chat link gets an empty badge placeholder — the global unread
    // poller (see initChatNotifier below) fills it in after the sidebar
    // itself has already been rendered.
    const badgeHTML = item.key === 'chat'
      ? `<span class="sidebar-link-badge" id="sidebarChatBadge" style="display:none;"></span>` : '';
    navHTML += `
      <a href="${item.href}" ${onclickAttr} class="sidebar-link${isActive}" title="${item.label}">
        <span class="sidebar-icon"><i data-lucide="${item.icon}" style="width:17px;height:17px;"></i></span>
        <span class="sidebar-link-label">${item.label}</span>
        ${badgeHTML}
      </a>`;
  });

  const avatarHTML = (user && user.avatar)
    ? `<img src="${user.avatar}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
    : initial;

  return `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <a class="sidebar-brand" href="/index.html">
          <img src="/FOTO/LOGO.png" alt="Logo" onerror="this.style.display='none'">
          <div class="sidebar-brand-text">
            <span class="sidebar-brand-name">Rumah BUMN</span>
            <span class="sidebar-brand-sub">Jakarta · Internal Hub</span>
          </div>
        </a>
        <button class="sidebar-collapse-btn" onclick="toggleSidebarCollapse()" title="Ciutkan sidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-help-card">
          <div class="shc-icon"><i data-lucide="life-buoy" style="width:15px;height:15px;"></i></div>
          <h5>Butuh Bantuan?</h5>
          <p>Lihat panduan atau hubungi admin untuk bantuan.</p>
          <button onclick="showHelpInfo()">Pusat Bantuan <i data-lucide="arrow-right" style="width:12px;height:12px;"></i></button>
        </div>
      </div>
    </div><!-- Close sidebar -->
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>


    <!-- Mobile Bottom Navigation Bar -->
    <nav class="mobile-bottom-nav">
      <a href="/index.html" class="mobile-nav-item${activePage === 'dashboard' ? ' active' : ''}">
        <span class="mobile-nav-icon"><i data-lucide="layout-dashboard" style="width:20px;height:20px;"></i></span>
        <span>Beranda</span>
      </a>
      <a href="/absen.html" class="mobile-nav-item${activePage === 'absen' ? ' active' : ''}">
        <span class="mobile-nav-icon"><i data-lucide="map-pin" style="width:20px;height:20px;"></i></span>
        <span>Absen</span>
      </a>
      ${isStaff ? `
      <a href="/rekap-absen.html" class="mobile-nav-item${activePage === 'rekap-absen' ? ' active' : ''}">
        <span class="mobile-nav-icon"><i data-lucide="bar-chart-3" style="width:20px;height:20px;"></i></span>
        <span>Rekap</span>
      </a>` : `
      <a href="/admin.html" class="mobile-nav-item${activePage === 'admin' ? ' active' : ''}">
        <span class="mobile-nav-icon"><i data-lucide="file-text" style="width:20px;height:20px;"></i></span>
        <span>Admin</span>
      </a>`}
      <button class="mobile-nav-item" onclick="toggleSidebar()">
        <span class="mobile-nav-icon"><i data-lucide="menu" style="width:20px;height:20px;"></i></span>
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
        <i data-lucide="menu" style="width:20px;height:20px;"></i>
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

// ─── Sidebar collapse (desktop icon-rail) — persisted across page loads ───
function applySidebarCollapsePref() {
  const collapsed = localStorage.getItem('sidebar_collapsed') === '1';
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
}
function toggleSidebarCollapse() {
  const collapsed = !document.getElementById('sidebar').classList.contains('collapsed');
  localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
}

// ─── Sidebar "Butuh Bantuan?" card ───
function showHelpInfo() {
  if (window.Swal) {
    Swal.fire({
      icon: 'info',
      title: 'Pusat Bantuan',
      html: 'Untuk kendala teknis atau pertanyaan seputar sistem, silakan hubungi <b>Admin Rumah BUMN Jakarta</b> melalui divisi Administrasi atau email operasional internal.',
      confirmButtonColor: '#155eef',
      confirmButtonText: 'Mengerti'
    });
  } else {
    alert('Untuk kendala teknis, silakan hubungi Admin Rumah BUMN Jakarta.');
  }
}

// ─── Topbar right-side controls: search, notifications, profile menu ───
// Injected into whatever ".app-topbar" already exists on the page (whether
// built via buildTopbar() or hardcoded per-page), so every page gets the
// same controls without needing per-page HTML changes.
function buildTopbarActionsHTML(user) {
  const isStaff = user && user.role === 'staff';
  const roleLabel = isStaff ? 'Staff' : 'Internship';
  const initial = (user && user.name) ? user.name.charAt(0).toUpperCase() : '?';
  const avatarHTML = (user && user.avatar)
    ? `<img src="${user.avatar}" alt="">`
    : initial;
  const displayName = user ? (user.name || user.email) : '...';

  return `
    <button class="topbar-search-mobile-btn" id="topbarSearchMobileBtn" onclick="toggleMobileSearch()" title="Cari">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </button>
    <div class="topbar-search" id="topbarSearchWrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="topbarSearchInput" placeholder="Cari menu, data, atau agenda..." autocomplete="off">
      <kbd>⌘K</kbd>
      <button class="topbar-search-mobile-close" id="topbarSearchMobileClose" onclick="toggleMobileSearch()" title="Tutup">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="topbar-search-results" id="topbarSearchResults"></div>
    </div>
    <button class="topbar-notif-btn" id="topbarNotifBtn" onclick="toggleTopbarNotif(event)" title="Notifikasi">
      <i data-lucide="bell" style="width:18px;height:18px;"></i>
      <span class="topbar-notif-dot" id="topbarNotifDot" style="display:none;">0</span>
      <div class="topbar-dropdown topbar-notif-dropdown" id="topbarNotifDropdown">
        <div class="topbar-dropdown-header"><span class="name">Notifikasi</span></div>
        <div id="topbarNotifList">
          <div class="topbar-notif-empty">
            <i data-lucide="bell-off" style="width:26px;height:26px;"></i><br>
            Tidak ada notifikasi baru.
          </div>
        </div>
      </div>
    </button>
    <div class="topbar-profile" id="topbarProfile">
      <button class="topbar-profile-trigger" onclick="toggleTopbarProfile(event)">
        <div class="topbar-profile-avatar" id="topbarProfileAvatar">${avatarHTML}</div>
        <div class="topbar-profile-text">
          <div class="topbar-profile-name">${escHtml(displayName)}</div>
          <div class="topbar-profile-role">${roleLabel === 'Staff' ? 'Administrator' : 'Internship'}</div>
        </div>
        <svg class="topbar-profile-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="topbar-dropdown" id="topbarProfileDropdown">
        <div class="topbar-dropdown-header">
          <div class="name">${escHtml(displayName)}</div>
          <div class="email">${escHtml(user ? user.email : '')}</div>
        </div>
        <button class="topbar-dropdown-item" onclick="closeTopbarDropdowns(); openProfileDrawer();">
          <i data-lucide="user-cog" style="width:16px;height:16px;"></i> Edit Profil
        </button>
        <button class="topbar-dropdown-item danger" onclick="doLogout();">
          <i data-lucide="log-out" style="width:16px;height:16px;"></i> Keluar
        </button>
      </div>
    </div>
  `;
}

function injectTopbarActions(user) {
  const topbar = document.querySelector('.app-topbar');
  if (!topbar || document.getElementById('topbarProfile')) return;
  const wrap = document.createElement('div');
  wrap.className = 'topbar-actions';
  wrap.innerHTML = buildTopbarActionsHTML(user);
  topbar.appendChild(wrap);

  initTopbarSearch(user);
  initChatNotifier(user);

  // Cmd/Ctrl+K focuses search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('topbarSearchInput');
      if (input) input.focus();
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-profile')) {
      const d = document.getElementById('topbarProfileDropdown');
      const p = document.getElementById('topbarProfile');
      if (d) d.classList.remove('open');
      if (p) p.classList.remove('open');
    }
    if (!e.target.closest('#topbarNotifBtn')) {
      const nd = document.getElementById('topbarNotifDropdown');
      if (nd) nd.classList.remove('open');
    }
    if (!e.target.closest('.topbar-search')) {
      const rd = document.getElementById('topbarSearchResults');
      if (rd) rd.classList.remove('open');
    }
  });
}

// ─── Topbar global search: menu pages + database items + upcoming agenda ───
// Data & agenda results are fetched once per page load and cached — typing
// re-filters in memory instead of re-querying on every keystroke.
let _searchDataCache = null;   // Promise<items[]>
let _searchAgendaCache = null; // Promise<events[]>
let _searchResultsFlat = [];   // last rendered results, for Enter-to-open

// Di layar sempit (<480px) .topbar-search disembunyikan lewat CSS dan diganti
// tombol ikon ini — tap untuk buka overlay full-width, tap X/tombol lagi untuk tutup.
function toggleMobileSearch() {
  const wrap = document.getElementById('topbarSearchWrap');
  const input = document.getElementById('topbarSearchInput');
  if (!wrap) return;
  const isOpen = wrap.classList.toggle('mobile-open');
  if (isOpen) {
    setTimeout(() => { if (input) input.focus(); }, 60);
  } else {
    if (input) input.value = '';
    const box = document.getElementById('topbarSearchResults');
    if (box) { box.classList.remove('open'); box.innerHTML = ''; }
  }
}

function initTopbarSearch(user) {
  const input = document.getElementById('topbarSearchInput');
  const box = document.getElementById('topbarSearchResults');
  if (!input || !box) return;

  const isStaff = user && user.role === 'staff';
  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
    debounceTimer = setTimeout(() => runTopbarSearch(q, isStaff), 150);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim() && box.innerHTML) box.classList.add('open');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.classList.remove('open'); input.blur(); }
    if (e.key === 'Enter' && _searchResultsFlat[0]) {
      e.preventDefault();
      navigateFromSearch(_searchResultsFlat[0].href);
    }
  });
}

function runTopbarSearch(query, isStaff) {
  const box = document.getElementById('topbarSearchResults');
  if (!box) return;
  box.classList.add('open');
  box.innerHTML = `<div class="tsr-loading">Mencari...</div>`;

  if (!_searchDataCache) {
    _searchDataCache = fetch('/api/items').then(r => r.json()).catch(() => []);
  }
  if (!_searchAgendaCache) {
    _searchAgendaCache = fetch('/api/events/upcoming').then(r => r.json()).catch(() => []);
  }

  Promise.all([_searchDataCache, _searchAgendaCache]).then(([items, agenda]) => {
    // A stale response for an already-replaced query shouldn't clobber newer results.
    const input = document.getElementById('topbarSearchInput');
    if (!input || input.value.trim() !== query) return;

    const q = query.toLowerCase();

    const menuResults = SEARCH_PAGES
      .filter(p => (!p.staffOnly || isStaff) && p.label.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ type: 'menu', icon: p.icon, title: p.label, sub: 'Buka halaman', href: p.href }));

    const dataResults = (Array.isArray(items) ? items : [])
      .filter(i => [i.title, i.cat, i.note].filter(Boolean).join(' ').toLowerCase().includes(q))
      .slice(0, 6)
      .map(i => {
        const page = SEARCH_ITEM_PAGE[i.division] || {};
        return {
          type: 'data',
          icon: i.type === 'cred' ? 'key-round' : 'link',
          title: i.title,
          sub: [page.label, i.cat].filter(Boolean).join(' · '),
          href: page.href || '#'
        };
      });

    const agendaResults = (Array.isArray(agenda) ? agenda : [])
      .filter(ev => [ev.title, ev.category, ev.location].filter(Boolean).join(' ').toLowerCase().includes(q))
      .slice(0, 6)
      .map(ev => ({
        type: 'agenda',
        icon: 'calendar-days',
        title: ev.title,
        sub: [formatSearchDate(ev.event_date), ev.category].filter(Boolean).join(' · '),
        href: '/agenda-hub.html'
      }));

    renderTopbarSearchResults(menuResults, dataResults, agendaResults);
  });
}

function formatSearchDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) { return dateStr; }
}

function renderTopbarSearchResults(menuResults, dataResults, agendaResults) {
  const box = document.getElementById('topbarSearchResults');
  if (!box) return;

  _searchResultsFlat = [...menuResults, ...dataResults, ...agendaResults];

  if (!_searchResultsFlat.length) {
    box.innerHTML = `
      <div class="tsr-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><br>
        Tidak ada hasil ditemukan.
      </div>`;
    return;
  }

  const group = (label, items) => {
    if (!items.length) return '';
    return `<div class="tsr-group-label">${label}</div>` + items.map(r => `
      <a class="tsr-item" href="${r.href}" onclick="return handleSearchResultClick(event, '${r.href}')">
        <div class="tsr-item-icon"><i data-lucide="${r.icon}" style="width:15px;height:15px;"></i></div>
        <div class="tsr-item-text">
          <div class="tsr-item-title">${escHtml(r.title)}</div>
          <div class="tsr-item-sub">${escHtml(r.sub)}</div>
        </div>
      </a>`).join('');
  };

  box.innerHTML =
    group('Menu', menuResults) +
    group('Data', dataResults) +
    group('Silabus', agendaResults);

  renderIcons();
}

function handleSearchResultClick(e, href) {
  e.preventDefault();
  navigateFromSearch(href);
  return false;
}

function navigateFromSearch(href) {
  if (href && href !== '#') window.location.href = href;
}

// ─── Chat: notifikasi lintas-halaman (toast + suara + badge sidebar) ───
// chat.html sudah polling ruangnya sendiri setiap 4 detik dan menampilkan
// semuanya langsung di layar, jadi poller ini SENGAJA tidak jalan di sana —
// cukup di halaman lain, supaya orang tetap tahu ada pesan masuk walau
// sedang buka Absensi/Agenda/dsb.
const CHAT_NOTIF_INTERVAL = 12000;
const CHAT_NOTIF_WATERMARK_KEY = 'rb_chat_notif_watermark';
let _chatNotifTimer = null;

// ─── Web Push: notifikasi chat tetap muncul walau tab/web sedang tidak dibuka ───
const PUSH_BANNER_DISMISSED_KEY = 'rb_push_banner_dismissed';

async function initPushNotifications(user) {
  if (!user || !user.loggedIn) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    if (Notification.permission === 'granted') {
      await subscribeToPush(reg);
    } else if (Notification.permission === 'default' && !localStorage.getItem(PUSH_BANNER_DISMISSED_KEY)) {
      showPushPermissionBanner(reg);
    }
    // permission === 'denied' → tidak bisa apa-apa lagi, biarkan (user harus ubah manual di setelan browser)
  } catch (e) {
    console.warn('Push init gagal:', e.message);
  }
}

async function subscribeToPush(reg) {
  try {
    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;

    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
  } catch (e) {
    console.warn('Push subscribe gagal:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function showPushPermissionBanner(reg) {
  if (document.getElementById('pushPermBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'pushPermBanner';
  banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:420px;margin:0 auto;background:var(--bg-card,#fff);border:1px solid var(--border-mid,#dde3ee);border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,0.16);padding:14px 16px;z-index:2000;display:flex;align-items:center;gap:12px;font-family:"Inter",sans-serif;';
  banner.innerHTML = `
    <div style="width:38px;height:38px;border-radius:11px;background:rgba(48,127,226,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <i data-lucide="bell-ring" style="width:18px;height:18px;color:var(--blue-mid,#307fe2);"></i>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:12.5px;font-weight:700;color:var(--text-primary,#0f172a);">Aktifkan notifikasi chat</div>
      <div style="font-size:11.5px;color:var(--text-muted,#64748b);margin-top:1px;">Biar nggak ketinggalan pesan meski web-nya tidak dibuka.</div>
    </div>
    <button id="pushBannerDismiss" style="border:none;background:none;color:var(--text-muted,#64748b);cursor:pointer;padding:6px;flex-shrink:0;font-size:12px;">Nanti</button>
    <button id="pushBannerEnable" style="border:none;background:var(--blue-mid,#307fe2);color:#fff;font-weight:700;font-size:12px;padding:9px 14px;border-radius:9px;cursor:pointer;flex-shrink:0;">Aktifkan</button>
  `;
  document.body.appendChild(banner);
  if (typeof renderIcons === 'function') renderIcons();

  document.getElementById('pushBannerDismiss').onclick = () => {
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1');
    banner.remove();
  };
  document.getElementById('pushBannerEnable').onclick = async () => {
    banner.remove();
    const perm = await Notification.requestPermission();
    if (perm === 'granted') await subscribeToPush(reg);
    else localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1');
  };
}

function initChatNotifier(user) {
  if (!user || !user.loggedIn) return;
  if (/\/chat\.html$/.test(window.location.pathname)) return; // chat.html punya pollingnya sendiri
  if (_chatNotifTimer) return; // sudah jalan (mis. dua kali initAppShell)

  pollChatNotifications();
  _chatNotifTimer = setInterval(pollChatNotifications, CHAT_NOTIF_INTERVAL);
}

function pollChatNotifications() {
  fetch('/api/chat/rooms')
    .then(r => r.json())
    .then(rooms => {
      if (!Array.isArray(rooms)) return;

      const totalUnread = rooms.reduce((sum, r) => sum + (r.unread || 0), 0);
      updateSidebarChatBadge(totalUnread);
      updateTopbarNotifications(rooms);

      let watermark = localStorage.getItem(CHAT_NOTIF_WATERMARK_KEY);
      if (!watermark) {
        // Baru pertama kali berjalan di browser ini — jangan banjiri toast
        // untuk riwayat pesan yang sudah lama menumpuk sebelum fitur ini ada.
        localStorage.setItem(CHAT_NOTIF_WATERMARK_KEY, new Date().toISOString());
        return;
      }

      const fresh = rooms
        .filter(r => r.last_at && new Date(r.last_at) > new Date(watermark) && r.unread > 0)
        .sort((a, b) => new Date(a.last_at) - new Date(b.last_at));

      if (fresh.length) {
        fresh.slice(-3).forEach(r => showChatNotifToast(r));
        playChatNotifSound();
        const newest = fresh[fresh.length - 1].last_at;
        localStorage.setItem(CHAT_NOTIF_WATERMARK_KEY, newest);
      }
    })
    .catch(() => {});
}

function updateSidebarChatBadge(count) {
  const badge = document.getElementById('sidebarChatBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// Mengisi icon lonceng topbar dengan pesan chat yang belum dibaca — dipanggil
// dari poller lintas-halaman (di sini) dan dari chat.html sendiri (loadRooms),
// supaya bell selalu menampilkan data terbaru di halaman manapun.
function updateTopbarNotifications(rooms) {
  const dot = document.getElementById('topbarNotifDot');
  const list = document.getElementById('topbarNotifList');
  if (!dot || !list) return;

  const unreadRooms = (Array.isArray(rooms) ? rooms : [])
    .filter(r => r.unread > 0)
    .sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));

  const total = unreadRooms.reduce((sum, r) => sum + r.unread, 0);
  if (total > 0) {
    dot.textContent = total > 99 ? '99+' : String(total);
    dot.style.display = 'flex';
  } else {
    dot.style.display = 'none';
  }

  if (!unreadRooms.length) {
    list.innerHTML = `
      <div class="topbar-notif-empty">
        <i data-lucide="bell-off" style="width:26px;height:26px;"></i><br>
        Tidak ada notifikasi baru.
      </div>`;
    return;
  }

  list.innerHTML = unreadRooms.slice(0, 8).map(r => {
    const preview = escHtml((r.last_body || '').slice(0, 60));
    const title = r.type === 'dm' ? r.label : [r.label, r.last_sender].filter(Boolean).join(' · ');
    return `
      <a class="topbar-dropdown-item" href="/chat.html?room=${encodeURIComponent(r.id)}" style="align-items:flex-start;text-decoration:none;">
        <i data-lucide="message-circle" style="width:16px;height:16px;margin-top:2px;flex-shrink:0;color:var(--blue-mid);"></i>
        <div style="min-width:0;flex:1;">
          <div style="font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(title)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${preview}</div>
        </div>
        <span style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:10px;font-weight:700;border-radius:50%;min-width:16px;height:16px;padding:0 3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${r.unread > 9 ? '9+' : r.unread}</span>
      </a>`;
  }).join('');
  renderIcons();
}

function showChatNotifToast(room) {
  if (!window.Swal) return;
  const preview = (room.last_body || '').slice(0, 80);
  Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
    icon: 'info',
    title: room.type === 'dm' ? room.label : `${room.label} · ${room.last_sender || ''}`,
    text: preview,
    didOpen: (el) => { el.style.cursor = 'pointer'; el.onclick = () => { window.location.href = '/chat.html'; }; }
  });
}

// Dua nada pendek lewat Web Audio API — tidak perlu file audio eksternal.
// Dipakai baik oleh notifier lintas-halaman ini maupun oleh chat.html sendiri
// saat pesan baru masuk ke ruang yang sedang dibuka.
function playChatNotifSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1108].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
    setTimeout(() => ctx.close(), 500);
  } catch (e) { /* Audio tidak tersedia — abaikan, jangan sampai memutus fitur lain. */ }
}

function toggleTopbarProfile(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('topbarProfileDropdown');
  const wrap = document.getElementById('topbarProfile');
  const notif = document.getElementById('topbarNotifDropdown');
  if (notif) notif.classList.remove('open');
  dropdown.classList.toggle('open');
  wrap.classList.toggle('open');
}
function toggleTopbarNotif(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('topbarNotifDropdown');
  const profileDropdown = document.getElementById('topbarProfileDropdown');
  const profileWrap = document.getElementById('topbarProfile');
  if (profileDropdown) profileDropdown.classList.remove('open');
  if (profileWrap) profileWrap.classList.remove('open');
  dropdown.classList.toggle('open');
}
function closeTopbarDropdowns() {
  const d = document.getElementById('topbarProfileDropdown');
  const p = document.getElementById('topbarProfile');
  if (d) d.classList.remove('open');
  if (p) p.classList.remove('open');
}

// ─── Frontend Idle Logout Timer (10 Mins) ───
let idleTimeout = null;
const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes

function resetIdleTimer() {
  if (idleTimeout) clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    // Session expired due to inactivity — matikan juga sesi cookie di
    // server (bukan cuma pindah halaman). Sebelumnya cuma redirect, jadi
    // sesinya di server masih hidup — di komputer bersama, tekan Back atau
    // reload index.html sesudah layar "sesi habis" ini tetap bisa balik
    // masuk begitu saja.
    fetch('/auth/logout').finally(() => {
      window.location.href = '/login.html?error=session_expired';
    });
  }, IDLE_LIMIT);
}

// Attach idle listeners globally
['click', 'touchstart', 'scroll', 'keypress', 'mousemove'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});
resetIdleTimer();

// ─── Logout ───
function doLogout() {
  window.location.href = '/auth/logout';
}

// ─── Ensure Libraries (Lucide, AOS, SweetAlert2, GSAP) are loaded ───
function ensureVendorLibraries(callback) {
  let loadedCount = 0;
  const total = 4;

  function checkDone() {
    loadedCount++;
    if (loadedCount >= total && callback) callback();
  }

  // 1. Lucide
  if (window.lucide) { checkDone(); } else {
    const s = document.createElement('script'); s.src = '/vendor/lucide/lucide.js';
    s.onload = checkDone;
    s.onerror = () => { const cdn = document.createElement('script'); cdn.src = 'https://unpkg.com/lucide@latest'; cdn.onload = checkDone; document.head.appendChild(cdn); };
    document.head.appendChild(s);
  }

  // 2. AOS CSS & JS
  if (!document.getElementById('aos-css')) {
    const css = document.createElement('link'); css.id = 'aos-css'; css.rel = 'stylesheet'; css.href = '/vendor/aos/aos.css';
    css.onerror = () => { css.href = 'https://unpkg.com/aos@2.3.1/dist/aos.css'; };
    document.head.appendChild(css);
  }
  if (window.AOS) { checkDone(); } else {
    const s = document.createElement('script'); s.src = '/vendor/aos/aos.js';
    s.onload = () => { if (window.AOS) window.AOS.init({ duration: 600, once: true }); checkDone(); };
    s.onerror = () => { const cdn = document.createElement('script'); cdn.src = 'https://unpkg.com/aos@2.3.1/dist/aos.js'; cdn.onload = () => { if (window.AOS) window.AOS.init({ duration: 600, once: true }); checkDone(); }; document.head.appendChild(cdn); };
    document.head.appendChild(s);
  }

  // 3. SweetAlert2
  if (window.Swal) { checkDone(); } else {
    const s = document.createElement('script'); s.src = '/vendor/sweetalert2/sweetalert2.all.min.js';
    s.onload = checkDone;
    s.onerror = () => { const cdn = document.createElement('script'); cdn.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11'; cdn.onload = checkDone; document.head.appendChild(cdn); };
    document.head.appendChild(s);
  }

  // 4. GSAP
  if (window.gsap) { checkDone(); } else {
    const s = document.createElement('script'); s.src = '/vendor/gsap/gsap.min.js';
    s.onload = checkDone;
    s.onerror = () => { const cdn = document.createElement('script'); cdn.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'; cdn.onload = checkDone; document.head.appendChild(cdn); };
    document.head.appendChild(s);
  }
}

function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  if (window.AOS && typeof window.AOS.refresh === 'function') {
    window.AOS.refresh();
  }
}

// ─── SweetAlert2 Helpers ───
function showSwalToast(msg, icon = 'success') {
  if (window.Swal) {
    Swal.fire({
      toast: true,
      position: 'bottom-end',
      icon: icon,
      title: msg,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      background: '#0f172a',
      color: '#fff'
    });
  } else {
    alert(msg);
  }
}

function showSwalConfirm(title, text, confirmButtonText, onConfirm) {
  if (window.Swal) {
    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#155eef',
      cancelButtonColor: '#dc2626',
      confirmButtonText: confirmButtonText,
      cancelButtonText: 'Batal'
    }).then((result) => {
      if (result.isConfirmed) onConfirm();
    });
  } else {
    if (confirm(`${title}\n${text}`)) onConfirm();
  }
}

// ─── Auth guard + render shell ───
window.currentUserCache = null;

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

  // Sesi login sudah pakai session COOKIE biasa (lihat komentar di server.js:
  // maxAge sengaja tidak diset, jadi otomatis hilang saat browser-nya
  // ditutup) — itu sudah cukup buat "logout otomatis kalau browser ditutup".
  // Dulu di sini ada gate tambahan pakai sessionStorage (per-tab) yang
  // niatnya sama, tapi sessionStorage TIDAK ikut ke tab baru (walau origin-
  // nya sama) — jadi tiap kali user buka link di tab baru, gate ini kira
  // belum login, langsung panggil /auth/logout, dan itu mematikan cookie
  // sesi yang DIPAKAI BERSAMA semua tab, bukan cuma tab yang baru dibuka.
  // Hasilnya: buka 1 link di tab baru = semua tab lain ikut ke-logout.

  if (window.currentUserCache) {
    handleAuthSuccess(window.currentUserCache, activePage, onSuccess, staffOnly);
    return;
  }

  fetch('/api/me')
    .then(r => r.json())
    .then(user => {
      window.currentUserCache = user;
      handleAuthSuccess(user, activePage, onSuccess, staffOnly);
    })
    .catch((err) => { 
      console.error('Error in initAppShell:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        showSwalToast('Koneksi ke server terputus sementara.', 'error');
      } else {
        showSwalToast('Terjadi kesalahan pada sistem', 'error');
      }
    });
}

function handleAuthSuccess(user, activePage, onSuccess, staffOnly) {
  if (!user.loggedIn) { window.location.href = '/login.html'; return; }
  if (staffOnly && user.role !== 'staff') { window.location.href = '/index.html?error=forbidden'; return; }

  // Inject sidebar
  const sidebarContainer = document.getElementById('sidebarContainer');
  if (sidebarContainer) {
    sidebarContainer.innerHTML = buildSidebar(user, activePage);
  }

  // Apply saved sidebar collapse preference (before reveal, to avoid a layout flash)
  applySidebarCollapsePref();

  // Inject topbar search / notification / profile controls (works on every
  // page's .app-topbar, whether built via buildTopbar() or hardcoded)
  injectTopbarActions(user);
  initPushNotifications(user);

  // Hide loading
  const loading = document.getElementById('authLoading');
  if (loading) loading.style.display = 'none';

  // Show content
  const content = document.getElementById('appContent');
  if (content) {
    content.style.display = 'block';
  }

  // Inject global manage popup overlay
  if (!document.getElementById('managePopupOverlay')) {
    const style = document.createElement('style');
    style.innerHTML = `
      .manage-popup-overlay {
        position: fixed; inset: 0; background: rgba(10,22,32,0.6); backdrop-filter: blur(4px); z-index: 1600;
        opacity: 0; pointer-events: none; display: flex; align-items: center; justify-content: center;
        transition: opacity 0.3s ease;
      }
      .manage-popup-overlay.open { opacity: 1; pointer-events: auto; }
      .manage-popup-box {
        background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 32px;
        width: 90%; max-width: 520px; text-align: center; box-shadow: 0 20px 48px rgba(15,23,42,0.16);
        transform: translateY(20px); transition: transform 0.3s ease;
      }
      .manage-popup-overlay.open .manage-popup-box { transform: translateY(0); }
      .manage-popup-box h3 { font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
      .manage-popup-box p { color: var(--text-secondary); font-size: 13.5px; margin: 0 0 24px; }
      .manage-popup-options { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
      .manage-popup-card {
        display: flex; align-items: center; gap: 16px; padding: 18px;
        background: var(--bg-surface); border: 1.5px solid var(--border-mid); border-radius: 16px;
        text-decoration: none; text-align: left; transition: all 0.2s ease;
      }
      .manage-popup-card:hover {
        transform: translateY(-2px); border-color: var(--blue-mid); background: var(--bg-card);
        box-shadow: 0 8px 24px rgba(48,127,226,0.08);
      }
      .manage-popup-icon {
        width: 46px; height: 46px; border-radius: 12px; background: rgba(48,127,226,0.1);
        display: flex; align-items: center; justify-content: center; color: var(--blue-mid);
        flex-shrink: 0; font-size: 20px;
      }
      .manage-popup-info { flex: 1; min-width: 0; }
      .manage-popup-info h4 { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px; }
      .manage-popup-info p { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.4; }
      .manage-popup-close-btn {
        width: 100%; padding: 12px; background: var(--bg-app); border: 1px solid var(--border-mid);
        color: var(--text-secondary); border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;
      }
      .manage-popup-close-btn:hover { background: var(--border); color: var(--text-primary); }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'managePopupOverlay';
    overlay.className = 'manage-popup-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeManagePopup(); };
    overlay.innerHTML = `
      <div class="manage-popup-box">
        <h3>Pilih Manajemen</h3>
        <p>Silakan pilih kategori data yang ingin dikelola:</p>
        
        <div class="manage-popup-options">
          <a href="/manage.html" class="manage-popup-card">
            <div class="manage-popup-icon"><i data-lucide="database"></i></div>
            <div class="manage-popup-info">
              <h4>Kelola Data</h4>
              <p>Manfaatkan pengaturan database divisi, link, berkas, dan kredensial.</p>
            </div>
          </a>

          <a href="/manage-users.html" class="manage-popup-card">
            <div class="manage-popup-icon"><i data-lucide="users"></i></div>
            <div class="manage-popup-info">
              <h4>Kelola Akun</h4>
              <p>Atur pendaftaran akun baru, detail profil staff/intern, dan hapus akun.</p>
            </div>
          </a>

          <a href="/rekap-absen.html" class="manage-popup-card">
            <div class="manage-popup-icon"><i data-lucide="bar-chart-3"></i></div>
            <div class="manage-popup-info">
              <h4>Rekap Absensi</h4>
              <p>Lihat dan pantau riwayat kehadiran serta koordinat GPS seluruh tim.</p>
            </div>
          </a>
        </div>

        <button class="manage-popup-close-btn" onclick="closeManagePopup()">Batal</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // Inject global profile settings drawer
  if (!document.getElementById('profileDrawerOverlay')) {
    const style = document.createElement('style');
    style.innerHTML = `
      .profile-drawer-overlay {
        position: fixed; inset: 0; background: rgba(10,22,32,0.6); backdrop-filter: blur(4px); z-index: 1500;
        opacity: 0; pointer-events: none; overflow: hidden; transition: opacity 0.3s ease;
      }
      .profile-drawer-overlay.open { opacity: 1; pointer-events: auto; }
      .profile-drawer {
        position: fixed; top: 0; right: 0; bottom: 0; width: 400px; max-width: 92vw; background: var(--bg-card);
        border-left: 1px solid var(--border); z-index: 1501; transform: translateX(100%);
        transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s;
        display: flex; flex-direction: column; box-shadow: -10px 0 40px rgba(15,23,42,0.12);
      }
      .profile-drawer-overlay.open .profile-drawer { transform: translateX(0); }
      .profile-drawer-header {
        padding: 22px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center;
        justify-content: space-between; flex-shrink: 0;
      }
      .profile-drawer-header h3 { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
      .profile-drawer-body { flex: 1; overflow-y: auto; padding: 24px; }
      .profile-drawer-footer { padding: 20px 24px; border-top: 1px solid var(--border); display: flex; gap: 12px; flex-shrink: 0; }
      .profile-drawer .btn-close-drawer { background: none; border: none; font-size: 20px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: background 0.2s, color 0.2s; }
      .profile-drawer .btn-close-drawer:hover { background: var(--bg-app); color: var(--text-primary); }
      .profile-drawer .form-field { margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px; text-align: left; }
      .profile-drawer .form-field label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
      .profile-drawer .form-field input { width: 100%; padding: 12px 14px; background: var(--bg-input); border: 1px solid var(--border-mid); border-radius: 10px; font-size: 13.5px; color: var(--text-primary); outline: none; transition: all 0.2s; }
      .profile-drawer .form-field input:focus { border-color: var(--blue-mid); box-shadow: 0 0 0 3px var(--blue-glow); }
      .profile-drawer .btn-drawer-cancel { padding: 12px; background: var(--bg-app); color: var(--text-secondary); border: 1px solid var(--border-mid); border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%; }
      .profile-drawer .btn-drawer-cancel:hover { background: var(--border); color: var(--text-primary); }
      .profile-drawer .btn-drawer-save { padding: 12px; background: var(--blue-mid); color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; width: 100%; }
      .profile-drawer .btn-drawer-save:hover { background: var(--blue-dark); }
      .profile-drawer .btn-drawer-save:disabled { opacity: 0.6; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    const drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'profileDrawerOverlay';
    drawerOverlay.className = 'profile-drawer-overlay';
    drawerOverlay.onclick = function(e) { if (e.target === drawerOverlay) closeProfileDrawer(); };
    drawerOverlay.innerHTML = `
      <div class="profile-drawer">
        <div class="profile-drawer-header">
          <h3>Setelan Profil</h3>
          <button class="btn-close-drawer" onclick="closeProfileDrawer()" title="Tutup"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
        </div>
        
        <div class="profile-drawer-body">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 16px;">
              <div class="profile-avatar-large" id="profileDrawerAvatarLarge" style="width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; color: #fff; overflow: hidden; background: linear-gradient(135deg, var(--blue-dark), var(--blue-mid)); border: 4px solid var(--bg-card); box-shadow: 0 8px 24px rgba(48,127,226,0.2);">?</div>
              <label style="position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; background: var(--blue-mid); border: 3px solid var(--bg-card); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); transition: transform 0.2s;" for="profileDrawerAvatarInput" title="Ubah Foto">
                <i data-lucide="camera" style="width:15px;height:15px;"></i>
                <input type="file" id="profileDrawerAvatarInput" accept="image/*" style="display:none;" onchange="previewDrawerAvatar(this)">
              </label>
            </div>
            <div style="font-size: 13px; color: var(--text-muted);" id="profileDrawerEmail">...</div>
          </div>

          <div class="form-field">
            <label for="profileDrawerName">Nama Lengkap</label>
            <input type="text" id="profileDrawerName" placeholder="Masukkan nama lengkap...">
          </div>
        </div>

        <div class="profile-drawer-footer">
          <button type="button" class="btn-drawer-cancel" onclick="closeProfileDrawer()">Batal</button>
          <button type="button" class="btn-drawer-save" id="btnSaveDrawerProfile" onclick="saveDrawerProfile()"><i data-lucide="save" style="width:15px;height:15px;vertical-align:-3px;margin-right:5px;"></i>Simpan</button>
        </div>
      </div>
    `;
    document.body.appendChild(drawerOverlay);
  }

  // Ensure vendor libraries are loaded
  ensureVendorLibraries(() => {
    renderIcons();
  });

  // Run page-specific callback
  if (onSuccess) {
    onSuccess(user);
    setTimeout(renderIcons, 100);
  }
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
    btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"></i>Tersalin';
    renderIcons();
    btn.classList.add('copied');
    showSwalToast('Tersalin ke clipboard!', 'success');
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
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', `${(idx % 6) * 40}`);
      grid.appendChild(card);
      attachCardEvents(card, item, idx);
    });

    renderIcons();
    if (window.gsap && filtered.length > 0) {
      gsap.fromTo(grid.children, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, stagger: 0.03, duration: 0.3, ease: 'power2.out', clearProps: "opacity,transform" }
      );
    }
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
        <div class="warn-tag"><i data-lucide="alert-triangle" style="width:12px;height:12px;vertical-align:-2px;margin-right:4px;"></i>Jaga kerahasiaan kredensial ini</div>`;
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

// ─── Sembunyikan bottom nav mobile saat keyboard muncul ───
// .mobile-bottom-nav pakai position:fixed — di beberapa in-app browser (mis.
// Instagram/WKWebView) elemen fixed ini ikut "terdorong" ke atas bareng
// keyboard alih-alih tersembunyi di baliknya, jadi kelihatan mengambang di
// tengah layar. Cara paling stabil lintas-browser: sembunyikan saja selama
// ada input/textarea yang fokus (mengetik), munculkan lagi saat selesai.
document.addEventListener('focusin', (e) => {
  if (e.target.matches && e.target.matches('input, textarea')) {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (nav) nav.style.display = 'none';
  }
});
document.addEventListener('focusout', (e) => {
  if (e.target.matches && e.target.matches('input, textarea')) {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (nav) nav.style.display = '';
  }
});

// ─── SPA Visual Transition (Fake SPA) ───
document.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (a && a.href && a.href.startsWith(window.location.origin)) {
    // Exclude external links, new tabs, logout, downloads, or anchor links
    if (a.target === '_blank' || a.href.includes('logout') || a.hasAttribute('download')) return;
    if (a.getAttribute('href') && a.getAttribute('href').startsWith('#')) return;
    
    // Allow modifier keys for new tab
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    
    e.preventDefault();
    if (window.innerWidth <= 768) toggleSidebar(); // auto-close sidebar on mobile
    
    showFakePjaxProgress();
    
    const main = document.querySelector('.app-main');
    if (main) main.classList.add('fade-out-pjax');

    // Normal navigation after short delay for animation
    setTimeout(() => {
      window.location.href = a.href;
    }, 150);
  }
});

function showFakePjaxProgress() {
  let bar = document.getElementById('pjax-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pjax-progress';
    document.body.appendChild(bar);
  }
  bar.style.transition = 'none';
  bar.style.width = '10%';
  bar.style.opacity = '1';
  setTimeout(() => {
    bar.style.transition = 'width 0.4s ease, opacity 0.3s ease';
    bar.style.width = '60%';
  }, 10);
}

// ─── Global Profile Drawer Helper Functions ───
var drawerAvatarBase64 = null;
var currentDrawerUser = null;

function openProfileDrawer() {
  const user = window.currentUserCache;
  if (!user) return;
  currentDrawerUser = user;
  drawerAvatarBase64 = null;

  document.getElementById('profileDrawerEmail').textContent = user.email;
  document.getElementById('profileDrawerName').value = user.name || '';

  const avatarContainer = document.getElementById('profileDrawerAvatarLarge');
  const initial = (user.name || user.email).charAt(0).toUpperCase();
  if (user.avatar && user.avatar.startsWith('http')) {
    avatarContainer.innerHTML = `<img src="${user.avatar}" alt="" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    avatarContainer.textContent = initial;
  }

  document.getElementById('profileDrawerOverlay').classList.add('open');
}

function closeProfileDrawer() {
  document.getElementById('profileDrawerOverlay').classList.remove('open');
}

function previewDrawerAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    drawerAvatarBase64 = e.target.result;
    const container = document.getElementById('profileDrawerAvatarLarge');
    container.innerHTML = `<img src="${drawerAvatarBase64}" alt="Preview" style="width:100%; height:100%; object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}

async function saveDrawerProfile() {
  const name = document.getElementById('profileDrawerName').value.trim();
  const btn = document.getElementById('btnSaveDrawerProfile');
  
  if (!name) {
    showSwalToast('Nama tidak boleh kosong.', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  
  try {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        avatar_base64: drawerAvatarBase64
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      showSwalToast('Profil berhasil disimpan!', 'success');
      setTimeout(() => {
        location.reload();
      }, 800);
    } else {
      showSwalToast(data.error || 'Gagal menyimpan profil.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save" style="width:15px;height:15px;vertical-align:-3px;margin-right:5px;"></i>Simpan';
      renderIcons();
    }
  } catch (err) {
    showSwalToast('Terjadi kesalahan koneksi server.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save" style="width:15px;height:15px;vertical-align:-3px;margin-right:5px;"></i>Simpan';
    renderIcons();
  }
}

function openManagePopup(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  document.getElementById('managePopupOverlay').classList.add('open');
  renderIcons();
}

function closeManagePopup() {
  document.getElementById('managePopupOverlay').classList.remove('open');
}
