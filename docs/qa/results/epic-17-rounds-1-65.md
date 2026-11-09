# Epic #17 - round log, older rounds

Moved out of the Kaneo card on 2026-11-09 (round 69) because the card reached 16.5k
of a ~20,000 character cap and the newest note would have been silently truncated.
The card keeps the newest round; this file keeps the rest, unedited. Newest first,
same as the card. Rounds 68 and 67 were re-summarised from docs/qa/results/run72.md
and run71.md after a bad split dropped them.

## ROUND 68 - every photo is browsable (cfa740f)

- Fourth card in the photo thread: stored (#106), shared (#107), viewable (#108),
  findable (#109). A photos screen orders newest first from a tiny index so it
  never reads photo bodies to sort.
- The index self-heals both ways: a lost row is rebuilt from the photo keys, a row
  whose photo is gone is dropped. It cannot hide a photo or show a blank cell.
- Three real bugs were caught by tests before commit: wrong account id in the index
  write, the account prefix stripping a leading @ so repairs never matched, and an
  early return that trusted the index when the disk was empty.
- Needed getAllKeys on the account adapter, scoped to one account by construction.
## ROUND 67 - the photo opens full screen (d0996a3)

- Third card in the photo thread: the frame is the button, so there is no hidden
  expand icon. Close is 96x44 in the safe area; Escape closes on web.
- The scrim closes it but carries no accessibility label: two controls both named
  Close the photo is a screen-reader smell, and a test caught the duplicate.
- Live QA asserted the trap that bit an earlier round: a closed RN-Web Modal stays
  in the DOM, so the check is pointer-events none on an ancestor, not absence.
## ROUND 66 - the photo now appears on the shared card (c1819f2)

- #106 shipped the photo but left it out of the export. Now the card draws it
  above the words, clipped to rounded corners, with the card growing by exactly
  the photo plus a gap. A portrait is capped at 640px so it cannot crowd out the
  text. No photo means byte-identical output to before.
- Proved with pixels, not markup: a solid rgb(200,40,90) photo exported a
  1080x1367 PNG that samples back to rgb(201,40,90) inside the photo block.
- Both cards on this axis (#106, #107) came from checking a stated blocker and
  then closing the loop it opened rather than moving on.
## ROUND 65 - an entry can carry a photo (8a6b2ab)

- #8 was parked as "needs a native add-on". expo-image-picker was already a
  dependency and works on web, so the lockfile stayed untouched. Second card in
  two rounds where the stated blocker did not survive a check.
- One photo per entry, downscaled to a 1200 px longest edge and re-encoded at
  0.72 before storage, in its OWN key per entry - never on the entries
  collection that every screen reads.
- Over 900 KB is refused with a sentence and nothing is written.
- Live QA: renders 350x233 on screen, removes cleanly, stays gone after reload.
- Not done and written down: the photo is not in the share export yet.
## ROUND 64 - PNG export without the dependency everyone assumed (2c34246)

- #54 was parked because rasterising needs a native capture library. On web the
  browser already rasterises: SVG -> Image -> canvas -> PNG data URL, 1080 wide,
  no new dependency and no lockfile change.
- PNG is tried first (chat apps do not preview SVG); SVG remains the fallback, so
  a phone loses nothing. Null is the contract, not an error.
- Verified in the real browser: a real entry produced a 1080x764 PNG with 113
  distinct tones and about 100 KB - real text, not a blank canvas.
- The phone half is tracked as #105, not hidden in a done card.
## ROUND 63 - a month now has a shape (3f1f60b)

- Shipped #104: the last thirty days as a strip on the day-feeling card. One bar
  per day, single lighter -> heavier ramp, gaps kept as faint outlines, and every
  bar carries its own words so it is never colour-only.
- Measured my own output and found two defects: the palest ramp step was almost
  the empty-bar hairline (a "Light" day looked like a gap), and the strip had a
  second subscription that drew it empty for a frame. Both fixed and re-measured.
- Ten new colour tokens, both schemes. No new storage key.
- Remaining board work is native-only (#7, #8, #9, #53, #54), which stays blocked
  on the native add-on decision.
## ROUND 62 - the card now says what it is looking at (0459f09)

- Re-ran the touch-target audit across 12 routes x 2 schemes: CLEAN (0 unnamed,
  0 low-contrast, 0 overflow). The UI layer held up after rounds 55-56.
- Closed #102 as WRONG-PREMISE rather than keeping it as an excuse: the seed does
  not write atoms one at a time, saveJournalEntryMemories already batches per
  entry, so the 16 loads are 16 legitimate operations.
- Shipped #103: the day-pattern card said "4 days" with no period, and a month
  was the only lens. Now "Looking at the last four weeks", with a three-month
  lens that is a view choice (no new storage key) re-counting through the same
  pure function so evidence rules cannot differ.
- Verified live in both schemes with a seeded profile where the pattern only
  exists 40 days back: four weeks stays silent, three months names Movement.
## ROUND 61 - sixteen concurrent memory loads become one (25ef1cc)

- Traced with a Playwright probe on Storage.prototype.getItem: a cold boot made
  16 CONCURRENT loadMemoryStore calls 1-6 ms apart, each reading the header plus
  8 shards. There was no cache at all.
- Settled cache validated by the header read alone (the cheap freshness check);
  the naive version broke the corrupt-payload and backup-round-trip contracts,
  which caught it correctly.
- Header trust alone did NOT reduce the count: all 16 loads start before any
  finishes. Shared-promise coalescing is what collapses them.
- Pinned: 16 concurrent readers cost <=10 storage reads (was 144), sabotage-verified.
- Honest limit: the bench still reads 193 because the demo seed writes atoms one
  at a time. Follow-up card created to batch the seed so the bench can measure.
- QA record: docs/qa/results/2026-11-09-run65.md
## ROUND 60 - one proven read removed, one cache reverted (55e1b8d)

- Bench baseline: a cold mount costs ~370 storage reads, same keys ~30x each
  (goals 30, local_memory 31, memory_manifest 26, day_digests 23).
- Shipped: useGoalsContext dropped its duplicate goals subscription. One goals
  write now costs 2 reads instead of 3; pinned by a read-count test and
  sabotage-verified.
- Reverted: a settled-read cache in the account adapter. 20 suites went red
  because 8 direct AsyncStorage writers bypass the adapter, so a read after
  their write is not freshly guaranteed. This is round 32 relapse, not new.
- Dead end recorded: a client-side remount measures 0 duplicate reads. The 30x
  is a cold-boot cost only.
- Card #101 stays in-progress: #370 reads/cold mount is still open.
## ROUND 59 - the pattern where the day is recorded (7f4ca02)

- Round 58 sentence now also shows under the feeling row on Today, only when a
  lean exists, from the same hook - Today can never outrun Insights.
- Placed below the chips so an appearing line cannot shift a chip mid-tap.
- Probe lesson: theme key is user-theme-preference, default DARK. A guessed key
  makes both schemes look the same and fakes a dark-mode bug.
- QA record: docs/qa/results/2026-11-09-run64.md
## ROUND 58 - reading the day feelings back (0fc5a4d)

- The store from round 57 now pays off: an Insights card that names what leans to
  lighter days and what leans to heavier ones.
- The rules are the feature: 4-day minimum, a clear lean required (>=60% vs <=34%),
  counts not percentages, unlabelled days skipped, card hidden until it can speak.
- QA trap found the hard way: the account-scoped adapter DROPS the leading @, so the
  real key is @blackrose_account:v1:<acct>:blackrose_day_moods. Hand-seeded
  ":day_moods" reads as a broken feature. Seed against a key the app wrote itself.
- QA record: docs/qa/results/2026-11-09-run63.md
## ROUND 57 - the writer says how the day felt (88c7d10)

- First feature round after the QA sweep. The app had no human-read mood signal:
  analysis.mood is AI-derived, check-in mood is set by a completion path.
- New @blackrose_day_moods store (one record per calendar day, versioned, locked,
  safe parse) + a quiet optional Today row: 5 feelings, 10 causes, cap 6.
- Two self-inflicted bugs caught by tests: a mount read that clobbered a fast tap,
  and accessibilityState.selected that RN-Web does not map to aria-selected.
- QA lesson: a test wrote straight to the adapter map and passed for the wrong
  reason; the real key is account-scoped. Assert the row exists before asserting
  on its contents.
- Next feature step: aggregate the store in Insights.
## ROUND 56 - entry detail, chat, and a border colour used as text (38fbf5e)

- Extended the sweep to 12 routes x 2 schemes: entry detail and chat needed a real
  record, so the probe now resolves the account-scoped sharded journal key.
- Found the round headline: /streak-view weekday captions used the hairline border
  token as text -> 1.2:1 light, 1.4:1 dark, invisible in both schemes. Now a text
  token; 7 -> 0 on re-measure.
- Chat attach-photo and read-aloud were 22px glyphs with 8px slop = 38px, the two
  most-tapped controls in the app. Now 46px.
- Guard closes the class: no text-hairline-* anywhere in app/ or components/.
- QA record: docs/qa/results/2026-11-09-run62.md
## ROUND 55 - measured QA sweep (f44584c)

- Checked the research list against the code before building: prompt packs with a
  progress meter, the multi-year On This Day, Cast of Characters and the mood chart
  ALL already ship. The gap is quality, not feature count.
- Built scripts/qa/touch-targets.mjs: 5 routes x 2 schemes at 390x844, reporting
  sub-44px pressables, unnamed buttons, sub-3:1 text, horizontal overflow, page errors.
- Clean across all ten combinations: 0 unnamed, 0 low contrast, 0 overflow, 0 errors.
- Fixed 5 real targets (12px tag chips, 24px rows, 22px link, 27px goals row, dock slop).
- The probe failed its own self-test first - an unvalidated zero is not evidence.
- QA record: docs/qa/results/2026-11-09-run61.md
## ROUND 54 - pick every entry on screen (#93, #94, 3fde962)

- #93: the pick bar explains a hidden Remove (These entries do not share a label), so a
  selection that agrees on nothing no longer looks like a broken button.
- #94: All / None picks exactly the rows on screen. Bulk labelling was possible since
  round 52 but did not scale past a handful of entries.
- The Archive was at 448/450 lines, so the picker moved to
  hooks/journal/useEntryPicker.ts: the screen went 448 -> 436 WHILE gaining the feature.
- Competitor research (2025-2026, local-only only) is card #95. Top gaps: prompt packs
  with a progress meter, mood influence factors, full multi-year On This Day, entry
  templates, weekly review with a people index.
- QA record: docs/qa/results/2026-11-09-run60.md
## ROUND 53 - take a label off many entries (#92, 381d39d)

- The pick bar offers Remove, listed only for labels EVERY picked entry shares. A label
  only some of them carry would make the sheet sentence a lie ("off 5 entries", reaching 3).
- removeEntryTagFromMany: one read, one write, one notification; an entry losing its last
  label loses its key.
- The sheet gained a mode instead of a sibling sheet: Archive stayed at 448 lines and there
  is still one keyboard contract to keep.
- 2 sabotages red->green (per-entry writes; non-mutual labels offered).
- Live QA finding worth keeping: picking entries that do NOT all share the label hides
  Remove entirely (observed: 5 picked, one unlabelled -> no action, nothing changed).
  Filtering to the label first then picking is the honest path.
- QA record: docs/qa/results/2026-11-09-run59.md
## ROUND 52 - pick several entries and label them at once (#91, 462c2cc)

- Archive Pick mode: a tap picks an entry instead of opening it; a bar above the dock
  shows the count with Add label and Done.
- addEntryTagToMany: one read, one write, one notification for the whole batch. Tagging
  12 entries one by one would have been 12 read-modify-write cycles on one storage key.
- The narrowing chain (search -> starred -> topic -> label -> mood -> day) moved to
  useArchiveFilters; the screen is 442 lines after gaining the mode.
- 5 existing wiring guards failed when the chain moved - that is what they are for - and
  were retargeted at the hook so the invariant stays pinned.
- 2 sabotages red->green (per-entry writes; chips built from the whole feed).
- Trap recorded: a closed RN-Web Modal stays in the DOM with pointer-events:none, so
  "is it still open?" must check inertness, not presence.
- QA record: docs/qa/results/2026-11-09-run58.md
## EPIC: ProductOps full-cycle UX/QA improvement

Per-round detail lives in the repo under docs/qa/results/ - that is the
authoritative log. This card keeps the newest rounds in full plus a compact
index so the sequence is readable without opening 58 files.

> Note (2026-11-09): this description was overwritten by a bad read while
> prepending round 51, which dropped the older narrative. It was rebuilt from
> the repo QA records. Nothing was lost from the repo.
## ROUND 51 - remove a label for good (#90, ca7acdb)

- The rename sheet now offers Delete this label, behind a plain-language confirm.
- It touches every entry that used the label, so it asks first (webConfirm; Alert.alert is
  a silent no-op on web and would have made Delete look broken).
- An entry left with no labels loses its key, so no empty label appears.
- Live QA: shared label removed from both entries, emptied key gone, other label intact,
  answering No changed nothing, danger action 48px and readable in dark mode.
- 2 sabotages red->green. One guard is redundant because writePayload already drops empty
  arrays - recorded as unsabotageable instead of claimed as proven.
## ROUND 50 - rename a label without retyping it (#89, d48ea9b)

- Picking a label shows a Rename chip; the sheet prefills the name and renames it everywhere.
- Typing an existing name merges instead of creating a twin; the filter follows the new name.
- BUG: merging stored two copies of the same label. The reader de-duplicated on parse, so the
  API looked right and tests passed while saved data and backups carried the duplicate.
  writePayload now normalizes on the way in, so every write path heals.
- BUG: the tag hook read before subscribing, so a write in that gap was clobbered.

## Earlier rounds (newest first)
- run 49 - 
- run 48 - cut duplicate cold-mount storage reads
- run 47 - mood chips in the Archive (find entries by how it felt)
- run 46 - a full On This Day view (every past year)
- run 45 - topic chips in the Archive (2026 checklist item 6)
- run 44 - a gentle writing goal (streak that survives rest days)
- run 43 - a month in review (first round with real 2026 online research)
- run 42 - zoom-in QA on the year grid: readable squares + tap to read
- run 41 - A year of writing + Clear History fix
- run 40 - New feature: starred entries
- run 39 - Correcting run 38: the 4x journal reads were a cold-boot burst
- run 38 - Today loads the whole journal four times per tab switch
- run 37 - Settings numbered two sections "03" and skipped "04"
- run 35 - the Archive header claimed a filter the screen never applies
- run 34 - the mood strip showed last week's days under this week's label
- run 33 - the weekly-report gate still called check-ins "entries"
- run 32 - the memory portrait called tags "themes", and stopped counting at 99
- run 31 - the Writing stats tile counted check-ins as entries
- run 30 - the first-launch seed was calling the AI on every cold mount
- run 29 - chasing the cold-mount storage reads (no change shipped)
- run 28 - the journal index was read twice on every list (#58)
- run 27 - a guard for the repo's most common colour bug (#56)
- run 26 - pick a letter's unlock day instead of typing it (#51)
- run 25 - a failed read no longer looks like an empty journal (#55, #25)
- run 24 - recurring themes across weeks (#25)
- run 23 - retry once when the AI writes nothing (#50)
- run 22 - share an entry as an image (#14)
- run 21 - reminders, part one (#9)
- run 20 - prompts that follow you (#52)
- run 19 - guided prompts (#13)
- run 18 - the bench was measuring the wrong thing (#49)
- run 17 - letters to your future self (#11)
- run 16 - light mode, and a black border that should not have been there
- run 15 - what kept coming back this week (#10)
- run 14 - a turn that ends with no words
- run 13 - task extraction, verified live
- run 12 - tasks pulled out of an entry
- run 11 - Threads cold mount
- run 10 - 
- run 9 - 
- run 8 - 
- run 7 - 
- run 6 - 
- run 5 - 2026-11-08 (goal round 1)
- run 4 - 
- run 3 - 
- run 2 - 
- run 1 -