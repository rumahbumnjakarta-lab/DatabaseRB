// ============================================
//   shared.js — Division Page Shared Logic v2
// ============================================

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
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
    }, 1600);
  }).catch(() => {});
}

// ─── Animate number ───
function animateCount(el, target) {
  let start = 0;
  const step = Math.ceil(target / 20);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, 30);
}

// ─── Main init function ───
function initDivisionPage(items) {
  const grid        = document.getElementById('grid');
  const chipRow     = document.getElementById('chipRow');
  const searchInput = document.getElementById('searchInput');
  const emptyState  = document.getElementById('emptyState');

  const statTotal = document.getElementById('stat-total');
  const statCat   = document.getElementById('stat-cat');

  const categories = ['Semua', ...new Set(items.map(i => i.cat))];
  let activeCat = 'Semua';
  let searchQ   = '';

  // Update header stats
  if (statTotal) animateCount(statTotal, items.length);
  if (statCat)   animateCount(statCat, categories.length - 1);

  // ─── Render category chips ───
  function renderChips() {
    chipRow.innerHTML = '';
    categories.forEach(cat => {
      const el = document.createElement('div');
      el.className = 'chip' + (cat === activeCat ? ' active' : '');
      el.textContent = cat;
      el.addEventListener('click', () => {
        activeCat = cat;
        renderChips();
        renderGrid();
      });
      chipRow.appendChild(el);
    });
  }

  // ─── Render item grid ───
  function renderGrid() {
    const q = searchInput.value.trim().toLowerCase();
    searchQ = q;

    const filtered = items.filter(i => {
      const matchesCat = activeCat === 'Semua' || i.cat === activeCat;
      const hay = [i.title, i.cat, i.note || '', i.email || '', i.url || ''].join(' ').toLowerCase();
      return matchesCat && hay.includes(q);
    });

    grid.innerHTML = '';
    emptyState.style.display = filtered.length ? 'none' : 'flex';

    filtered.forEach((item, idx) => {
      const card = buildCard(item, idx);
      card.style.animationDelay = `${idx * 0.04}s`;
      card.style.animation = 'cardAppear 0.4s ease both';
      grid.appendChild(card);
      attachCardEvents(card, item, idx);
    });
  }

  // ─── Build card DOM ───
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
        </div>
      `;
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
          <button class="btn btn-copy" data-copy="${escHtml(item.email)}" title="Salin Email">
            ${iconSvg('copy')}
          </button>
        </div>
        <div class="cred-row">
          <span class="cred-label">Sandi</span>
          <span class="val masked" id="${rowId}">••••••••••</span>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-copy" id="toggle-${rowId}" title="Tampilkan/Sembunyikan">
              ${iconSvg('eye')}
            </button>
            <button class="btn btn-copy" data-copy="${escHtml(item.pass)}" title="Salin Sandi">
              ${iconSvg('copy')}
            </button>
          </div>
        </div>
        <div class="warn-tag">⚠ Jaga kerahasiaan kredensial ini</div>
      `;
    }

    return card;
  }

  // ─── Attach card interactive events ───
  function attachCardEvents(card, item, idx) {
    // Copy buttons
    card.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        copyToClipboard(btn.getAttribute('data-copy'), btn);
      });
    });

    // Password toggle
    if (item.type === 'cred') {
      const rowId  = `cred-${idx}`;
      const span   = card.querySelector(`#${rowId}`);
      const toggle = card.querySelector(`#toggle-${rowId}`);
      let revealed = false;
      if (toggle && span) {
        toggle.addEventListener('click', () => {
          revealed = !revealed;
          span.textContent  = revealed ? item.pass : '••••••••••';
          span.classList.toggle('masked', !revealed);
          toggle.innerHTML  = revealed ? iconSvg('eyeOff') : iconSvg('eye');
        });
      }
    }

    // Subtle tilt on hover
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = (e.clientX - rect.left - cx) / cx;
      const dy = (e.clientY - rect.top  - cy) / cy;
      card.style.transform = `translateY(-4px) perspective(500px) rotateX(${dy * -3}deg) rotateY(${dx * 3}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  }

  // ─── Search listener ───
  searchInput.addEventListener('input', renderGrid);

  // ─── Initial render ───
  injectCardAnimation();
  renderChips();
  renderGrid();
}

// ─── Inject keyframe for card appear animation ───
function injectCardAnimation() {
  if (document.getElementById('shared-anim-style')) return;
  const style = document.createElement('style');
  style.id = 'shared-anim-style';
  style.textContent = `
    @keyframes cardAppear {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .cred-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.3);
      width: 38px;
      flex-shrink: 0;
    }
    .cred-row { gap: 10px; }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  `;
  document.head.appendChild(style);
}

// ─── HTML escape helper ───
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
