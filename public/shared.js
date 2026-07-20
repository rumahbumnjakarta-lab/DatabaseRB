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
    { href: '/index.html', icon: 'layout-dashboard', label: 'Dashboard', key: 'dashboard' },
    { divider: true, label: 'Absensi' },
    { href: '/absen.html', icon: 'map-pin', label: 'Absen Saya', key: 'absen' },
    { divider: true, label: 'Divisi' },
    { href: '/business-development.html', icon: 'trending-up', label: 'Business Dev', key: 'bd' },
    { href: '/sosmed.html', icon: 'share-2', label: 'Social Media', key: 'sosmed' },
    { href: '/design.html', icon: 'palette', label: 'Design', key: 'design' },
    { href: '/event.html', icon: 'calendar', label: 'Event', key: 'event' },
    { href: '/admin.html', icon: 'file-text', label: 'Admin', key: 'admin' },
    { divider: true, label: 'Staff Only', staffOnly: true },
    { href: '/administrasi.html', icon: 'shield-check', label: 'Administrasi', key: 'administrasi', staffOnly: true },
    { href: '/email.html', icon: 'mail', label: 'Akun Email', key: 'email', staffOnly: true },
    { href: '#', icon: 'settings', label: 'Kelola', key: 'manage', staffOnly: true, onclick: 'openManagePopup(event)' },
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
    navHTML += `
      <a href="${item.href}" ${onclickAttr} class="sidebar-link${isActive}">
        <span class="sidebar-icon"><i data-lucide="${item.icon}" style="width:17px;height:17px;"></i></span>
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
        <div class="sidebar-user-info" style="cursor:pointer;" onclick="openProfileDrawer()" title="Buka Setelan Profil">
          <div class="sidebar-avatar" id="sidebarAvatar">${avatarHTML}</div>
          <div class="sidebar-user-details" style="flex:1; min-width:0;">
            <div class="sidebar-user-name" id="sidebarName" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user ? (user.name || user.email) : '...'}</div>
            <span class="sidebar-user-role ${roleClass}">${roleLabel}</span>
          </div>
          <button class="sidebar-logout-btn" onclick="event.stopPropagation(); doLogout();" title="Keluar">
            <i data-lucide="log-out" style="width:16px;height:16px;"></i>
          </button>
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

// ─── Frontend Idle Logout Timer (10 Mins) ───
let idleTimeout = null;
const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes

function resetIdleTimer() {
  if (idleTimeout) clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    // Session expired due to inactivity
    window.location.href = '/login.html?error=session_expired';
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
      confirmButtonColor: '#307fe2',
      cancelButtonColor: '#ef4444',
      confirmButtonText: confirmButtonText,
      cancelButtonText: 'Batal',
      background: '#0f172a',
      color: '#fff'
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

  // ─── Enforce Tab-based Session (Logout on Tab Close) ───
  if (!sessionStorage.getItem('app_session')) {
    // If there is no session in this tab, force backend logout and redirect
    fetch('/auth/logout').then(() => {
      window.location.href = '/login.html';
    }).catch(() => {
      window.location.href = '/login.html';
    });
    return;
  }

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

  // Hide loading
  const loading = document.getElementById('authLoading');
  if (loading) loading.style.display = 'none';

  // Show content
  const content = document.getElementById('appContent');
  if (content) {
    content.style.display = 'block';
    content.classList.add('fade-in-pjax');
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
        width: 90%; max-width: 520px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
        display: flex; flex-direction: column; box-shadow: -10px 0 50px rgba(0,0,0,0.3);
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
          <button class="btn-close-drawer" onclick="closeProfileDrawer()" title="Tutup">✕</button>
        </div>
        
        <div class="profile-drawer-body">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 16px;">
              <div class="profile-avatar-large" id="profileDrawerAvatarLarge" style="width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; color: #fff; overflow: hidden; background: linear-gradient(135deg, var(--blue-dark), var(--blue-mid)); border: 4px solid var(--bg-card); box-shadow: 0 8px 24px rgba(48,127,226,0.2);">?</div>
              <label style="position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; background: var(--blue-mid); border: 3px solid var(--bg-card); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); transition: transform 0.2s;" for="profileDrawerAvatarInput" title="Ubah Foto">
                📷
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
          <button type="button" class="btn-drawer-save" id="btnSaveDrawerProfile" onclick="saveDrawerProfile()">💾 Simpan</button>
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
    btn.innerHTML = '✓ Tersalin';
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
      btn.textContent = '💾 Simpan';
    }
  } catch (err) {
    showSwalToast('Terjadi kesalahan koneksi server.', 'error');
    btn.disabled = false;
    btn.textContent = '💾 Simpan';
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
