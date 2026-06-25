# SetGo v3 UIUX Polish Plan

Date: 2026-06-25

## Objective

Raise v3 UI quality against Apple Human Interface Guidelines without changing the core information architecture.

The pass focuses on clarity, alignment, touch comfort, keyboard behavior, safe areas, and trustworthy local-data flows.

## HIG-Aligned Principles

- Keep primary tasks visible and direct.
- Preserve at least 44px touch targets for tappable controls.
- Use consistent rows, columns, and spacing so labels and controls scan as one system.
- Avoid surprising automatic scroll when the field is already visible.
- Respect safe areas and bottom bars so content is not hidden behind timers or footers.
- Use system-like contrast, grouped surfaces, and restrained elevation.
- Prefer icon buttons for tool actions, with accessible labels.

## Current Priority Fixes

1. Workout set rows
   - Align the header grid and set row grid.
   - Keep weight, reps, RIR, and done controls vertically centered.
   - Avoid placeholder text that looks like a real value.
   - Keep second-row chips at one consistent height.

2. Bottom workout controls
   - Reserve enough scroll padding when the floating rest timer is active.
   - Keep the finish summary readable above the timer/footer.
   - Keep footer actions stable and inside the safe area.

3. Cardio/running inputs
   - Keep labels directly above controls.
   - Maintain equal stepper heights and consistent +/- placement.
   - Keep Save copy short.

4. More / Export / Import
   - Keep backup, settings, exercise CSV, and activity CSV as separate grouped sections.
   - Keep validation errors local to the relevant import surface.

5. Responsive verification
   - Check 375, 390, and 427px mobile widths.
   - Confirm no horizontal overflow beyond 1px.
   - Confirm no framework overlay or relevant console errors.

## Completed In This Pass

- Replaced the large `kg` empty-weight placeholder with a neutral numeric placeholder.
- Added tabular numeric styling to set input fields for steadier column alignment.
- Increased workout scroll-area bottom padding while the floating rest timer is visible.

## Remaining Watch Items

- Physical iPhone home-screen PWA validation still requires real-device confirmation.
- Korean text encoding in older roadmap/doc strings should be cleaned in a separate documentation-only pass.
- Future screenshots should include a cardio-only workout state and a populated Exercise Finder modal.
