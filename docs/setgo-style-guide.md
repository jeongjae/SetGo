# SetGo Style Guide

Date: 2026-07-02
Status: Draft v1

## 1. Design Intent

SetGo should feel like a serious iOS-native training log: fast, calm, precise, and easy to scan during a workout. The UI should not feel like a marketing fitness app. It should behave more like Apple Fitness, Health, and a good timer/logging tool: dense enough for repeated use, but visually quiet enough that the user's next action is obvious.

Core principles:

- Clarity first: the next workout, current session state, and actionable warnings must be readable within one glance.
- iOS-native behavior: use familiar iOS spacing, grouped surfaces, bottom navigation, segmented controls, large touch targets, safe-area handling, and subdued feedback.
- Training semantics over decoration: color should communicate action, status, intensity, recovery, or data category. Avoid decorative gradients and random color accents.
- One primary action per screen: each main page should make the most likely next action visually dominant.
- Compact but breathable: SetGo is used between sets and on small screens, so cards should be dense, not cramped.

## 2. External Benchmarks

Apple HIG themes to follow:

- Color should support interactivity, continuity, accessibility, and adaptation across light/dark appearances. Apple recommends using system colors because they adapt well to different backgrounds and accessibility settings.
- Typography should remain legible at different sizes and support Dynamic Type-like scaling. SetGo is web/PWA today, but the design should keep iOS text hierarchy and minimum sizes in mind.
- Layout should prioritize content and familiar platform structure. SetGo already uses a bottom tab bar and iOS-style grouped cards; keep that direction.
- Accessibility requires adequate contrast, scalable text, and tappable controls. The practical minimum target remains 44 x 44 pt for touch controls.
- Workout/Activity references: Apple uses strongly semantic fitness colors, especially for activity progress and workout state. SetGo should borrow the semantic clarity, not copy Activity Rings directly.

Useful references:

- Apple HIG - Color: https://developer.apple.com/design/human-interface-guidelines/color
- Apple HIG - Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple HIG - Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HIG - Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HIG - Workouts: https://developer.apple.com/design/human-interface-guidelines/workouts
- Apple HIG - Activity Rings: https://developer.apple.com/design/human-interface-guidelines/activity-rings
- Apple Support - Activity ring goals: https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios

## 3. Current SetGo UI Assessment

What already works:

- The app uses a narrow mobile-first shell, bottom navigation, safe-area padding, grouped cards, segmented controls, and iOS grays.
- Existing primitives in `src/styles.css` and `src/components/IosPrimitives.tsx` are a useful foundation.
- Status colors already reference iOS-like colors: blue, green, orange, red, purple/indigo.
- The app favors direct manipulation: quick routine start, calendar plan edits, segmented workout type controls.

Main inconsistencies to fix:

- SetGo teal is used as brand, primary action, selected state, success, and routine-plan color. These roles should be separated.
- Many hard-coded hex values are repeated across pages instead of routed through semantic tokens.
- Cards are often too visually similar, so screen hierarchy depends on heavy font weights rather than layout.
- Rounded corners are overused at `rounded-2xl`; compact controls should use smaller radii.
- Several screens mix Apple system blue, SetGo teal, and purple without a clear rule.
- Korean strings in parts of the codebase show mojibake. This is a UX issue, not only a localization issue.
- Calendar states are overloaded: today, selected, actuals, future plan, override, rest, running, skipped, and completed all compete.

## 4. Color System

### 4.1 Recommended Direction

SetGo should use Apple grays and system semantic colors as the base, with SetGo teal as a restrained brand accent. The primary action color should move closer to iOS system blue for universal actions, while teal should mean "training plan / SetGo intelligence / routine signal."

Rationale:

- iOS users already understand blue as the standard action/tint color.
- Teal is valuable as SetGo's identity, but overuse makes every state look equally important.
- Fitness apps benefit from semantic colors: green = completed/recovered, orange = caution/deload, red = destructive/overload, blue = action/current, purple = AI/coach.

### 4.2 Core Palette

| Role | Token | Light | Usage |
|---|---:|---:|---|
| App background | `--sg-bg` | `#F2F2F7` | Root screen background, grouped table background |
| Surface | `--sg-surface` | `#FFFFFF` | Cards, bottom nav, sheets |
| Secondary surface | `--sg-surface-secondary` | `#F5F5F7` | In-card panels, low emphasis regions |
| Separator | `--sg-separator` | `#E5E5EA` | Hairlines and row separators |
| Border | `--sg-border` | `#D1D1D6` | Inputs, secondary buttons |
| Primary text | `--sg-label` | `#1C1C1E` | Main text |
| Secondary text | `--sg-secondary-label` | `#6E6E73` | Subtext, descriptions |
| Tertiary text | `--sg-tertiary-label` | `#8E8E93` | Hints, metadata, disabled labels |
| Disabled fill | `--sg-fill` | `#F2F2F7` | Disabled backgrounds and subtle cells |

### 4.3 Action And Semantic Palette

| Role | Token | Light | Usage |
|---|---:|---:|---|
| Primary action | `--sg-action` | `#007AFF` | Start, save, confirm, current date outline |
| Primary action pressed | `--sg-action-pressed` | `#0062CC` | Active/pressed state |
| Brand / routine | `--sg-brand` | `#2EC4B6` | SetGo brand, routine plan highlights |
| Brand strong | `--sg-brand-strong` | `#159A91` | Brand text on soft teal |
| Brand soft | `--sg-brand-soft` | `#E8F3F3` | Routine selected panel, AI-local insight |
| Success | `--sg-success` | `#34C759` | Completed, ready, in target |
| Warning | `--sg-warning` | `#FF9500` | Deload, fatigue caution, high hard-set ratio |
| Danger | `--sg-danger` | `#FF3B30` | Delete, skipped, injury/overload risk |
| AI / coach | `--sg-ai` | `#5856D6` | Kimi coach, generated insight |
| Running / cardio | `--sg-cardio` | `#007AFF` | Running plan, cardio progress |

Decision: do not use teal as the default primary button everywhere. Use blue for universal app commands and teal for SetGo-specific training-plan commands where brand meaning helps.

### 4.4 Color Usage Rules

- Blue: navigation/action/current state. Examples: "Start workout", "Save", today outline, running.
- Teal: active routine plan, SetGo recommendation, routine selected state.
- Green: completed, recovered, target met. Do not use green for ordinary action buttons.
- Orange: caution, deload, high fatigue, high hard-set ratio.
- Red: destructive, skipped, unsafe state.
- Purple: AI Coach only. Avoid using purple for general "premium" decoration.
- Gray: neutral UI, rest days, disabled controls, secondary metadata.

## 5. Typography

SetGo should use the system font stack and keep the current Pretendard/Noto Sans KR fallback for Korean. The visual style should reduce unnecessary `font-black` use and reserve it for numeric training metrics, current routine names, and primary screen titles.

Recommended type scale:

| Role | Size | Weight | Line height | Usage |
|---|---:|---:|---:|---|
| Large title | 30-34 | 800-900 | 1.05 | Today hero only |
| Page title | 24 | 800 | 1.15 | Main menu pages |
| Section title | 17 | 700-800 | 1.25 | Card headings |
| Body | 15 | 500-600 | 1.45 | Descriptive text |
| Compact body | 13 | 600 | 1.35 | Calendar labels, notes |
| Caption | 11-12 | 700 | 1.2 | Metadata, badges |
| Numeric metric | 20-28 | 800-900 | 1.0 | Volume, set count, readiness |

Rules:

- Avoid negative letter spacing.
- Use uppercase only for short metadata labels.
- Keep Korean labels short and natural; avoid long uppercase-style Korean text.
- Body copy should not be `font-black`.
- Large title should appear only once per screen.

## 6. Layout And Spacing

Baseline:

- Screen horizontal padding: 14-16 px.
- Card padding: 14-16 px for normal cards, 10-12 px for dense workout rows.
- Card gap: 10-12 px.
- Row min height: 44 px.
- Bottom primary action height: 54-56 px.
- Modal/sheet radius: 24 px top corners.

Radii:

| Element | Radius |
|---|---:|
| Page cards | 16 px |
| Inner panels | 12 px |
| Inputs/selects | 10-12 px |
| Segmented control shell | 9-10 px |
| Segment item | 7-8 px |
| Pills/badges | 999 px |
| Bottom sheets | 24 px |

Depth:

- Prefer separators and filled grouped surfaces over heavy shadows.
- Use shadow only for floating elements, bottom nav, sheets, and selected cards.
- Card shadow should be subtler than today: `0 4px 14px rgba(0,0,0,.045)` is enough for most cards.

## 7. Component Standards

### 7.1 Page Shell

Every main menu page should use:

- `ios-screen`
- `IOSPageHeader`
- one `inner-scroll`
- one dominant screen action, if any
- bottom nav visible except during active workout and keyboard-heavy flows

### 7.2 Cards

Cards should represent one decision or one data cluster. Avoid cards inside cards unless the inner element is a repeated list item or a compact metric panel.

Card roles:

- `sg-card`: default white grouped card.
- `sg-panel`: gray in-card panel.
- `sg-state-card`: colored state card for recommendation, warning, or AI coach.
- `sg-row-card`: dense repeated item.

### 7.3 Buttons

Primary button:

- For app-wide action: blue.
- For SetGo routine/recommendation action: teal.
- Minimum height: 44 px, preferably 54 px for bottom CTA.
- Text: command verb + object. Example: "상체B 시작", "저장", "AI 코칭 받기".

Secondary button:

- White surface, gray border, label color `--sg-label`.
- Minimum height: 40-44 px.

Destructive button:

- Red text or red soft background unless the action is final and confirmed.

### 7.4 Segmented Controls

- Use for mutually exclusive modes: routine/running/free, window range, setup tabs.
- Active segment should be white on gray shell, not teal, unless the segment itself controls a training state.
- Minimum height: 36-44 px.

### 7.5 Badges And Pills

Badges should be semantic:

- Hypertrophy/heavy: teal soft.
- Maintenance: green soft.
- Deload: orange soft.
- AI: purple soft.
- Running: blue soft.
- Rest: gray.

Avoid using badges as decoration.

### 7.6 Calendar Cells

Calendar has the highest state density, so colors must be disciplined:

- Selected date: blue filled if navigating/selection is the primary behavior.
- Today: blue outline, no fill unless selected.
- Future routine plan: teal soft fill.
- Future rest: white/gray neutral.
- Future running: blue soft.
- Past completed: green soft.
- Past skipped: red soft.
- Past in-progress/current: blue soft.
- Manual override: small teal corner dot or dashed border, not a fully different color.

Calendar labels must fit in one line or be hidden at very small widths. Do not let routine names resize the cell.

### 7.7 Workout Logging

Workout screen must optimize for speed:

- Current exercise card should be visually distinct.
- Set rows should have stable columns: set no, weight, reps, RIR, done.
- Inputs must remain 44 px touchable even if visually compact.
- Rest timer should use a floating compact bar with clear pause/reset actions.
- Avoid decorative copy during active workout.

## 8. Motion And Feedback

Motion should be short and functional:

- Tap feedback: `scale(0.98)` only.
- Sheet entrance: 220-280 ms.
- Toast: slide/fade, 250-350 ms.
- Progress bars: 300-500 ms.
- Avoid repeated pulsing except active timer/current workout state.

Haptics:

- Selection haptic for tab/segment changes.
- Success haptic for workout save/complete.
- Warning haptic only for destructive confirmation or timer completion.

## 9. Accessibility Rules

- Touch targets: at least 44 x 44 px.
- Input font size: at least 16 px to prevent iOS zoom.
- Body text contrast target: WCAG AA level where possible.
- Do not rely on color alone; combine color with icon/label.
- Support Korean text expansion. Buttons must not clip long labels.
- Focus-visible outline should use action blue or brand teal consistently.
- Avoid tiny `10px` text except tab labels and metadata that is not critical.

## 10. Main Menu Screen Guidance

### 10.1 Today

Primary job: answer "What should I do now?"

Recommended structure:

1. Compact date and app title.
2. Active routine + today plan state.
3. Up Next card with plan, reason, recovery warning, and exercise chips.
4. Optional AI Coach as collapsed/secondary module, not always competing with the plan.
5. Workout type selector.
6. Bottom CTA.

Problems to address first:

- Up Next card has too many nested modules.
- AI coach, deload warning, cardio progress, planned exercises, and next-routine selector all compete.
- Teal is overused.
- Some Korean strings are mojibake in source and need cleanup.

### 10.2 Routines

Primary job: manage the active routine and its cycle.

Recommended structure:

1. Active routine summary.
2. Routine day horizontal selector.
3. Exercise plan list.
4. Cycle editor as a separate mode with clear "start date is only for cycle alignment" helper text.
5. Calendar review opens at today by default.

Problems to address:

- Routine setup, exercise library, and cycle editing currently share too much visual weight.
- Start date needs clearer wording so users do not think it should update daily.
- Calendar review should clearly show "today" and "cycle follows saved start date."

### 10.3 Records / Calendar

Primary job: inspect and edit actual workout records.

Recommended structure:

1. Calendar overview.
2. Selected date summary.
3. Workout cards by session.
4. Edit/add actions.

Problems to address:

- Plan calendar and actuals calendar share similar visual language.
- Past/future state distinction should be more obvious.

### 10.4 Insights

Primary job: explain training load and recovery.

Recommended structure:

1. Readiness / recovery summary.
2. Key metrics.
3. Muscle balance.
4. Action recommendation.
5. Details collapsed by default.

Problems to address:

- Many metrics use similar card treatment.
- The page needs stronger prioritization: "what matters today" before charts.

### 10.5 More

Primary job: settings, export, AI endpoint, data tools.

Recommended structure:

1. Account/app settings group.
2. AI Coach configuration.
3. Data import/export group.
4. Diagnostics/about group.

Problems to address:

- Use iOS grouped list rows consistently.
- Dangerous or irreversible data actions need a separate danger zone.

### 10.6 Workout

Primary job: log sets quickly under fatigue.

Recommended structure:

1. Sticky workout header with timer/state.
2. Current exercise cards.
3. Stable set input rows.
4. Floating rest timer.
5. Bottom add/finish actions.

Problems to address:

- Some controls are dense but not visually aligned to a stable grid.
- Active workout state should be more readable at a glance.

## 11. To-Be Design Directions

These are not implementation choices yet. Pick one direction before visual mockup or code changes.

### Direction A: Native Utility

Closest to Apple Settings/Fitness:

- Mostly white grouped cards.
- Blue primary actions.
- Teal only for routine plan identity.
- Minimal shadows.
- Best for reliability and long-term consistency.

Recommended for SetGo v1 polish.

### Direction B: Training Dashboard

More data-forward:

- Today card is a compact dashboard with plan, readiness, volume, and warning tiles.
- Stronger numeric hierarchy.
- Slightly denser cards.
- Best for advanced lifters who care about stats.

Risk: can become visually busy.

### Direction C: Coach-Led

More guidance-forward:

- Today starts with a recommendation narrative.
- AI Coach and recovery warnings are more prominent.
- Plan controls are secondary.
- Best if SetGo's future identity is "intelligent coach."

Risk: logging speed may suffer if coaching content occupies too much space.

Initial recommendation: Direction A as the system baseline, with Direction B patterns for Insights and Workout. Keep Direction C limited to AI Coach modules.

## 12. Implementation Order

Phase 1: Style foundation

- Add semantic CSS variables in `src/styles.css`.
- Update Tailwind color aliases to map to semantic SetGo tokens.
- Replace repeated hard-coded hex values in shared primitives first.
- Create reusable variants: card, panel, state card, primary/secondary/destructive buttons, badge.

Phase 2: Today

- Refactor Today into clearer modules.
- Make Up Next the single dominant card.
- Move AI Coach into a compact expandable/action module.
- Separate action blue from routine teal.
- Fix mojibake strings touched during the refactor.

Phase 3: Routines and Plan Calendar

- Clarify start date wording.
- Normalize cycle editor controls.
- Apply calendar state color rules.
- Improve date-cell density and legends.

Phase 4: Workout

- Stabilize set row grid.
- Improve active exercise hierarchy.
- Clean floating rest timer and bottom actions.

Phase 5: Insights and More

- Prioritize readiness/action panels.
- Reduce chart/card visual noise.
- Standardize grouped settings rows.

## 13. First Code Targets

Recommended first PR:

- `src/styles.css`
- `tailwind.config.js`
- `src/components/IosPrimitives.tsx`
- `src/app/AppBottomNav.tsx`

Why this first:

- It creates shared tokens without changing business logic.
- It reduces future screen-by-screen churn.
- It gives every later page refactor a stable vocabulary.

Recommended second PR:

- `src/pages/TodayPage.tsx`
- related Today tests if needed

Why second:

- Today is the highest-value screen.
- It currently carries the most UI hierarchy conflicts.
- It will validate the style guide against real product complexity.

