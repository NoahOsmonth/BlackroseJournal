/* ============================================================================
   Blackrose Settings prototypes — shared parts
   ----------------------------------------------------------------------------
   Everything the five variants share lives here: the nine rows, the Appearance
   switches, and the Color Studio body. Each variant file supplies only its own
   chrome (the thing actually being compared — how one row is separated from
   the next) plus a little CSS.
   ========================================================================= */

(function () {
  const PRESETS = [
    { id: 'blackrose', name: 'Blackrose', accent: '#5C564C', app: '#1C1917', you: '#8A5F68', ai: '#5C564C' },
    { id: 'amber', name: 'Amber', accent: '#C98A3C', app: '#2A211A', you: '#A9713A', ai: '#7A5A2E' },
    { id: 'ocean', name: 'Ocean', accent: '#3E6E8E', app: '#16232B', you: '#4A7FA0', ai: '#2F5C77' },
    { id: 'forest', name: 'Forest', accent: '#4F6F52', app: '#182018', you: '#5C8260', ai: '#3A5340' },
    { id: 'plum', name: 'Plum', accent: '#6E4A6E', app: '#221A22', you: '#8A5F8A', ai: '#54385A' },
    { id: 'sunset', name: 'Sunset', accent: '#B5694A', app: '#2A1D18', you: '#C97B58', ai: '#8A4F3A' },
    { id: 'lavender', name: 'Lavender', accent: '#7A6E9E', app: '#1E1B26', you: '#9285B5', ai: '#5C527A' },
    { id: 'mint', name: 'Mint', accent: '#5E8A80', app: '#16211F', you: '#74A398', ai: '#3F5F58' },
    { id: 'mocha', name: 'Mocha', accent: '#7A5F4A', app: '#221B16', you: '#96775E', ai: '#543F30' },
  ];

  /* Light / dark pairs per slot, with the "auto" badge marking a partner that
     the picker would derive rather than one set by hand. */
  const SWATCH_ROWS = [
    { label: 'Accent', light: { hex: '#5C564C', auto: false }, dark: { hex: '#C9C2B6', auto: true } },
    { label: 'App font', light: { hex: '#1C1917', auto: false }, dark: { hex: '#EDE8E0', auto: true } },
    { label: 'Muted font', light: { hex: '#6B6560', auto: true }, dark: { hex: '#8A8580', auto: false } },
    { label: 'Chat — you', light: { hex: '#8A5F68', auto: false }, dark: { hex: '#C4A0A6', auto: true } },
    { label: 'Chat — Blackrose', light: { hex: '#5C564C', auto: true }, dark: { hex: '#C9C2B6', auto: true } },
    { label: 'Background', light: { hex: '#F4F1EB', auto: true }, dark: { hex: '#0C0C0E', auto: false } },
  ];

  const ROWS = [
    { id: 'appearance', title: 'Appearance', summary: 'Light · Native', hint: 'Theme and emoji treatment', body: 'appearance' },
    { id: 'color', title: 'Color Studio', summary: 'Blackrose', hint: 'Palette and per-slot colors', body: 'color' },
    { id: 'generation', title: 'Generation', summary: 'Balanced', hint: 'Reply length and warmth', body: 'generation' },
    { id: 'customAi', title: 'AI Model', summary: 'Off', hint: 'Bring your own provider', body: 'customAi' },
    { id: 'data', title: 'Data Management', summary: 'Export · Backup', hint: 'Everything stays on device', body: 'data' },
    { id: 'identity', title: 'Identity', summary: 'On device', hint: 'What Blackrose always remembers', body: 'identity' },
    { id: 'memory', title: 'Memory', summary: '34 memories', hint: 'Atoms, files and Dream', body: 'memory' },
    { id: 'account', title: 'Account', summary: 'On this device', hint: 'No sign-in, no server', body: 'account' },
    { id: 'about', title: 'About', summary: 'v0.0.1', hint: 'Version and privacy', body: 'about' },
  ];

  const DEFAULT_OPEN = { appearance: true, color: true };

  /* ------------------------------------------------------------------ pieces */

  function segments() {
    const rows = [
      { key: 'Theme', options: ['Light', 'Dark', 'System'], active: 'Light' },
      { key: 'Emoji', options: ['Native', 'Flat', '3D'], active: 'Native' },
    ];
    return rows
      .map(
        (row) => `
      <div class="segment" role="radiogroup" aria-label="${row.key}">
        ${row.options
          .map((o) => `<button type="button" role="radio" aria-checked="${o === row.active}">${o}</button>`)
          .join('')}
      </div>`,
      )
      .join('');
  }

  function presets() {
    return PRESETS.map(
      (p) => `
      <button type="button" class="preset" role="radio" aria-checked="${p.id === 'blackrose'}"
              data-preset="${p.id}" aria-label="Select ${p.name} colors">
        <span class="preset-bar">
          <i style="background:${p.accent}"></i>
          <i style="background:${p.app}"></i>
          <i style="background:${p.you}"></i>
          <i style="background:${p.ai}"></i>
        </span>
        <span class="preset-name">${p.name}</span>
      </button>`,
    ).join('');
  }

  function preview() {
    return `
      <div class="preview">
        <div class="preview-head">
          <span class="preview-title">Journal preview</span>
          <span class="material-symbols-rounded" style="color:var(--text-2)">refresh</span>
        </div>
        <span class="preview-hint">A calmer entry with the colors you chose.</span>
        <span class="preview-line" data-preview-you style="color:#8A5F68">I want the chat to feel like mine.</span>
        <span class="preview-line" data-preview-ai style="color:#5C564C">Blackrose can match that tone.</span>
      </div>`;
  }

  function swatches() {
    return SWATCH_ROWS.map(
      (row) => `
      <div class="swatch-row">
        <span class="label">${row.label}</span>
        <div class="swatch-pair">
          ${[
            { slot: row.light, cap: 'Light' },
            { slot: row.dark, cap: 'Dark' },
          ]
            .map(
              ({ slot, cap }) => `
            <button type="button" class="swatch" aria-label="Edit ${row.label} ${cap} color">
              <span class="cap">${cap}</span>
              <span class="chip" style="background:${slot.hex}">
                ${slot.auto ? '<span class="badge"><i>✦</i>auto</span>' : ''}
                <span class="badge edit material-symbols-rounded">edit</span>
              </span>
              <span class="hex mono">${slot.hex}</span>
            </button>`,
            )
            .join('')}
        </div>
      </div>`,
    ).join('');
  }

  function colorStudio(opts) {
    const o = opts || {};
    return `${o.previewFirst ? preview() : ''}
      <div class="presets">${presets()}</div>
      ${o.previewFirst ? '' : preview()}
      <div class="swatch-stack">${swatches()}</div>`;
  }

  /* -------------------------------------------------------------- stub bodies */

  const STUBS = {
    generation: `
      <div class="segment" role="radiogroup" aria-label="Reply length">
        <button type="button" role="radio" aria-checked="false">Brief</button>
        <button type="button" role="radio" aria-checked="true">Balanced</button>
        <button type="button" role="radio" aria-checked="false">Longer</button>
      </div>
      <span class="stub-note">Blackrose follows your lead, then asks one real question.</span>`,
    customAi: `
      <span class="stub-note">No custom provider connected. The app talks to your gateway and nothing else.</span>
      <div class="stub-actions"><button type="button" class="stub-btn">Connect a provider</button></div>`,
    data: `
      <div class="stub-list">
        <button type="button" class="stub-row"><span>Export journal as JSON</span><span class="material-symbols-rounded">chevron_right</span></button>
        <button type="button" class="stub-row"><span>Create a backup</span><span class="material-symbols-rounded">chevron_right</span></button>
        <button type="button" class="stub-row danger"><span>Clear history</span><span class="material-symbols-rounded">chevron_right</span></button>
      </div>
      <span class="stub-note">Backups include memories, identity and day digests.</span>`,
    identity: `
      <div class="stub-list">
        <div class="stub-row static"><span>Preferred name</span><span class="stub-value">Sigmund</span></div>
        <div class="stub-row static"><span>Pronouns</span><span class="stub-value">not set</span></div>
        <div class="stub-row static"><span>People</span><span class="stub-value">2 pinned</span></div>
      </div>`,
    memory: `
      <span class="stub-note">34 memories on device. Dream consolidates them when the app is idle.</span>
      <div class="stub-actions"><button type="button" class="stub-btn">Open memory hub</button></div>`,
    account: `
      <span class="stub-note">A device-local id minted on first launch. Nothing is sent anywhere.</span>
      <span class="stub-value mono">acct_7f3a…c21</span>`,
    about: `
      <div class="stub-list">
        <button type="button" class="stub-row"><span>About Blackrose</span><span class="material-symbols-rounded">chevron_right</span></button>
        <button type="button" class="stub-row"><span>Privacy policy</span><span class="material-symbols-rounded">chevron_right</span></button>
      </div>
      <span class="stub-note">Version 0.0.1 · local-only build</span>`,
  };

  function bodyFor(id) {
    if (id === 'appearance') return '<div data-part="appearance"></div>';
    if (id === 'color') return '<div data-part="color-studio"></div>';
    return STUBS[id] || '';
  }

  /* ------------------------------------------------------------------- rows */

  function rowsHtml(skip) {
    const skipIds = skip ? skip.split(',').map((s) => s.trim()) : [];
    return ROWS.filter((r) => !skipIds.includes(r.id)).map((row, index) => {
      const open = DEFAULT_OPEN[row.id] === true;
      return `
      <div class="row" data-row id="row-${row.id}" data-expanded="${open}">
        <span class="sep" aria-hidden="true"><i></i></span>
        <button type="button" class="row-head" data-toggle aria-expanded="${open}" aria-controls="body-${row.id}">
          <span class="row-index mono" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          <span class="row-text">
            <span class="row-title serif">${row.title}</span>
            <span class="row-hint">${row.hint}</span>
          </span>
          <span class="row-summary serif">${row.summary}</span>
          <span class="material-symbols-rounded row-chev" data-chevron>${open ? 'expand_less' : 'expand_more'}</span>
        </button>
        <div class="row-body" id="body-${row.id}" data-body ${open ? '' : 'hidden'}>
          <div class="row-body-inner">${bodyFor(row.id)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function dock() {
    const items = [
      { label: 'Today', icon: 'calendar_today', current: false },
      { label: 'Threads', icon: 'sticky_note_2', current: false },
      { label: 'Insights', icon: 'graphic_eq', current: false },
      { label: 'Archive', icon: 'inventory_2', current: false },
    ];
    return `
      ${items
        .map(
          (i) => `<button type="button" class="dock-item" ${i.current ? 'aria-current="page"' : ''}>
          <span class="material-symbols-rounded">${i.icon}</span><span>${i.label}</span>
        </button>`,
        )
        .join('')}
      <button type="button" class="fab" aria-label="New entry"><span class="material-symbols-rounded">edit</span></button>`;
  }

  /* ------------------------------------------------------------------ mount */

  function mount() {
    document.querySelectorAll('[data-rows]').forEach((el) => {
      el.innerHTML = rowsHtml(el.dataset.skip);
    });
    document.querySelectorAll('[data-dock]').forEach((el) => {
      el.innerHTML = dock();
    });

    /* The variant label rides in the page header as an overline — a floating
       chip always ended up sitting on top of the rows. */
    const label = document.querySelector('.phone')?.dataset.variant;
    if (label) {
      const head = document.querySelector('.page-head');
      if (head) {
        const over = document.createElement('span');
        over.className = 'variant-overline';
        over.textContent = label;
        head.prepend(over);
      }
    }

    document.querySelectorAll('[data-part="appearance"]').forEach((el) => {
      el.innerHTML = segments();
    });
    document.querySelectorAll('[data-part="color-studio"]').forEach((el) => {
      el.innerHTML = colorStudio({ previewFirst: el.dataset.previewFirst === 'true' });
    });

    document.querySelectorAll('.segment, .presets').forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !group.contains(btn)) return;
        group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        if (btn.dataset.preset) {
          const p = PRESETS.find((x) => x.id === btn.dataset.preset);
          const root = document.querySelector('.phone');
          if (p && root) {
            root.querySelectorAll('[data-preview-you]').forEach((n) => (n.style.color = p.you));
            root.querySelectorAll('[data-preview-ai]').forEach((n) => (n.style.color = p.ai));
          }
        }
      });
    });

    document.querySelectorAll('[data-row]').forEach((row) => {
      const head = row.querySelector('[data-toggle]');
      const body = row.querySelector('[data-body]');
      const chev = head && head.querySelector('[data-chevron]');
      if (!head || !body) return;
      const set = (open) => {
        row.dataset.expanded = String(open);
        body.hidden = !open;
        head.setAttribute('aria-expanded', String(open));
        if (chev) chev.textContent = open ? 'expand_less' : 'expand_more';
      };
      set(row.dataset.expanded === 'true');
      head.addEventListener('click', () => set(row.dataset.expanded !== 'true'));
    });

    const root = document.documentElement;
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.classList.toggle('dark');
        const dark = root.classList.contains('dark');
        document.querySelectorAll('[data-theme-label]').forEach((el) => {
          el.textContent = dark ? 'Dark' : 'Light';
        });
      });
    });
  }

  window.BR = { ROWS, PRESETS, mount };
  document.addEventListener('DOMContentLoaded', mount);
})();
