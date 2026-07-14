// Shared utility functions for all division pages

function iconSvg(name) {
  if (name === 'open') return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';
  if (name === 'copy') return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  if (name === 'eye') return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
  return '';
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = 'Tersalin ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 1400);
  }).catch(() => {});
}

function initDivisionPage(items) {
  const grid = document.getElementById('grid');
  const chipRow = document.getElementById('chipRow');
  const searchInput = document.getElementById('searchInput');
  const emptyState = document.getElementById('emptyState');

  const categories = ["Semua", ...new Set(items.map(i => i.cat))];
  let activeCat = "Semua";

  document.getElementById('stat-total').textContent = items.length;
  document.getElementById('stat-cat').textContent = categories.length - 1;
  
  const emailStat = document.getElementById('stat-email');
  if (emailStat) {
    emailStat.textContent = items.filter(i => i.type === 'cred').length;
  }

  function renderChips() {
    chipRow.innerHTML = "";
    categories.forEach(cat => {
      const el = document.createElement('div');
      el.className = 'chip' + (cat === activeCat ? ' active' : '');
      el.textContent = cat;
      el.onclick = () => { activeCat = cat; renderChips(); renderGrid(); };
      chipRow.appendChild(el);
    });
  }

  function renderGrid() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = items.filter(i => {
      const matchesCat = activeCat === "Semua" || i.cat === activeCat;
      const haystack = (i.title + " " + i.cat + " " + (i.note || "")).toLowerCase();
      const matchesSearch = haystack.includes(q);
      return matchesCat && matchesSearch;
    });

    grid.innerHTML = "";
    emptyState.style.display = filtered.length ? 'none' : 'block';

    filtered.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'card' + (item.type === 'cred' ? ' credential' : '');

      if (item.type === 'link') {
        card.innerHTML = `
          <div class="card-top">
            <h3>${item.title}</h3>
            <span class="cat-tag">${item.cat}</span>
          </div>
          <p class="note">${item.note}</p>
          <div class="card-actions">
            <a class="btn btn-open" href="${item.url}" target="_blank" rel="noopener">${iconSvg('open')} Buka</a>
            <button class="btn btn-copy" data-copy="${item.url}">${iconSvg('copy')} Salin Link</button>
          </div>
        `;
      } else {
        const rowId = 'pass-' + idx;
        card.innerHTML = `
          <div class="card-top">
            <h3>${item.title}</h3>
            <span class="cat-tag">${item.cat}</span>
          </div>
          <p class="note">${item.note}</p>
          <div class="cred-row">
            <span>${item.email}</span>
            <button class="btn btn-copy" data-copy="${item.email}">${iconSvg('copy')}</button>
          </div>
          <div class="cred-row">
            <span class="val masked" id="${rowId}">••••••••••••</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-copy" id="toggle-${rowId}">${iconSvg('eye')}</button>
              <button class="btn btn-copy" data-copy="${item.pass}">${iconSvg('copy')}</button>
            </div>
          </div>
          <div class="warn-tag">⚠ Jaga kerahasiaan kredensial ini</div>
        `;
      }
      grid.appendChild(card);

      if (item.type === 'cred') {
        const rowId2 = 'pass-' + idx;
        const span = card.querySelector('#' + rowId2);
        const toggleBtn = card.querySelector('#toggle-' + rowId2);
        let revealed = false;
        toggleBtn.onclick = () => {
          revealed = !revealed;
          span.textContent = revealed ? item.pass : '••••••••••••';
          span.classList.toggle('masked', !revealed);
        };
      }

      card.querySelectorAll('[data-copy]').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(btn.getAttribute('data-copy'), btn);
        };
      });
    });
  }

  searchInput.addEventListener('input', renderGrid);
  renderChips();
  renderGrid();
}
