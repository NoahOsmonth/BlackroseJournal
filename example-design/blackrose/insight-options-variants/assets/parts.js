/* ============================================================================
   Blackrose — Insight "more options" prototypes: shared parts
   ----------------------------------------------------------------------------
   One copy of the Today screen and the action set, so all five variants are
   comparing the same content and the same tokens. Each variant file supplies
   only its own interaction.
   ========================================================================= */

window.BR = (function () {
  /* Order matters: the destructive row is last, where it is hardest to hit by
     accident while reaching for the common ones. */
  const ACTIONS = [
    { id: 'share', label: 'Share', icon: 'ios_share' },
    { id: 'copy', label: 'Copy', icon: 'content_copy' },
    { id: 'saved', label: 'Saved insights', icon: 'bookmark_border' },
    { id: 'hide', label: 'Hide for today', icon: 'visibility_off', danger: true },
  ];

  function todayScreen() {
    return (
      '<div class="today-head">' +
      '<div class="today-date serif">Thu · 10 Sep</div>' +
      '<div class="today-streak">3 days</div>' +
      '</div>' +
      '<div class="overline" style="padding:0 0.25rem 0.5rem">Based on your entries</div>' +
      '<div class="card today-card">' +
      '<p class="card-q serif">What would make tomorrow feel 10% lighter?</p>' +
      '<div class="card-rule"></div>' +
      '<div class="icon-row">' +
      '<button class="icon-btn" aria-label="Refresh insight">' +
      '<span class="material-symbols-rounded">refresh</span></button>' +
      '<button class="icon-btn" aria-label="Save insight">' +
      '<span class="material-symbols-rounded">bookmark_border</span></button>' +
      '<button class="icon-btn" id="trigger" aria-label="More options" aria-haspopup="menu" aria-expanded="false">' +
      '<span class="material-symbols-rounded">more_horiz</span></button>' +
      '</div>' +
      '</div>' +
      '<div class="ambient">' +
      '<div class="ambient-row"><span>Morning note</span><span>Done</span></div>' +
      '<div class="ambient-row"><span>Evening close</span><span>Open</span></div>' +
      '<div class="ambient-row"><span>Grow into the new role</span><span></span></div>' +
      '<div class="ambient-row"><span>Speak the hurt, not the anger</span><span></span></div>' +
      '</div>'
    );
  }

  /* Renders the phone body. Variants append their own layer markup after it. */
  function mount(host) {
    const scroll = document.createElement('div');
    scroll.className = 'scroll';
    scroll.innerHTML = todayScreen();
    host.appendChild(scroll);
    return scroll;
  }

  function actionRow(action, extraClass) {
    return (
      '<button class="action' +
      (action.danger ? ' danger' : '') +
      (extraClass ? ' ' + extraClass : '') +
      '" data-action="' + action.id + '" role="menuitem">' +
      '<span class="material-symbols-rounded">' + action.icon + '</span>' +
      '<span>' + action.label + '</span>' +
      '</button>'
    );
  }

  /* The in-page theme chip. The hub broadcasts into frames too; this exists so
     a variant opened directly is still judgeable in both schemes. */
  function themeChip(host) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML =
      '<span class="material-symbols-rounded" style="font-size:15px">contrast</span>' +
      '<span data-theme-label>Light</span>';
    btn.addEventListener('click', function () {
      const dark = !document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', dark);
      btn.setAttribute('aria-pressed', String(dark));
      btn.querySelector('[data-theme-label]').textContent = dark ? 'Dark' : 'Light';
    });
    host.appendChild(btn);
  }

  function boot(build) {
    const host = document.querySelector('.phone');
    mount(host);
    themeChip(host);
    build(host);
  }

  return {
    ACTIONS: ACTIONS,
    actionRow: actionRow,
    boot: boot,
    mount: mount,
    themeChip: themeChip,
  };
})();
