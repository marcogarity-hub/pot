---
version: 1
slug: "app-screens-page-tsx"
primary_target: "app/(screens)/page.tsx"
related_targets: []
---

## Direction contract

THESIS: Pot is an ordinary fintech tool (money held, what needs you, your pots, activity) drawn on a visible Crouwel construction grid, and its one idea is that every pot is a row of square cells, one per member, filled when that member's money is locked. It refuses the soft rounded-card wallet dashboard with a green progress bar on beige paper. Governs every screen, not only this one.

OWN-WORLD: White paper (#FFFFFF) over a pale-blue module field (#F4F7FF), ink #0B1020, one electric blue #2B59FF for actions, selection, focus and paid cells, hairlines #C9D4FF. State colours appear only where they carry meaning: amber for waiting, red for frozen, green for released, each as text plus a tinted ground, never colour alone. Zero radius; modules meet on shared 1px hairlines instead of floating shadowed cards; registration "+" ticks mark grid intersections. Archivo at expanded width (wdth 125) for headings and the one big figure, Geist for interface text, tabular figures for money.

STORY: A signed-in member understands in one glance how much money is held, which pots need them and what to do, and trusts it because every filled cell on screen is a real person's locked share. They act on one row, or start a pot, and leave.

FIRST VIEWPORT: 390 and 1440 wide. App bar: "Pot" wordmark, New pot, account. Then the held-in-escrow figure in test USDC at display scale on the grid, with a one-line sentence under it ("3 pots, 1 needs you"). Then a "Needs you" queue of count rows (one action per row, pot name, deadline or window, arrow). Then Start tiles, then your pots as ruled rows with state label, member cells, amount, "You organize". Activity feed as a ruled list: below on phones, a right-hand rail on desktop. The primary action is the first Needs-you row, or Start a pot when nothing needs the viewer.

FORM: Crouwel Grid Specimen (catalog id crouwel-grid-specimen, a declined challenger the user adopted) fused with the canon fintech layout. seed: none (pinned), "I like Crouwel Grid Specifmin the best in terms of aesthetic and design, maybe we can combine that and the classic fintech standard design and layout". World lends type, palette, density and one signature move (member cells); layout and controls stay standard.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
