---
name: Pot Grid
description: Ordinary fintech clarity on a visible construction grid, where every pot is a row of squares, one per member, filled when that member's money is locked.
colors:
  paper: "#ffffff"
  field: "#f4f7ff"
  ink: "#0b1020"
  ink-muted: "#4a5373"
  blue: "#2b59ff"
  blue-deep: "#1740d6"
  blue-wash: "#e6edff"
  blue-mist: "#eaf0ff"
  hairline: "#c9d4ff"
  grid-line: "#dbe3ff"
  input-stroke: "#6f7ba8"
  amber: "#8a5300"
  amber-wash: "#fff1d6"
  green: "#136c3a"
  green-wash: "#ddf4e6"
  red: "#b42318"
  red-wash: "#fde7e4"
typography:
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "6rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 125"
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0em"
rounded:
  none: "0px"
spacing:
  gutter-mobile: "16px"
  gutter-desktop: "24px"
  module-pad: "20px"
  module-pad-wide: "32px"
  hairline: "1px"
  bar-height: "56px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    height: "40px"
    padding: "0 16px"
  button-primary-large:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    height: "48px"
    padding: "0 20px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "40px"
    padding: "0 16px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "0 12px"
  state-label-accent:
    backgroundColor: "{colors.blue-wash}"
    textColor: "{colors.blue-deep}"
    rounded: "{rounded.none}"
    height: "24px"
    padding: "0 8px"
    typography: "{typography.label}"
  state-label-warning:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber}"
    rounded: "{rounded.none}"
    height: "24px"
    padding: "0 8px"
    typography: "{typography.label}"
  state-label-success:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.green}"
    rounded: "{rounded.none}"
    height: "24px"
    padding: "0 8px"
    typography: "{typography.label}"
  state-label-danger:
    backgroundColor: "{colors.red-wash}"
    textColor: "{colors.red}"
    rounded: "{rounded.none}"
    height: "24px"
    padding: "0 8px"
    typography: "{typography.label}"
  member-cell-paid:
    backgroundColor: "{colors.blue}"
    rounded: "{rounded.none}"
    width: "14px"
    height: "14px"
  member-cell-unpaid:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    width: "14px"
    height: "14px"
---

# Design System: Pot Grid

## Overview

**Creative North Star: "The Filled Seat"**

Pot is an ordinary fintech tool: money held, what needs you, your pots, activity. It is drawn on a visible Crouwel-style construction grid, and its one idea is that every pot is a row of square cells, one per member. A cell is filled blue only when that member's money is locked. Everything else in the system exists to make that row readable at a glance and to make the filled cells trustworthy.

The surface is white modules (`paper`) sitting on a pale-blue field (`field`). Modules do not float on shadows. They meet on shared 1px hairlines, and the 12-column grid (4 columns on phones) is drawn as hairlines behind the content, with registration "+" ticks at module corners where the grid intersects. Corners are square everywhere: every radius token resolves to 0. Density is moderate and information-first, with generous padding in modules and tabular figures for money.

The one solid blue is for action, selection, focus and paid cells. State colours (amber for waiting, red for ended or frozen, green for released) appear only where they carry meaning, and each one is a text label on a tinted ground, never colour alone. Heading and figure type is Archivo at expanded width; interface text is Geist.

Confirmed rejections: soft rounded-card wallet dashboards, a green progress bar on beige paper, floating drop shadows as depth, and decorative icons standing in for state.

**Key Characteristics:**
- Square cells as the signature: one per member, filled when locked.
- Visible construction grid: hairlines at 4 (phone) and 12 (desktop) columns, registration ticks.
- Zero radius, modules joined by 1px hairlines, no elevation shadows.
- One electric blue, used for the single primary action and for paid cells.
- State is always text plus a tinted ground.

## Colors

A cool white-and-ink palette with one saturated electric blue. Neutrals are blue-tinted so they sit on the blue field without going grey.

### Primary
- **Electric Blue** (`blue`, #2b59ff): The one solid action per screen (primary buttons, the leading tile in Start a pot), the focus ring, text selection, and the fill of a paid member cell.
- **Deep Blue** (`blue-deep`, #1740d6): Text colour for accent state labels and hover emphasis on blue-wash surfaces.

### Secondary
- **Blue Wash** (`blue-wash`, #e6edff): Secondary button ground, the Funding state label ground, and the hover tint of list rows.
- **Blue Mist** (`blue-mist`, #eaf0ff): Muted ground under the deck of a module.

### Neutral
- **Paper** (`paper`, #ffffff): Every module, the app bar, the footer, and the text colour on solid blue.
- **Field** (`field`, #f4f7ff): The page background behind modules.
- **Ink** (`ink`, #0b1020): Body text, headings, and the big figure.
- **Ink Muted** (`ink-muted`, #4a5373): Secondary text, captions and hint lines.
- **Hairline** (`hairline`, #c9d4ff): Module borders and the dividing rules in lists.
- **Grid Line** (`grid-line`, #dbe3ff): The construction-grid hairlines drawn behind the content.
- **Input Stroke** (`input-stroke`, #6f7ba8): Input borders, the outline of an unpaid member cell, and the struck diagonal on a refunded cell.

### State
- **Amber** (`amber`, #8a5300) on **Amber Wash** (`amber-wash`, #fff1d6): Payout requested, waiting on objections.
- **Green** (`green`, #136c3a) on **Green Wash** (`green-wash`, #ddf4e6): Released.
- **Red** (`red`, #b42318) on **Red Wash** (`red-wash`, #fde7e4): Expired and Frozen, and destructive actions.

Dark mode is opt-in (`.dark` or `data-theme="dark"`) and does not follow the OS setting. It uses a #070b18 field, #0e1530 modules, #7c98ff as the action blue and #eef2ff text. It is shipped but is not the canonical system; new surfaces design in the light set first.

### Named Rules
**The Filled Seat Rule.** A member cell is blue only when that member's money is locked. Blue is never used to decorate a cell that has not paid.

**The One Blue Rule.** The solid electric blue action is used once per screen. Its scarcity is what makes the primary action findable.

## Typography

**Display Font:** Archivo (with system-ui, sans-serif), expanded with the `wdth` axis at 125.
**Body Font:** Geist (with system-ui, sans-serif).
**Label/Mono Font:** Geist Mono, used only inside the registration tick.

**Character:** A wide, squared display face for the wordmark, headings and the one big figure, against a quiet, neutral grotesque for everything you read or tap. Money is set in tabular figures so columns line up and do not jump as a pot updates.

### Hierarchy
- **Figure** (600, 6rem / 96px desktop, 3rem / 48px phone, line-height 1, Archivo wdth 125): The held-in-escrow amount. One per screen, at the top of the dashboard.
- **Display** (600, 3rem / 48px, line-height 1.02, Archivo wdth 125): The signed-out headline and the pot title on desktop.
- **Headline** (600, 1.875rem / 30px, line-height 1.2, Archivo wdth 125): Page titles, such as "Start a pot".
- **Title** (600, 1.125rem / 18px, line-height 1.55, Archivo wdth 125): Section headings like "Needs you" and "Your pots". The base rule gives every h1, h2 and h3 the heading face, so section titles are Archivo as well.
- **Body** (400, 1rem / 16px, line-height 1.5, Geist): Paragraphs. Interface text is 14px (`text-sm`) from md up; keep line length near 65 to 75 characters.
- **Label** (600, 0.75rem / 12px, Geist): State labels and small captions. Sentence case, never uppercase.

### Named Rules
**The Money Is Tabular Rule.** Every amount, count and deadline uses the `money` class (tabular numerals) so figures align and do not shift.

## Layout

A 12-column construction grid on desktop (4 columns on phones), drawn as 1px `grid-line` hairlines behind the `main` element, with content modules covering it. The grid is decorative armature: modules sit on top and the hairlines show only in the gutters and between modules.

Two widths: a narrow reading column (`max-w-xl`, 576px) for forms, and a wide dashboard column (`max-w-6xl`, 1152px). The app bar is 56px high (`h-14`) on a white module. Page gutters are 16px on phones and 24px from md. Content starts 32px down on phones and 48px from md.

The dashboard places the held figure and the Start tiles in an 8 and 4 column split, then the Needs-you queue and your pots in 8 columns with the activity feed in a 4-column right rail. On phones everything stacks, and the activity feed drops below. The pot page uses the same split: the header spans 12, actions and lifecycle take 8, and details and the invite take 4.

Module padding is 20px on phones and 32px from md. Modules are separated by 1px `hairline` gaps (`gap-px` on a `bg-border` parent, or a border on each module), never by margins that open a background.

## Elevation & Depth

No elevation. Modules are flat and separated by 1px hairlines and by the blue field behind them. There are no drop shadows anywhere in the shipped system. The only box-shadow is an inset 3px ring used to mark the current lifecycle stage. Depth is conveyed by hairlines, colour contrast between paper and field, and the grid itself.

### Named Rules
**The Hairline Join Rule.** Modules share an edge and a 1px line. Cards do not float, and no shadow is used to lift one.

## Shapes

Zero radius everywhere. Every radius token resolves to 0 (`--radius: 0rem`), so buttons, inputs, modules, state labels and cells are all square. Form language is hairline borders, filled squares and sharp corners. The recurring silhouette is the square: the PotMark (a 2 by 2 grid of seats with one filled), the member cells, the lifecycle markers and the registration ticks.

## Components

### Buttons
- **Shape:** Square (0 radius). Height 40px (`h-10`) default, 48px (`h-12`) large. 40px is the minimum control height; inputs are 44px (`h-11`).
- **Primary:** Electric Blue ground (`blue`), paper text, 14px semibold, 16px horizontal padding. One per screen.
- **Hover / Focus:** Primary hover darkens the ground with `color-mix(in oklch, var(--primary), black 16%)`. Focus is a 2px `ring` outline with 2px offset.
- **Outline:** Paper ground, ink text, 1px `input-stroke` border. Used for the second action (Sign in, Plan a real booking).
- **Secondary:** Blue-wash ground with accent text, for the quiet choice beside a primary.

### Inputs / Fields
- **Style:** Paper ground, 1px `input-stroke` border, square, 44px high, 12px horizontal padding.
- **Focus:** Border shifts to blue with a 2px blue outline.
- **Error / Disabled:** Destructive border for invalid fields; disabled fields drop to 50% opacity on input-tinted ground.

### State Labels
- **Style:** A 24px square-cornered tinted ground with a 8px square marker and text. Text is mandatory; the marker and ground are reinforcement, never the only signal.
- **Variants:** Accent (Funding), neutral (Locked), warning (Payout requested), success (Released), danger (Expired, Frozen).

### Member Cells (signature)
- **Shape:** One 14px square per active member (32px on the large variant). Cells are laid out in a wrapping grid with 4px gaps.
- **Paid:** Blue ground and blue 1px border.
- **Unpaid:** Paper ground with a 1px `input-stroke` border.
- **Refunded:** Outlined in the input stroke with a diagonal hairline across it, from bottom left to top right. The build draws a diagonal slash, not a horizontal strike-through.
- **Label:** The cell group carries an accessible summary, such as "2 of 4 paid". The text label always travels with the row.

### Lifecycle Ruler
- **Shape:** Four stages (Funding, Locked, Payout requested, Released), each a 16px or 24px square marker. Vertical ruler on phones, horizontal from md. A 1px hairline joins each marker to the next.
- **States:** Done is a solid blue square. Current is a 24px blue square with an inset paper ring. Not reached is a hollow square. An ended stage uses a solid red square and red text.

### Module With Registration Tick
- **Style:** Paper module, 1px hairline border, 20px or 32px padding. The module's top left corner carries a blue Geist Mono "+" at 14px, placed on the grid intersection.
- **Use:** The held figure, and the signed-out hero. The tick is the only place Geist Mono appears.

### Needs-You Row
- **Shape:** A ruled row in a paper module, divided by hairlines. A leading square marker, a bold label, one line of pot name and hint, and a trailing arrow. The arrow is the only directional cue, and the row is the whole tap target.
- **Behaviour:** One action per row. The first row is the primary action when something needs the viewer.

### Start Tiles
- **Shape:** Two tiles in a 1px-gap grid. The first is the blue action tile, shown when nothing needs the viewer. The second is a paper tile with a secondary hover.

## Do's and Don'ts

### Do:
- **Do** fill a member cell blue only when that member's money is locked, and say the count in text beside it (for example "3 of 4 paid").
- **Do** set one solid electric blue primary action per screen (`bg-primary`, `#2b59ff`).
- **Do** pair every state colour with a text label in a `StateLabel`-style tinted ground.
- **Do** keep controls at 40px (`h-10`) minimum, 44px (`h-11`) for inputs, and 48px for the large variant.
- **Do** join modules with 1px hairlines and draw the 4-column (phone) or 12-column (desktop) armature behind content.
- **Do** set every amount, count and deadline with tabular numerals (`money`).
- **Do** use Archivo at wdth 125 for headings and the one big figure, Geist for interface text.

### Don't:
- **Don't** round corners. Radius is 0 everywhere, including on buttons, inputs and modules.
- **Don't** add drop shadows as depth. Modules are separated by hairlines, not lifted.
- **Don't** use colour alone to signal state; a state with no text label is a defect.
- **Don't** use Geist Mono outside the registration tick.
- **Don't** add glyph icons as decoration or as state markers; state is carried by squares, labels and rules.
- **Don't** add eyebrow or kicker labels above headings.
- **Don't** set headings in a system display face.
- **Don't** spend the solid blue on more than one action per screen.

## Not Canonized

This system records the rules above. The following shipped items are defects or drift that are not part of the system and must not be copied:
- Lucide glyph icons (Needs-you tiles, Start tiles, chevrons, copy and check glyphs) and small muted label lines above figures ("Held in escrow", "Example pot").
- Solid blue repeated across several Needs-you tiles and Start tiles at once, which breaks the One Blue Rule.
- The `sm` button size (36px, `h-9`) and its `linkButton` form, which sit under the 40px floor.
- Geist Mono on the explorer transaction link in PotActions, outside the registration tick.
- Unused shadcn-style card, select and textarea primitives with `rounded-lg` and `rounded-xl` classes (resolved to 0 by token, but not built to the system).
