/* ============================================================================
   Blackrose — Explore / Threads (variant A · Index)
   ----------------------------------------------------------------------------
   Shared content + interactions. The layout lives in variant-a-index.html.

   Exposed on window.BR:
     BR.PORTRAIT / THEMES / ATOMS   the memory payload
     BR.state                { layer, query } — live filter state
     BR.TODAY_ISO            the write day, for relative framing
     BR.el(html)             html string -> element
     BR.esc(value)           html escape
     BR.titleCase(value)     "morning" -> "Morning"
     BR.dateParts(iso)       { year, month, monthLong, day, dayPadded }
     BR.longDate(iso)        "September 19, 2026"
     BR.monthDay(iso)        "Aug 30"
     BR.layerDot(layer)      a layer marker span
     BR.atomMeta(atom)       "Semantic · 2h ago" + dot
     BR.atomTags(atom)       the memory's themes, as filter words
     BR.atomSource(atom)     provenance ("from <entry title>")
     BR.measures(atom)       confidence meter + recurrence
     BR.metaLine()           live "N memories · N themes · since Aug 30"
     BR.search()             search field markup
     BR.writeComposer()      the writing surface markup
     BR.bindWrite(root, o)   wire it; o.onKept(atom) reacts
     BR.addMemory(input)     write -> memory (unshifts, notifies)
     BR.deriveThemes(text)   local theme matcher (no model)
     BR.matches(atom)        is atom in the current filter?
     BR.onChange(fn)         subscribe to filter changes
     BR.setLayer / setQuery  set filter state, notify
     BR.bindSearch / bindLayerControls / bindTagTaps
     BR.dock(active)         bottom dock markup
   ========================================================================= */

(function () {
  /* --------------------------------------------------------------- the data

     CONTENT MODEL — half the redesign.

     What the extractor writes today (real output, seen on /explore):

       title:   "Recurring theme: the user returns to calm mornings,
                 movement, and honest communication as what regulates them."
       content: (identical to title)
       tags:    #recurring #theme #user

     Four failures, none of them layout:

       1. LEAKED MACHINE PROSE. "Recurring theme:" is the extraction prompt's own
          vocabulary coming back out of the model. memoryAtomExtraction.ts:85
          already forbids it; nothing validates the result, so it ships.
       2. THIRD PERSON. "the user returns" — the app talks about the writer to
          the writer. The rest of the product says "you".
       3. TITLE == CONTENT. Both fields carry the same text, so every card spends
          two lines saying one thing. Here the title is the claim and the body is
          the evidence, so they add instead of repeating.
       4. TAGS AS ARTIFACTS. "#recurring #theme #user" is bookkeeping. Real themes
          are the vocabulary of a life, and they are what the graph clusters on.

     Each atom carries what the screen actually needs: title (claim), body
     (evidence), themes (real, shared, drive filters and links), iso (stable
     calendar date), score (salience), confidence, revisits, and provenance. */

  const PORTRAIT =
    'You come back to movement when you need to feel like yourself again. ' +
    'Follow-through matters more to you than starting does, and the quiet that ' +
    'follows a loud week is something you are still learning to trust.';

  /* The write day. Dates in this archive are WRITE dates, not event dates —
     per the clock doctrine, a date label must not be read as "when it
     happened". The list header says "Written" for exactly that reason. */
  const TODAY_ISO = '2026-09-19';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  /* Portrait themes are the ones that recur across the atoms below — the same
     rule the production portrait uses (topMemoryThemes). */
  const THEMES = ['Recovery', 'Work', 'Morning', 'Movement'];

  const ATOMS = [
    {
      id: 'a1', layer: 'semantic',
      title: 'Calm mornings are how you regulate',
      body: 'When a week goes sideways, what you reach for is an unhurried first hour and a long walk — not a better plan.',
      themes: ['morning', 'movement', 'recovery'],
      at: '2h ago', iso: '2026-09-19',
      score: 8, confidence: 0.86, revisits: 5,
      from: { title: 'A week that got away from me', kind: 'Journal' },
    },
    {
      id: 'a2', layer: 'episodic',
      title: 'You noticed the hurt underneath the anger',
      body: 'Naming it out loud is what ended the loop. You had been arguing with the surface for an hour.',
      themes: ['conflict', 'honesty'],
      at: '5h ago', iso: '2026-09-19',
      score: 7, confidence: 0.91, revisits: 2,
      from: { title: 'The same argument, again', kind: 'Journal' },
    },
    {
      id: 'a3', layer: 'profile',
      title: 'Follow-through matters more to you than starting',
      body: 'Beginnings are easy for you. You judge yourself on what you see through, and you are quietly proud of that.',
      themes: ['consistency', 'pride'],
      at: '1d ago', iso: '2026-09-18',
      score: 9, confidence: 0.88, revisits: 9,
      from: { title: 'Morning check-in', kind: 'Check-in' },
    },
    {
      id: 'a4', layer: 'episodic',
      title: 'The Sunday reset that did not happen',
      body: 'You slept instead of working the list, and decided to count it as a win. First time without the guilt.',
      themes: ['sleep', 'rest'],
      at: '2d ago', iso: '2026-09-17',
      score: 6, confidence: 0.83, revisits: 1,
      from: { title: 'Sunday, honestly', kind: 'Journal' },
    },
    {
      id: 'a5', layer: 'semantic',
      title: 'Ambition shows up as fuel and as tax',
      body: 'The same drive reads as momentum on some days and as pressure on others, usually inside one week.',
      themes: ['work', 'ambition', 'pressure'],
      at: '3d ago', iso: '2026-09-16',
      score: 8, confidence: 0.79, revisits: 4,
      from: { title: 'On wanting the bigger thing', kind: 'Journal' },
    },
    {
      id: 'a6', layer: 'procedural',
      title: 'Your first hour has to stay unowned',
      body: 'Plans you make for the first hour of the day get abandoned. The identical plan, made after it, sticks.',
      themes: ['morning', 'routine', 'work'],
      at: '5d ago', iso: '2026-09-14',
      score: 7, confidence: 0.84, revisits: 6,
      from: { title: 'Evening check-in', kind: 'Check-in' },
    },
    {
      id: 'a7', layer: 'working',
      title: 'Something is still unresolved about the new role',
      body: 'You keep circling back to whether the scope was ever actually agreed. The circling suggests it was not.',
      themes: ['work', 'uncertainty'],
      at: '1w ago', iso: '2026-09-12',
      score: 5, confidence: 0.62, revisits: 3,
      from: { title: 'Sunday, honestly', kind: 'Journal' },
    },
    {
      id: 'a8', layer: 'episodic',
      title: 'You walked the long way home and felt like yourself',
      body: 'After a heavy week, two hours of walking with no destination did more than the whole rest of the weekend.',
      themes: ['movement', 'recovery'],
      at: '1w ago', iso: '2026-09-11',
      score: 6, confidence: 0.87, revisits: 2,
      from: { title: 'Long way home', kind: 'Journal' },
    },
    {
      id: 'a9', layer: 'semantic',
      title: 'Quiet always follows the loud weeks',
      body: 'Every intense stretch has been followed by a withdrawal you read as failure. It has never once been failure.',
      themes: ['recovery', 'sleep'],
      at: '2w ago', iso: '2026-09-06',
      score: 7, confidence: 0.81, revisits: 7,
      from: { title: 'After the deadline', kind: 'Journal' },
    },
    {
      id: 'a10', layer: 'profile',
      title: 'You write to think, not to record',
      body: 'Your entries get clearer as they go. The real content is almost always in the last paragraph.',
      themes: ['writing', 'process'],
      at: '3w ago', iso: '2026-08-30',
      score: 8, confidence: 0.75, revisits: 11,
      from: { title: 'Why I keep this', kind: 'Journal' },
    },
  ];

  /* Layer vocabulary — labels from components/memory/memoryDisplay.ts, and the
     four slots the hub's segmented filter shows. */
  const LAYERS = [
    { id: 'all', label: 'All' },
    { id: 'episodic', label: 'Episodic' },
    { id: 'semantic', label: 'Semantic' },
    { id: 'profile', label: 'Profile' },
  ];

  const LAYER_NAMES = {
    episodic: 'Episodic',
    semantic: 'Semantic',
    profile: 'Profile',
    procedural: 'Procedural',
    working: 'Working',
    note: 'Notes',
  };

  /* A small, shared theme vocabulary. Matching is plain word-boundary regex —
     the whole point is that a reader could predict the result. No model. */
  const THEME_VOCAB = {
    morning: ['morning', 'mornings', 'woke', 'wake', 'early', 'first hour', 'sunrise'],
    sleep: ['sleep', 'slept', 'tired', 'insomnia', 'nap', 'exhausted', 'bed', 'rest'],
    work: ['work', 'job', 'office', 'deadline', 'meeting', 'boss', 'role', 'career', 'project'],
    movement: ['walk', 'walked', 'run', 'ran', 'gym', 'exercise', 'movement', 'stretch', 'body'],
    recovery: ['recover', 'recovery', 'quiet', 'slow', 'withdraw', 'reset', 'alone'],
    conflict: ['argument', 'argue', 'conflict', 'fight', 'fought', 'anger', 'angry', 'hurt', 'tension'],
    honesty: ['honest', 'honesty', 'truth', 'admitted', 'confessed', 'named it'],
    ambition: ['ambition', 'ambitious', 'goal', 'bigger', 'drive', 'want more'],
    pressure: ['pressure', 'stress', 'stressed', 'overwhelmed', 'burnout', 'too much'],
    consistency: ['consistency', 'consistent', 'discipline', 'routine', 'habit', 'follow through'],
    family: ['family', 'mum', 'mom', 'dad', 'mother', 'father', 'sister', 'brother', 'parents'],
    friendship: ['friend', 'friends', 'friendship', 'mate'],
    love: ['love', 'partner', 'girlfriend', 'boyfriend', 'wife', 'husband', 'relationship'],
    anxiety: ['anxiety', 'anxious', 'worry', 'worried', 'nervous', 'panic', 'dread'],
    pride: ['proud', 'pride', 'achievement', 'achieved', 'earned'],
    writing: ['writing', 'write', 'wrote', 'journal', 'entry', 'notebook'],
    money: ['money', 'rent', 'bills', 'afford', 'savings', 'debt', 'salary'],
    health: ['health', 'doctor', 'sick', 'illness', 'pain', 'injury', 'therapy'],
    uncertainty: ['unsure', 'uncertain', 'confused', 'unclear', 'maybe'],
    gratitude: ['grateful', 'gratitude', 'thankful', 'appreciate'],
  };

  const state = { layer: 'all', query: '' };
  const listeners = [];

  function notify() {
    listeners.forEach((fn) => fn(state));
  }

  function setLayer(layer) {
    state.layer = layer;
    notify();
  }

  /** Set the free-text filter and keep any bound search input in sync. */
  function setQuery(query) {
    state.query = query;
    document.querySelectorAll('[data-search]').forEach((input) => {
      input.value = query;
    });
    notify();
  }

  function matches(atom) {
    const layerOk = state.layer === 'all' || atom.layer === state.layer;
    if (!layerOk) return false;
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    return `${atom.title} ${atom.body} ${atom.themes.join(' ')}`.toLowerCase().includes(q);
  }

  /* ------------------------------------------------------------ primitives */

  function el(html) {
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  function esc(value) {
    return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* Themes are stored as extraction tokens ("recovery") but shown as words
     ("Recovery") — the production portrait does the same. */
  function titleCase(value) {
    return String(value).replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  /* Dates are handled as plain strings, never Date objects: "2026-09-19" parsed
     by `new Date()` is UTC midnight and can render as the previous day in a
     negative-offset timezone. Splitting the string cannot drift. */
  function dateParts(iso) {
    const [year, month, day] = String(iso).split('-').map(Number);
    return {
      year,
      month: MONTHS[month - 1],
      monthLong: MONTHS_LONG[month - 1],
      day,
      dayPadded: String(day).padStart(2, '0'),
    };
  }

  function longDate(iso) {
    const p = dateParts(iso);
    return `${p.monthLong} ${p.day}, ${p.year}`;
  }

  function monthDay(iso) {
    const p = dateParts(iso);
    return `${p.month} ${p.day}`;
  }

  function layerDot(layer) {
    return `<span class="atom-dot layer-${layer}" aria-hidden="true"></span>`;
  }

  function atomMeta(atom) {
    return `<div class="atom-foot">${layerDot(atom.layer)}<span>${LAYER_NAMES[atom.layer]} · ${atom.at}</span></div>`;
  }

  /* Themes are subjects, not hashtags. The old screen printed extraction
     bookkeeping as "#recurring #theme #user". */
  function atomTags(atom) {
    return `<div class="atom-tags">${atom.themes
      .map((t) => `<button type="button" class="atom-tag" data-tag="${esc(t)}">${esc(titleCase(t))}</button>`)
      .join('')}</div>`;
  }

  /* Provenance — where this memory came from, so the user can check it. The old
     card showed none of this even though the atom carries the ids. */
  function atomSource(atom) {
    if (!atom.from) return '';
    return `<span class="atom-source">from <em>${esc(atom.from.title)}</em></span>`;
  }

  /** Extraction certainty as a three-segment meter plus its word. */
  function measures(atom) {
    const pct = Math.round(atom.confidence * 100);
    const tier = atom.confidence >= 0.8 ? 'settled' : atom.confidence >= 0.7 ? 'likely' : 'tentative';
    const filled = atom.confidence >= 0.8 ? 3 : atom.confidence >= 0.7 ? 2 : 1;
    const meter = `<span class="meter" aria-hidden="true">${[0, 1, 2]
      .map((i) => `<i class="${i < filled ? 'on' : ''}"></i>`)
      .join('')}</span>`;
    const revisits = atom.revisits > 1 ? `returned ${atom.revisits}×` : 'not yet returned';
    return `<div class="atom-measures">
      <span class="atom-measure">${meter}<span>${tier} · ${pct}%</span></span>
      <span class="atom-measure">${revisits}</span>
    </div>`;
  }

  /** Live summary line. Every number is computed from the atoms, so writing
     something updates it — and "since …" is the one line that says this
     archive has a history. */
  function metaLine() {
    const themeCount = new Set(ATOMS.flatMap((a) => a.themes)).size;
    const earliest = ATOMS.reduce((min, a) => (a.iso < min ? a.iso : min), ATOMS[0].iso);
    return `${ATOMS.length} memories · ${themeCount} themes · since ${monthDay(earliest)}`;
  }

  function search(placeholder) {
    return `
      <div class="search-field">
        <span class="material-symbols-rounded search-icon">search</span>
        <input type="search" class="search-input" data-search
               placeholder="${esc(placeholder || 'Search memories')}"
               aria-label="Search local memory" />
      </div>`;
  }

  /* ==========================================================================
     THE WRITING SURFACE
     --------------------------------------------------------------------------
     This page is where you write freely — no AI in the loop. So the write box
     is the page's primary action, not a footnote below thirty cards.

     WHAT THIS REPLACES: "Notes / [Add a private note…] / Save note / Refresh /
     BLACKROSE NOTICED / 'Themes settle around career pressure…' / Intention ·
     Morning · Balance / Keep this as a note". It was a fake AI feature:

       · "Blackrose noticed" made ZERO LLM calls. generateMemoryNoteSuggestion
         (services/memory/localMemory.ts:611) is a string template that
         concatenates 180 chars of your own memory text and wraps it in canned
         therapy-speak: "You seem to be someone who is navigating a lot right
         now. Rosebud notices you often return to themes of …". That is why it
         read as three sentences jammed together.
       · It still said "Rosebud" — the retired brand — and a test locked the
         string in (__tests__/services/localMemory.test.ts:158).
       · "Refresh" was a no-op: the suggestion is a pure function of the atoms,
         and refresh() already reruns it on every change.
       · "Keep this as a note" did nothing: it saved at layer 'note', which
         topAtoms() then filters out, so keeping it could never affect the next
         suggestion. The loop was closed.

     The honest version: you write, and a local matcher shows how it will be
     filed before you commit. Deterministic, explainable, no model. When it
     recognises nothing it says so instead of inventing an observation. There is
     no Refresh because there is nothing to recompute, and no "Keep this as a
     note" because this IS the note. */

  function deriveThemes(text) {
    const lower = String(text).toLowerCase();
    const scored = [];
    Object.entries(THEME_VOCAB).forEach(([theme, words]) => {
      let hits = 0;
      words.forEach((word) => {
        const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        /* Count occurrences, not just presence — "walked … walk" is a stronger
           signal for movement than one passing mention. */
        const found = lower.match(new RegExp(`\\b${safe}`, 'gi'));
        if (found) hits += found.length;
      });
      if (hits > 0) scored.push({ theme, hits });
    });
    return scored.sort((a, b) => b.hits - a.hits).slice(0, 3).map((s) => s.theme);
  }

  /* A title that is not just the body's first 60 characters — the old
     saveManualMemoryNote did `trimText(trimmed, 60)`, which is why title and
     content read identically on every card. Take the first sentence. */
  function deriveTitle(text) {
    const clean = String(text).trim().replace(/\s+/g, ' ');
    const first = clean.split(/(?<=[.!?])\s+/)[0] || clean;
    if (first.length <= 64) return first;
    const cut = first.slice(0, 64);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 32 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }

  /** Write → memory. New memories land at the top, which is where the ledger
   *  reads from, so a fresh entry appears directly beneath the composer.
   *
   *  `opts.silent` suppresses the change notification. Callers that render
   *  themselves pass it, because notifying here AND rendering in `onKept` would
   *  render twice — and a second render restarts every entrance animation. */
  function addMemory(input, opts) {
    const o = opts || {};
    const body = String(input.body).trim();
    if (!body) return null;
    const themes = (input.themes && input.themes.length ? input.themes : deriveThemes(body));
    const atom = {
      id: `m${Date.now()}`,
      layer: 'note',
      title: deriveTitle(body),
      body,
      themes: themes.length ? themes : ['unsorted'],
      at: 'just now',
      iso: TODAY_ISO,
      score: 7,
      /* You wrote it, so there is nothing to be uncertain about. The old path
         stored manual notes at confidence 1 and generated ones at 0.72. */
      confidence: 1,
      revisits: 0,
      from: { title: 'Written here', kind: 'Note' },
      fresh: true,
    };
    ATOMS.unshift(atom);
    if (!o.silent) notify();
    return atom;
  }

  /**
   * The composer. It shares the ledger's date column, so today's line sits at
   * the top of the same column as every entry below it — the metaphor made
   * literal: you are writing the newest line of this ledger.
   */
  function writeComposer(opts) {
    const o = opts || {};
    const label = o.label || 'New line';
    const placeholder = o.placeholder || 'Write it plainly. No one is reading it.';
    const p = dateParts(TODAY_ISO);
    return `
      <div class="write">
        <time class="write-date is-today" datetime="${TODAY_ISO}" title="Written ${longDate(TODAY_ISO)}">
          <span class="entry-date-month">${p.month}</span>
          <span class="entry-date-day">${p.dayPadded}</span>
        </time>
        <div class="write-main">
          <label class="write-label" for="write-input">${esc(label)}</label>
          <textarea class="write-input" id="write-input" data-write-input
            placeholder="${esc(placeholder)}" aria-label="${esc(label)}"></textarea>
          <div class="write-filed" data-write-filed hidden>
            <span class="write-filed-label">Filed under</span>
            <span class="write-filed-themes" data-write-themes></span>
          </div>
          <div class="write-actions">
            <button type="button" class="write-keep" data-write-keep disabled>Keep it</button>
            <span class="write-privacy" data-write-status>Stays on this device.</span>
          </div>
        </div>
      </div>`;
  }

  /**
   * Wire a composer inside `root`. `opts.onKept(atom)` lets the page react.
   */
  function bindWrite(root, opts) {
    const o = opts || {};
    const input = root.querySelector('[data-write-input]');
    if (!input) return;

    const filed = root.querySelector('[data-write-filed]');
    const themesEl = root.querySelector('[data-write-themes]');
    const keep = root.querySelector('[data-write-keep]');
    const status = root.querySelector('[data-write-status]');
    const privacyText = status ? status.textContent : '';

    /* The textarea grows with the writing, up to a point — a fixed-height box
       makes a long thought feel unwelcome. */
    function autoGrow() {
      input.style.height = 'auto';
      const next = Math.min(input.scrollHeight, 220);
      input.style.height = `${next}px`;
      input.style.overflowY = input.scrollHeight > 220 ? 'auto' : 'hidden';
    }

    /* The live filing preview is the honest replacement for "Blackrose
       noticed": it shows how YOUR words will be filed, before you commit, and
       admits when it cannot tell. */
    function update() {
      const text = input.value.trim();
      keep.disabled = text.length === 0;
      if (!text) {
        filed.hidden = true;
        autoGrow();
        return;
      }
      const themes = deriveThemes(text);
      filed.hidden = false;
      themesEl.innerHTML = themes.length
        ? themes
            .map(
              (t, i) =>
                `<span class="write-theme" style="animation-delay:${i * 50}ms">${esc(titleCase(t))}</span>`,
            )
            .join('')
        : '<span class="write-theme is-none">nothing recognised — it will be kept as written</span>';
      autoGrow();
    }

    input.addEventListener('input', update);

    input.addEventListener('keydown', (event) => {
      /* Cmd/Ctrl+Enter keeps the line without leaving the keyboard. */
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        keep.click();
      }
    });

    keep.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      /* Silent: the caller renders in onKept, and a second render would restart
         every entrance animation on the page. */
      const atom = addMemory({ body: text, themes: deriveThemes(text) }, { silent: true });
      input.value = '';
      update();
      /* Focus stays put so you can keep writing — the page never takes the
         cursor away from you. */
      input.focus();
      if (status) {
        status.textContent = 'Kept.';
        setTimeout(() => {
          status.textContent = privacyText;
        }, 2400);
      }
      if (typeof o.onKept === 'function' && atom) o.onKept(atom);
    });

    update();
  }

  function dock(active) {
    const items = [
      { label: 'Today', icon: 'calendar_today', tab: 'today' },
      { label: 'Threads', icon: 'notes', tab: 'explore' },
      { label: 'Insights', icon: 'graphic_eq', tab: 'insights' },
      { label: 'Archive', icon: 'inventory_2', tab: 'entries' },
    ];
    return `${items
      .map(
        (i) => `<button type="button" class="dock-item" ${i.tab === active ? 'aria-current="page"' : ''}>
          <span class="material-symbols-rounded">${i.icon}</span><span>${i.label}</span>
        </button>`,
      )
      .join('')}
      <button type="button" class="fab" aria-label="New entry"><span class="material-symbols-rounded">edit</span></button>`;
  }

  /* --------------------------------------------------------------- wiring */

  function onChange(fn) {
    listeners.push(fn);
    return fn;
  }

  function bindSearch(root) {
    const input = root.querySelector('[data-search]');
    if (!input) return;
    input.value = state.query;
    input.addEventListener('input', () => {
      state.query = input.value;
      notify();
    });
  }

  function bindLayerControls(root) {
    root.querySelectorAll('[data-layer]').forEach((btn) => {
      const paint = () => btn.setAttribute('aria-pressed', String(state.layer === btn.dataset.layer));
      paint();
      btn.addEventListener('click', () => {
        setLayer(btn.dataset.layer);
        root.querySelectorAll('[data-layer]').forEach((b) =>
          b.setAttribute('aria-pressed', String(state.layer === b.dataset.layer)),
        );
      });
      onChange(paint);
    });
  }

  /* Tag taps filter the list by that theme, the way the real screen does. */
  function bindTagTaps(root) {
    root.addEventListener('click', (event) => {
      const tag = event.target.closest('[data-tag]');
      if (!tag) return;
      setQuery(tag.dataset.tag);
    });
  }

  function mountThemeToggle() {
    const root = document.documentElement;
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.classList.toggle('dark');
        const dark = root.classList.contains('dark');
        document.querySelectorAll('[data-theme-label]').forEach((label) => {
          label.textContent = dark ? 'Dark' : 'Light';
        });
      });
    });
  }

  function mountVariantLabel() {
    const label = document.querySelector('.phone')?.dataset.variant;
    const head = document.querySelector('.page-head');
    if (!label || !head) return;
    const over = document.createElement('span');
    over.className = 'variant-overline';
    over.textContent = label;
    head.prepend(over);
  }

  function mountDock() {
    document.querySelectorAll('[data-dock]').forEach((node) => {
      node.innerHTML = dock(node.dataset.dock || 'explore');
    });
  }

  function boot() {
    mountDock();
    mountVariantLabel();
    mountThemeToggle();
    if (typeof window.BR.mount === 'function') window.BR.mount();
  }

  window.BR = {
    PORTRAIT,
    TODAY_ISO,
    THEMES,
    ATOMS,
    LAYERS,
    LAYER_NAMES,
    state,
    el,
    esc,
    titleCase,
    dateParts,
    longDate,
    monthDay,
    layerDot,
    atomMeta,
    atomTags,
    atomSource,
    measures,
    metaLine,
    search,
    writeComposer,
    bindWrite,
    addMemory,
    deriveThemes,
    deriveTitle,
    matches,
    onChange,
    setLayer,
    setQuery,
    bindSearch,
    bindLayerControls,
    bindTagTaps,
  };

  document.addEventListener('DOMContentLoaded', boot);
})();
