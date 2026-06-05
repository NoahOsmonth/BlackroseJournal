You are a single Codex agent working inside this repository.

Important:
Do not spawn subagents.
Do not delegate to parallel agents.
Do not create reviewer/helper/critic agents.
Do not ask another agent to inspect, implement, validate, or critique.
You must perform the entire workflow yourself in one continuous plan-execute loop.

Do not merely create a plan and stop.
Planning is only a temporary step before execution.
After every plan, execute it.
After every execution pass, inspect the result, critique it, update the plan, and execute again.
Repeat until the stopping criteria are satisfied.

Do not assume or mention the app’s tech stack in your plan. Inspect the repository and use whatever the project already uses.

Mission:
Make the real app match the static designs inside `example-design/` as exactly as possible.

The `example-design/` folder is the source of truth for visual design.

If the current app conflicts with `example-design/`, the `example-design/` design wins.

Do not redesign.
Do not simplify.
Do not approximate casually.
Do not stop at “good enough.”
Do not change the intended static visual design when adding animation.
Animations may improve transitions, loading, and interactions, but the resting/default UI must still match the reference design exactly.

Additional mission:
For now, convert the active app data layer to local-only storage with local backup and restore on the phone/device.

Requirements for local-only data:
1. Disable or bypass remote/cloud database usage for normal app operation.
2. Preserve the existing data model and behavior as much as possible.
3. Store app data locally on the device.
4. Add local backup/export saved on-device.
5. Add local restore/import from an on-device backup.
6. Do not require internet for core app usage.
7. Do not permanently delete remote integration unless necessary.
8. Prefer a clean adapter/repository/data-service layer so remote storage can be restored later.
9. Make local storage the default active provider.
10. Document where local data is stored and how backup/restore works.
11. Avoid destructive migrations.

Online research:
You may search online for libraries, documentation, APIs, examples, or implementation details when needed.

You may add libraries only when they are clearly useful for:
- matching the example design more accurately
- rendering required UI details
- local-only storage
- local backup/restore
- animations
- visual comparison/testing
- screenshots or UI validation

Before adding any dependency:
1. Check whether the repo already has a suitable library.
2. Prefer existing project conventions.
3. Avoid unnecessary dependencies.
4. Explain why the dependency is needed.
5. Make sure it is actively maintained and compatible with the project.

Core loop:
You must keep cycling through this loop:

1. PLAN
   - Inspect current repo state.
   - Inspect `example-design/`.
   - Identify the next highest-impact mismatch or missing implementation.
   - Decide the smallest useful batch of changes.
   - State the concrete files/screens/features you will work on next.

2. EXECUTE
   - Make the code changes.
   - Implement the planned UI, storage, backup, restore, animation, or validation work.
   - Do not stop after planning.

3. RUN
   - Run the relevant commands for the changed area.
   - Use the repo’s actual scripts.
   - Run the app or preview when possible.

4. VIEW / COMPARE
   - Use any available means to view the implemented design and compare it against `example-design/`.
   - Render/open the reference HTML.
   - Render/open the real app.
   - Use simulator, emulator, device preview, screenshots, browser tools, visual inspection, automated UI tools, or screenshot comparison where practical.

5. CRITIQUE
   - Act as a strict UI critic yourself.
   - Compare the actual app against the reference design.
   - Create a mismatch list with severity:
     - Critical: wrong screen, broken behavior, missing major section, wrong structure
     - Major: obvious visual mismatch
     - Minor: small polish difference

6. RE-PLAN
   - Convert all Critical and Major issues into the next implementation plan.
   - Execute that plan immediately.

Repeat this loop until no Critical or Major issues remain.

Initial discovery:
1. Inspect the full repository.
2. Inspect every file inside `example-design/`.
3. Identify all design HTML files, CSS files, assets, images, icons, fonts, scripts, and layout patterns.
4. Identify existing app screens, navigation, components, styling conventions, assets, state management, data access, and storage/database code.
5. Map every relevant design file to the matching app screen/component.
6. Identify missing screens/components that need to be created.
7. Identify which app features currently depend on remote/cloud data.
8. Identify the safest way to switch active data usage to local-only storage.
9. Identify the best way to add local backup and restore on-device.
10. Identify how to run, view, screenshot, inspect, or otherwise visually validate the app.

Initial plan requirement:
Before the first edit, output a concise execution plan:
- design files found
- screen/component mapping
- local-only data approach
- local backup/restore approach
- visual comparison approach
- likely validation commands
- first implementation batch

Then immediately execute the first implementation batch.

Do not stop after the initial plan.

Design extraction:
Extract the exact visual system from `example-design/`:
- layout
- spacing
- alignment
- typography
- font sizes
- font weights
- line heights
- colors
- gradients
- backgrounds
- borders
- border radii
- shadows
- cards
- buttons
- inputs
- forms
- navigation
- icons
- images
- lists
- loading states
- empty states
- error states
- responsive behavior
- press/focus/active states
- animation hints if present

Use the existing project style conventions unless they prevent accurate matching.

If assets from `example-design/` are needed, copy or wire them into the app correctly.

Visual implementation rules:
1. Preserve real app functionality.
2. Preserve existing navigation and user flows unless the design clearly requires adjustment.
3. Replace old visual structure when it conflicts with the reference.
4. Reuse components for repeated design patterns.
5. Remove visual inconsistencies.
6. Do not hardcode fake data where real app data already exists.
7. Do not remove business logic unless replacing it with equivalent local-only behavior.
8. Do not push to git.
9. Do not deploy.
10. Do not make unrelated refactors.

Local-only data implementation:
Convert active app data usage to local-only behavior.

Requirements:
1. Create or update a clear local data layer.
2. Keep data reads/writes working offline.
3. Preserve existing data shapes where possible.
4. Add local persistence.
5. Add local backup export saved on-device.
6. Add local backup import/restore from an on-device backup.
7. Handle backup errors safely.
8. Handle corrupted/missing backup files gracefully.
9. Add loading/error states where needed.
10. Keep the implementation clean enough to reconnect remote storage later.

If existing remote database code exists:
- Do not erase it blindly.
- Prefer isolating it behind an adapter.
- Make local storage the default active provider.
- Keep remote storage disabled or unused in the active runtime path.
- Document where the provider switch happens.

Animation polish:
Add animations only after the static design is matched or while implementing matching components where animation does not interfere.

Animations should improve:
- screen transitions
- loading states
- empty states
- button feedback
- list/card entrance
- modal/sheet transitions
- subtle interaction feedback

Animation rules:
1. The static/resting UI must remain visually identical to `example-design/`.
2. Do not animate in ways that change layout accuracy.
3. Keep animations tasteful, fast, and polished.
4. Respect reduced-motion/accessibility settings if feasible.
5. Avoid heavy animation libraries unless clearly needed.
6. Do not add animation that makes the app feel slower.

Visual comparison requirements:
Use any available means to view and compare the implemented app against `example-design/`.

Use one or more:
- run the reference HTML designs locally
- open/render the static design files
- run the app locally
- use simulator/emulator/device preview
- capture screenshots
- manually inspect visuals
- use automated UI tooling if available
- use pixel/screenshot comparison if practical
- use component previews/story tooling if available
- use any existing test or preview system in the repo

For each mapped screen:
1. Inspect the reference design.
2. Inspect the implemented app screen.
3. Compare carefully.
4. List mismatches.
5. Fix Critical and Major mismatches.
6. Re-run and re-compare.

Critic checklist:
- layout
- spacing
- alignment
- typography
- colors
- gradients
- backgrounds
- shadows
- borders
- border radius
- icons
- images
- cards
- buttons
- inputs
- navigation
- lists
- empty states
- loading states
- error states
- screen transitions
- responsive/device sizes
- safe areas
- scroll behavior
- keyboard behavior
- overall resemblance

Validation:
Run relevant commands discovered from the repository:
- formatting
- lint
- typecheck
- tests
- build
- app startup
- local storage checks
- backup/export check
- restore/import check
- visual/screenshot checks if available

Fix all errors introduced by your changes.

If a failure is pre-existing, document the evidence clearly and continue validating other areas.

Stopping criteria:
Do not stop until all of these are true:
1. Every relevant design file in `example-design/` has been inspected.
2. Every mapped app screen has been implemented.
3. The implemented screens match the reference designs as closely as technically possible.
4. You have actually viewed or rendered the implemented app where possible.
5. You have compared the implemented app against the reference designs.
6. No Critical or Major visual mismatches remain.
7. Local-only storage is the active default.
8. Backup and restore are implemented locally on-device as far as the platform/repo allows.
9. Animations are added where they improve polish without changing the reference design.
10. Validation has been run.
11. Remaining issues are only Minor, pre-existing, or technically unavoidable.

Final response:
Only after the stopping criteria are met, provide:
1. Summary of visual changes.
2. Summary of local-only database/storage changes.
3. Summary of local backup/restore behavior.
4. Mapping of `example-design/` files to implemented screens/components.
5. Files changed.
6. Dependencies added, if any, and why.
7. Validation commands run and results.
8. Visual comparison method used.
9. Final critic result.
10. Remaining minor differences, if any.
11. Anything that could not be matched exactly and why.

Begin by inspecting the repository and `example-design/`.
Produce the initial concise plan.
Then immediately execute the first implementation batch.
Keep planning and executing repeatedly until the stopping criteria are satisfied.w