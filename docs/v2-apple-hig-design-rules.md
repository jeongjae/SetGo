# SetGo v2 Apple HIG Design Rules

SetGo v2 UI work should follow Apple's Human Interface Guidelines as the default design contract.

Official reference:

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Text fields: https://developer.apple.com/design/human-interface-guidelines/text-fields
- Toolbars: https://developer.apple.com/design/human-interface-guidelines/toolbars

Apple's documentation site requires JavaScript in the current browser fetch path, so this project document records the practical HIG rules SetGo will apply during implementation. Recheck the official pages in a real browser when making major visual decisions.

## Product Principle

SetGo should feel like a focused iPhone workout tool, not a decorated web dashboard.

The app should prioritize:

- direct manipulation
- immediate feedback
- readable hierarchy
- thumb-friendly controls
- standard iOS mental models
- restrained visual styling
- clear state changes

## Navigation Rules

- Keep workout mode outside the bottom tab bar.
- Use a simple top bar with back, title, live status, and one primary completion action.
- Avoid showing planning, analytics, backup, or library controls inside active workout logging.
- Prefer drill-in screens, sheets, or tucked menus for secondary actions.
- Keep Today focused on the next action: continue, start, or review today's workout.

## Touch Target Rules

- Primary controls should be at least 44px high.
- Icon-only controls must have clear `aria-label` text.
- Destructive controls need physical separation from primary completion controls.
- Do not place tiny adjacent controls where a sweaty thumb is likely to miss.
- Controls used during active lifting should work without precision tapping.

## Button Rules

- Use filled buttons only for the primary action in the current context.
- Use bordered or tinted buttons for secondary actions.
- Use icon buttons for familiar tool actions such as back, add, copy, delete, more, timer, and history.
- Do not use pill-shaped text buttons for actions that have standard symbols.
- Use destructive color only for destructive actions.

## Text Field Rules

- Numeric workout fields must use numeric or decimal input modes.
- Labels must remain visible or obvious while editing.
- Placeholder text cannot be the only way to identify a field.
- Field focus should preserve context and avoid keyboard-covered controls.
- Avoid dense forms during active logging; prefer editable rows.

## Workout Row Rules

The v2 set row should behave like a native logging control:

- always show set number
- show previous or suggested target near the current value
- keep kg, reps, and RIR in stable columns
- make completion state obvious
- keep row height stable when values change
- tuck delete, set type, warmup/drop/failure, and rare actions behind a menu or expanded state
- avoid horizontal scrolling

## Visual Style Rules

- Prefer iOS-like white and system-gray surfaces over heavy gradients or decorative backgrounds.
- Use one clear accent color for positive workout progress.
- Use semantic colors consistently: green/teal for progress, yellow/orange for caution, red for destructive or overreach.
- Keep radii restrained and purposeful; avoid nested cards.
- Use compact hierarchy, not oversized marketing typography.
- Letter spacing should remain 0 except for very small uppercase utility labels already used in the app.

## Feedback Rules

- Completing a set should produce immediate visual feedback.
- Auto-save state should be visible but quiet.
- Rest timer should appear when useful and never hide the next set input.
- Recommendation reasons should be short and attached to the suggested value.
- Undo or edit should remain easy after accidental completion.

## Accessibility Rules

- Preserve semantic button and input elements.
- Use clear focus states.
- Keep contrast high enough for gym lighting.
- Do not rely on color alone for completed, hard, warmup, skipped, or destructive states.
- Respect reduced-motion preferences for any added transitions.

## Implementation Rules

- Add or refactor reusable components before visual redesign when a screen is too large.
- Keep planned, suggested, and actual values visually and structurally distinct.
- Do not introduce an external UI framework unless it clearly improves HIG compliance.
- Browser validation should include an iPhone-sized viewport before merging visual changes.
- Physical iPhone Safari validation is required before declaring a major workout logging redesign complete.
