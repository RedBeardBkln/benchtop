# benchtop Design System

**benchtop** is an R&D formulation-tracking system for food development. It logs formulations, ingredients and trials, and uses AI to help solve hard formulation problems (texture, sugar reduction, shelf life). Audience: food scientists and product developers.

**Sources:** none supplied. Everything here (logo, palette, type, components, app UI kit) was designed from the brief: *logo in DS-Digital (user-supplied LCD font), background = near-neon LCD backlight, tone = nerdy but warm*

## Index
- `styles.css` → imports `tokens/` (fonts, colors, typography, spacing) and `components/components.css`
- `assets/` — logo-mark.svg, logo-mark-lcd.svg, app-icon.svg, app-icon-dark.svg, ghost-segments.svg (tile of unlit LCD segments)
- `guidelines/` — specimen cards (brand, colors, type, spacing)
- `components/` — React primitives (see below)
- `ui_kits/app/` — benchtop app: formulation list, editor with AI suggestion, trials, assistant
- `SKILL.md` — Agent Skill entry

## Components
**core:** Button, Badge, Card, Icon, Logo, SegmentDisplay · **forms:** Input, Checkbox, Switch · **navigation:** Tabs · **feedback:** Tooltip.
Intentional additions: **Icon** (Lucide wrapper) and **SegmentDisplay** (the brand's signature numeral). Not built yet: Dialog, Toast, Select, Radio, Tag (Badge covers tags).

## Content fundamentals
- Voice: a friendly lab-mate. Nerdy-precise, never stiff. First person plural for shared work ("What are we solving today?"), "you/your" for the user, "benchtop" (always lowercase, even at sentence start) for the product.
- Casing: sentence case everywhere. UI labels are mono and may be UPPERCASE with tracking. No Title Case headings.
- Numbers are first-class: always with units, in mono or segment display (`aw 0.62`, `12.4 %`).
- Short, concrete, a little wry: "Bars are coming out crumbly." "Formulation, from bench to label." "Formulas that finally add up."
- AI speaks as a suggestion with reasons and predicted effect, never as an oracle: "Try this: swap 4% glucose syrup for allulose. Predicted aw 0.58."
- No emoji. No exclamation-mark enthusiasm. Light puns on lab/scale vocabulary are fine, once.

## Visual foundations
- **Color:** LCD lime `--lcd-300 #D6F55A` is the hero — the backlight. Ink (green-black `#16200E`) is every "lit segment": text, borders, dark surfaces. Warm paper cream is the page. Tangerine is the sole warm accent (AI, human touches). Semantic colours are muted-natural. Never pure black/white.
- **Type:** Bricolage Grotesque (display + body; quirky, warm, tight tracking −3% on display) DM Mono (labels, data) and **DS-Digital** (segment font for logo/readouts). **Substituted from Google Fonts — no brand fonts supplied.**
- **Backgrounds:** flat paper; hero panels are lit LCD lime with a faint ghost-segment tile (`--ghost-segments`) and inner shadow like a real display. No gradients, photography or illustrations.
- **Borders:** 1.5px ink outlines on interactive/primary surfaces; 1px ink-200 hairlines for dividers.
- **Shadows:** "keycap" hard offset (`3px 3px 0 ink`) for buttons; soft lifted shadow with 2px bottom edge for cards; inset screen shadow for LCD panels; lime glow for lit states (switch on).
- **Radii:** 4/8/12/20/pill. Buttons 8, cards 12, badges pill.
- **Layout:** left ink sidebar (232px) + paper content; generous 24–40px page padding; 4px spacing base.
- **Motion:** quick, snappy (90–280ms, `cubic-bezier(.2,.8,.2,1)`); `steps()` easing reserved for numeric ticking on the segment display. No bounces.
- **Hover:** primary/secondary lift 1px up-left (shadow grows); ghost gains ink-100 fill. **Press:** sinks 2px into its shadow. **Focus:** 3px tangerine ring.
- **Transparency/blur:** essentially none; ghost segments at 7% ink are the only translucency.
- **Imagery vibe:** n/a; if used, warm, slightly desaturated food/lab-bench photography.

## Iconography
Lucide (stroke, 1.5–2px, rounded) via CDN `lucide-static`, rendered through the **Icon** component and tinted by colour. **Substitution — no custom icon set exists.** Icons sit at 18–20px beside text; no emoji, no unicode glyph icons. The seven-segment numeral style is the brand's "iconic" device instead.

## Logo
The mark is a capital **B** and the wordmark is **BENCHTOP**, both typed in **DS-Digital Bold** (`assets/fonts/DS-Digital-Bold.ttf`, supplied by the user; free for all uses) — a 16-segment LCD font. Ink on lime/paper; lime on ink. Static SVGs in `assets/` have the letters converted to outlines, so they render without the font installed. Use `--font-segment` / SegmentDisplay for the logo, hero readouts and short display text only; body and UI text stays Bricolage Grotesque. (A hand-drawn lowercase variant was tried and dropped.)
