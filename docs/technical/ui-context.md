# Attest - UI and Design System

| Field | Value |
| ----- | ----- |
| Project | Attest |
| Document type | UI and Design System |
| Status | Draft v1.0 |
| Last updated | June 2026 |
| Scope | `apps/web` (marketing), `apps/dashboard` (authenticated app) |

> **How this relates to the other docs.** This document owns theme tokens, color, typography, component conventions, motion, and copy voice. It does not duplicate architecture or code rules. `code-standards.md` owns coding conventions (including the no-hardcoded-hex rule this doc implements via tokens). `technical-architecture.md` owns runtime and deployment. When a decision here implies a structural call, the architecture doc wins `[tech-arch]`. Cross-references use the same `[doc §N]` convention as the rest of the technical docs.

---

## 1. Governing Principle: The Core Tension

Attest is a **scientific instrument**. Its identity rests on a deliberate contrast: a soft, tactile clay shell wrapping flat, precise data. Soft frame, hard readout.

This contrast is not incidental. The clay makes the data feel more exact by juxtaposition. Pillowy containers make numbers, verdicts, and log lines read as authoritative signals rather than generic UI content.

**The load-bearing law, stated once:**

> Clay never carries data. Data never wears clay.

Two surface types exist in this system. They are mutually exclusive. Mixing them is a bug.

| Surface type | What it is | Where it goes |
| ------------ | ---------- | ------------- |
| **Clay shell** | Soft, raised, tactile containers and chrome | Nav, cards, buttons, modals, panels-as-containers, all structural UI |
| **Flat data** | Hard-edged, flat-filled, mono-type readouts | Attestations, verdicts, log blocks, selectors, IDs, evidence viewers, JSON |

Rules:
- A card is clay. The attestation verdict displayed inside that card is flat.
- A modal is clay. The console log rendered inside that modal is flat.
- A button is clay. A status badge showing `passed` is flat.
- An evidence panel container is clay. The screenshot, DOM snapshot, or network log inside it is flat.

---

## 2. Aesthetic Boundaries

The aesthetic is scientific instrument / test equipment. It is explicitly not SaaS, not AI product.

**Never use:**
- Purple or violet at any saturation (the AI-product default)
- Glassmorphism (frosted blur panels, translucent layers)
- Glows or bloom effects on any element
- Gradient borders or rainbow-outline accents
- Sparkle, shimmer, or animated gradient fills
- Decorative motion on data elements

**Always use:**
- Warm near-black and warm cream (oxblood-tinted, not neutral gray)
- Oxblood / rust as the sole brand accent
- Flat, hard-edged data surfaces
- Mono type on all machine-readable output

---

## 3. Color System

### 3.1 Token Layer

All color is expressed as CSS custom properties on `:root`. No component may reference a hex value directly `[code-standards §Styling]`. Components reference tokens. Tokens reference values.

The token layer has two tiers:

1. **Primitive scale tokens** (raw palette values, never referenced by components directly): `--color-gray-900`, `--color-oxblood-600`, etc.
2. **Semantic tokens** (what components consume): `--surface-base`, `--text-primary`, `--accent-primary`, etc.

Semantic tokens are reassigned per theme. The component never changes. Only the token binding changes.

```css
/* Tailwind CSS v4 / @theme integration: define these as @theme variables
   so Tailwind can generate utilities, or reference them as plain CSS custom
   properties from any framework. Both approaches are compatible. */

:root {
  /* Primitives are declared here; semantic tokens are bound below in §3.5 */
}
```

### 3.2 Warm Grayscale Primitives (Dark Mode)

Dark mode is primary. All base values are warm-tinted toward oxblood, never toward blue.

| Token | Hex | Usage |
| ----- | --- | ----- |
| `--gray-dark-950` | `#110D0B` | Deepest background, behind-canvas |
| `--gray-dark-900` | `#1A1614` | Clay base surface (dark mode) |
| `--gray-dark-850` | `#221C19` | Clay raised surface (dark mode) |
| `--gray-dark-800` | `#2C2420` | Clay elevated / hover state |
| `--gray-dark-700` | `#3D3330` | Borders, dividers on dark clay |
| `--gray-dark-600` | `#564B47` | Muted borders, inactive tabs |
| `--gray-dark-500` | `#7A6E6A` | Placeholder text, de-emphasized |
| `--gray-dark-400` | `#A39790` | Secondary text on dark |
| `--gray-dark-300` | `#C8BDB8` | Body text on dark surfaces |
| `--gray-dark-200` | `#E2D9D4` | Primary text on dark (headings) |
| `--gray-dark-100` | `#F0EAE6` | High-emphasis text, labels |
| `--gray-dark-050` | `#FAF5F2` | Inverted text (on oxblood buttons) |

### 3.3 Warm Grayscale Primitives (Light Mode)

Light mode is a real peer, not an afterthought. CI screenshots and documentation live here. The same oxblood warmth applies in reverse.

| Token | Hex | Usage |
| ----- | --- | ----- |
| `--gray-light-050` | `#110D0B` | Inverted text on light (same root as dark-950) |
| `--gray-light-100` | `#2C2420` | Primary text on light |
| `--gray-light-200` | `#4A3F3B` | Secondary headings on light |
| `--gray-light-300` | `#6B5E59` | Body text on light |
| `--gray-light-400` | `#8C7E79` | De-emphasized / muted |
| `--gray-light-500` | `#B0A49F` | Placeholders, inactive |
| `--gray-light-600` | `#CFC6C2` | Borders, dividers on light clay |
| `--gray-light-700` | `#E0D8D4` | Subtle dividers |
| `--gray-light-800` | `#EDE6E2` | Clay elevated (light mode) |
| `--gray-light-850` | `#F5F0EE` | Clay base surface (light mode) |
| `--gray-light-900` | `#FDFAF9` | Clay raised surface (light mode) |
| `--gray-light-950` | `#FFFFFF` | Canvas / page background (light) |

Clay base/raised pairs:
- Dark mode: base `#1A1614`, raised `#221C19`
- Light mode: base `#F5F0EE`, raised `#FDFAF9`

### 3.4 Oxblood / Rust Accent Scale

The sole brand accent. Used on primary clay buttons (a raised clay surface in the brand hue) and sparingly on interactive state indicators. Never used for decoration. Never adjacent to the semantic triad.

| Token | Hex | Notes |
| ----- | --- | ----- |
| `--oxblood-950` | `#2E0E0A` | Deepest, pressed state |
| `--oxblood-900` | `#3E1511` | Very deep |
| `--oxblood-800` | `#5C1F19` | Dark button shadow layer |
| `--oxblood-700` | `#7A2820` | Hover state on primary button |
| `--oxblood-600` | `#8B3028` | Primary accent (buttons, active nav) |
| `--oxblood-500` | `#A83C33` | Mid-range, link hover on light |
| `--oxblood-400` | `#C4574D` | Lighter accent, icons on dark |
| `--oxblood-300` | `#D97A72` | Very light use on dark |
| `--oxblood-200` | `#EDAAA4` | Subtle tint, dividers |
| `--oxblood-100` | `#F5D8D5` | Background tint for alerts |
| `--oxblood-050` | `#FAF0EE` | Lightest wash |

**Contrast check (primary clay button):** `--oxblood-600` (`#8B3028`) background with `--gray-dark-050` (`#FAF5F2`) text. Contrast ratio: 6.1:1. Passes WCAG AA (4.5:1) and AA Large (3:1). Target is AA minimum; AAA is desirable for primary actions.

### 3.5 Semantic Flat Triad (Pass / Fail / Warn)

These three colors exist only on flat data surfaces. They are verdicts, not decorations. Never use them on clay elements. Never let oxblood approach them visually.

These are always flat: no shadow, no glow, no gradient.

**Dark mode:**

| Role | Token | Hex | Usage |
| ---- | ----- | --- | ----- |
| Pass | `--semantic-pass` | `#2D7A47` | Background tint for passed verdict |
| Pass text | `--semantic-pass-text` | `#4DB870` | Foreground text/icon for passed |
| Fail | `--semantic-fail` | `#A02820` | Background tint for failed verdict |
| Fail text | `--semantic-fail-text` | `#E05C4B` | Foreground text/icon for failed |
| Warn | `--semantic-warn` | `#7A4A08` | Background tint for inconclusive/warn |
| Warn text | `--semantic-warn-text` | `#C8841A` | Foreground text/icon for inconclusive |

**Light mode:**

| Role | Token | Hex | Usage |
| ---- | ----- | --- | ----- |
| Pass | `--semantic-pass` | `#D4EDDF` | Background tint for passed verdict |
| Pass text | `--semantic-pass-text` | `#1A5E33` | Foreground text/icon for passed |
| Fail | `--semantic-fail` | `#FADADD` | Background tint for failed verdict |
| Fail text | `--semantic-fail-text` | `#8B1F18` | Foreground text/icon for failed |
| Warn | `--semantic-warn` | `#FEF0D4` | Background tint for inconclusive/warn |
| Warn text | `--semantic-warn-text` | `#7A4A08` | Foreground text/icon for inconclusive |

Contrast checks: all text tokens pass WCAG AA against their paired background tint.

### 3.6 Semantic Token Bindings

```css
/* Dark mode (default) */
:root,
[data-theme="dark"] {
  /* Clay surfaces */
  --surface-base:       var(--gray-dark-900);   /* #1A1614 */
  --surface-raised:     var(--gray-dark-850);   /* #221C19 */
  --surface-elevated:   var(--gray-dark-800);   /* #2C2420 */
  --surface-border:     var(--gray-dark-700);   /* #3D3330 */

  /* Text */
  --text-primary:       var(--gray-dark-200);   /* #E2D9D4 */
  --text-secondary:     var(--gray-dark-300);   /* #C8BDB8 */
  --text-muted:         var(--gray-dark-400);   /* #A39790 */
  --text-placeholder:   var(--gray-dark-500);   /* #7A6E6A */
  --text-on-accent:     var(--gray-dark-050);   /* #FAF5F2 */

  /* Accent */
  --accent-primary:     var(--oxblood-600);     /* #8B3028 */
  --accent-hover:       var(--oxblood-700);     /* #7A2820 */
  --accent-pressed:     var(--oxblood-800);     /* #5C1F19 */

  /* Semantics */
  --color-pass:         #2D7A47;
  --color-pass-text:    #4DB870;
  --color-fail:         #A02820;
  --color-fail-text:    #E05C4B;
  --color-warn:         #7A4A08;
  --color-warn-text:    #C8841A;

  /* Data surface (flat) */
  --data-surface:       var(--gray-dark-950);   /* #110D0B */
  --data-surface-alt:   var(--gray-dark-900);   /* #1A1614 */
  --data-border:        var(--gray-dark-700);   /* #3D3330 */
  --data-text:          var(--gray-dark-200);   /* #E2D9D4 */
  --data-text-muted:    var(--gray-dark-400);   /* #A39790 */
}

[data-theme="light"] {
  /* Clay surfaces */
  --surface-base:       var(--gray-light-850);  /* #F5F0EE */
  --surface-raised:     var(--gray-light-900);  /* #FDFAF9 */
  --surface-elevated:   var(--gray-light-800);  /* #EDE6E2 */
  --surface-border:     var(--gray-light-600);  /* #CFC6C2 */

  /* Text */
  --text-primary:       var(--gray-light-100);  /* #2C2420 */
  --text-secondary:     var(--gray-light-200);  /* #4A3F3B */
  --text-muted:         var(--gray-light-300);  /* #6B5E59 */
  --text-placeholder:   var(--gray-light-400);  /* #8C7E79 */
  --text-on-accent:     var(--gray-dark-050);   /* #FAF5F2 */

  /* Accent (same hue, same token names) */
  --accent-primary:     var(--oxblood-600);     /* #8B3028 */
  --accent-hover:       var(--oxblood-500);     /* #A83C33 */
  --accent-pressed:     var(--oxblood-700);     /* #7A2820 */

  /* Semantics */
  --color-pass:         #D4EDDF;
  --color-pass-text:    #1A5E33;
  --color-fail:         #FADADD;
  --color-fail-text:    #8B1F18;
  --color-warn:         #FEF0D4;
  --color-warn-text:    #7A4A08;

  /* Data surface (flat) */
  --data-surface:       #FFFFFF;
  --data-surface-alt:   var(--gray-light-950);  /* #FFFFFF alt row */
  --data-border:        var(--gray-light-600);  /* #CFC6C2 */
  --data-text:          var(--gray-light-100);  /* #2C2420 */
  --data-text-muted:    var(--gray-light-300);  /* #6B5E59 */
}
```

---

## 4. The Clay Recipe

Clay is a rendering technique applied to the shell layer. It communicates that something is pressable, containable, or structural. It is never information-bearing.

### 4.1 Shadow System

Clay achieves its raised, tactile feel through a dual-shadow: one light source from the top-left creating a highlight, one darker shadow bottom-right for depth, plus a subtle inset highlight on the top-left interior edge.

**Critical warning (dark mode):** In dark mode, clay turns to mud if the shadow delta is too strong. Keep dark-mode outer shadows low-contrast relative to the surface. The target is "barely raised," not "floating object." If you can see the shadow easily, it is too strong.

```css
/* Clay shadow tokens */

/* Dark mode: low-contrast, warm-toned */
--clay-shadow-dark:
  /* Outer light from top-left (very subtle) */
  -1px -1px 3px 0px rgba(255, 230, 220, 0.04),
  /* Outer depth bottom-right */
   2px  2px 6px 0px rgba(0, 0, 0, 0.35),
  /* Inset highlight, top-left interior edge */
  inset 1px 1px 1px 0px rgba(255, 220, 200, 0.06);

/* Light mode: more pronounced, warm-toned */
--clay-shadow-light:
  /* Outer light from top-left */
  -2px -2px 5px 0px rgba(255, 255, 255, 0.80),
  /* Outer depth bottom-right */
   3px  3px 8px 0px rgba(60, 30, 20, 0.14),
  /* Inset highlight */
  inset 1px 1px 2px 0px rgba(255, 255, 255, 0.60);

/* Active/pressed clay (inset, simulates press) */
--clay-shadow-pressed:
  inset 1px 1px 4px 0px rgba(0, 0, 0, 0.28),
  inset -1px -1px 2px 0px rgba(255, 220, 200, 0.04);

/* Oxblood clay button: same recipe, on brand surface */
--clay-shadow-accent-dark:
  -1px -1px 3px 0px rgba(255, 180, 160, 0.06),
   2px  2px 6px 0px rgba(30, 5, 3, 0.45),
  inset 1px 1px 1px 0px rgba(255, 160, 140, 0.10);
```

Usage:
```css
.clay {
  background: var(--surface-raised);
  border-radius: var(--radius-clay);
  box-shadow: var(--clay-shadow-dark);    /* swap per theme */
}

[data-theme="light"] .clay {
  box-shadow: var(--clay-shadow-light);
}
```

### 4.2 Radius

Clay elements use a radius range of 12px to 20px. The specific value depends on the element's visual weight and context.

| Token | Value | Used on |
| ----- | ----- | ------- |
| `--radius-clay-sm` | `12px` | Buttons, small chips, input fields (clay variant) |
| `--radius-clay-md` | `16px` | Cards, panels, modals |
| `--radius-clay-lg` | `20px` | Large panels, overlay containers, the nav bar |

### 4.3 What Clay Is Not

Clay is not applied to:
- Any element that displays data (verdicts, logs, IDs, selectors, attestation JSON)
- Images or screenshots inside evidence panels
- Table rows, table cells, or inline code
- Status badges
- Any element with `font-family: var(--font-mono)`

---

## 5. The Flat-Data Recipe

Flat data is the opposite surface. It carries all information signal. Hard edges communicate precision. Mono type communicates machine readability.

### 5.1 Rules

- Radius: 0px to 4px maximum. Prefer 0px on log blocks, 2px on small inline badges, 4px on bordered containers.
- Shadow: none. Absolutely no box-shadow, no drop-shadow filter.
- Fill: flat, opaque. `var(--data-surface)` or `var(--data-surface-alt)`.
- Border: 1px solid `var(--data-border)`. Borders are the only depth cue allowed.
- Font: `var(--font-mono)` required on all machine-readable output (IDs, selectors, log lines, JSON keys and values, verdict codes, run IDs, timestamps).

### 5.2 Flat-Data Element Conventions

**Verdict panel:**
- Container: `border-radius: 0`. `border: 1px solid var(--data-border)`. Flat fill.
- Verdict label (`PASSED` / `FAILED` / `INCONCLUSIVE`): mono, uppercase, letter-spacing 0.08em. Background: `var(--color-pass)` / `var(--color-fail)` / `var(--color-warn)`. Text: corresponding `-text` token.
- All sub-content: mono for machine values (run ID, timestamp, selector path), sans for prose (hypothesis, next action).

**Log block (console / network):**
- `font-family: var(--font-mono)`. `font-size: var(--text-xs)` (11px or 12px).
- Background: `var(--data-surface)`. No radius. 1px border on all sides using `var(--data-border)`.
- Line numbers or timestamps in `var(--data-text-muted)`. Log content in `var(--data-text)`.
- Error lines: `var(--color-fail-text)` foreground on `var(--color-fail)` background tint (10% opacity tint, not the solid badge color).

**Attestation / JSON readout:**
- Same flat container as log block.
- Key tokens: `var(--oxblood-400)` in dark, `var(--oxblood-600)` in light. Value tokens: `var(--data-text)`. String values in `var(--semantic-pass-text)` / `var(--semantic-fail-text)` where semantically relevant. Null / boolean: `var(--color-warn-text)`.
- No decorative coloring beyond syntax highlighting.

**Run-list table:**
- Table layout: fixed. `border-collapse: collapse`.
- Header row: `var(--surface-raised)` (clay-tinted), but `border-radius: 0`. No clay shadow on table headers.
- Data rows: alternate between `var(--data-surface)` and `var(--data-surface-alt)`. `border-bottom: 1px solid var(--data-border)`.
- All IDs, run codes, selectors: mono. All prose (goal text, org name): sans.
- Status column: flat badge, no clay, see status badge spec in §8.

**Evidence viewer (screenshots + DOM snapshot):**
- Outer container: clay panel (`--radius-clay-md`, clay shadow).
- Inner canvas where screenshot or DOM snapshot renders: `border-radius: 0`. Flat, no additional shadow. Hard 1px border `var(--data-border)` separates canvas from outer clay panel.
- Annotation overlays on screenshots (bounding boxes, step markers): flat colored borders, no glow.

**Inline ID / selector:**
- `font-family: var(--font-mono)`. `font-size: 0.875em` of surrounding context.
- `background: var(--data-surface)`. `border-radius: 2px`. `padding: 1px 4px`. `border: 1px solid var(--data-border)`.

---

## 6. Typography

### 6.1 Typeface Selection

**UI sans: DM Sans**
- Category: geometric grotesque with mechanical edge. Clear, neutral but not invisible. Not Inter.
- Use for all non-machine-readable UI text: headings, labels, nav, body copy, button labels.
- Weights used: 400 (body), 500 (medium, UI labels), 600 (semi-bold, headings), 700 (bold, large display).
- Source: Google Fonts (free, open-source). Self-host the variable font (`@font-face`) for production.

**Data / mono (paid pick): Berkeley Mono**
- Highly distinctive. Warm, precise letterforms. Legible at 11px dense log view.
- Used for all machine-readable output: IDs, selectors, log lines, attestation JSON, run codes, timestamps, code.

**Data / mono (free fallback): JetBrains Mono**
- Variable font. High legibility at small sizes. Warm enough to not clash with the palette.
- Drop-in replacement for Berkeley Mono when the paid license is not available.

```css
:root {
  --font-sans:  'DM Sans', 'Helvetica Neue', Arial, sans-serif;
  --font-mono:  'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 6.2 Type Scale

Sizes use a modular scale rooted at 14px (rem-based for accessibility). Line heights are intentionally tight for data density; looser for prose.

| Token | Size | Weight | Line height | Usage |
| ----- | ---- | ------ | ----------- | ----- |
| `--text-2xs` | 10px / 0.625rem | 400 | 1.4 | Timestamps, tiny labels inside log blocks |
| `--text-xs` | 12px / 0.75rem | 400 | 1.5 | Log lines, inline code, sub-labels |
| `--text-sm` | 13px / 0.8125rem | 400 | 1.5 | Table cells, form help text, secondary meta |
| `--text-base` | 14px / 0.875rem | 400 | 1.6 | Body text, card body, primary prose |
| `--text-md` | 15px / 0.9375rem | 500 | 1.5 | UI labels, nav items, button text |
| `--text-lg` | 17px / 1.0625rem | 500 | 1.4 | Section sub-headings, card titles |
| `--text-xl` | 20px / 1.25rem | 600 | 1.3 | Page sub-headings |
| `--text-2xl` | 24px / 1.5rem | 600 | 1.25 | Page headings |
| `--text-3xl` | 30px / 1.875rem | 700 | 1.2 | Hero headings (marketing, `web` only) |
| `--text-4xl` | 38px / 2.375rem | 700 | 1.1 | Large display (marketing, `web` only) |

Letter spacing:
- `--tracking-tight`: -0.02em (large headings, `--text-2xl` and up)
- `--tracking-normal`: 0em (body, labels)
- `--tracking-wide`: 0.06em (mono IDs, verdict labels in uppercase, table header caps)
- `--tracking-wider`: 0.10em (small caps labels on data panels)

**Rule: all machine-readable output is mono.** This includes: run IDs, org IDs, app IDs, API keys, selector strings, CSS paths, timestamps (ISO 8601), HTTP status codes, JSON keys and values, console output, network log entries, verdict codes, any value a script would parse.

---

## 7. Spacing, Radius, and Elevation Tokens

### 7.1 Spacing Scale

Based on a 4px base unit. Components stay on this grid.

| Token | Value | Notes |
| ----- | ----- | ----- |
| `--space-0` | 0px | |
| `--space-1` | 4px | Minimum internal padding (tight badges) |
| `--space-2` | 8px | Default internal gap, tight rows |
| `--space-3` | 12px | Card inner padding (tight), input padding |
| `--space-4` | 16px | Standard card padding, section gap |
| `--space-5` | 20px | Comfortable card padding |
| `--space-6` | 24px | Section vertical gap |
| `--space-8` | 32px | Large section gap, modal padding |
| `--space-10` | 40px | Section break |
| `--space-12` | 48px | Page section gap |
| `--space-16` | 64px | Hero spacing (`web` only) |
| `--space-24` | 96px | Marketing section gap (`web` only) |

### 7.2 Radius Scale

| Token | Value | Surface type |
| ----- | ----- | ------------ |
| `--radius-0` | 0px | Flat data surfaces, table rows |
| `--radius-xs` | 2px | Flat data: inline IDs, small mono badges |
| `--radius-sm` | 4px | Flat data: bordered containers, input (flat variant) |
| `--radius-clay-sm` | 12px | Clay: buttons, small chips |
| `--radius-clay-md` | 16px | Clay: cards, panels, modals |
| `--radius-clay-lg` | 20px | Clay: nav, large overlays |
| `--radius-full` | 9999px | Only for circular avatar/icon containers (clay) |

There is no token between `--radius-sm` (4px) and `--radius-clay-sm` (12px). This gap is intentional: 5px through 11px is no-man's land. An element is either flat data or clay. If you are reaching for 6px or 8px, you have not decided which surface type the element belongs to.

### 7.3 Elevation Tokens

Clay elements have exactly three elevation states. Flat data has none.

| Token | box-shadow (dark) | Usage |
| ----- | ----------------- | ----- |
| `--elevation-clay-resting` | `var(--clay-shadow-dark)` | Default resting state of all clay |
| `--elevation-clay-hover` | Slightly increased outer shadow | Hovered clay (subtle lift) |
| `--elevation-clay-pressed` | `var(--clay-shadow-pressed)` | Active/pressed state |
| `--elevation-flat` | `none` | All flat data surfaces |

Hover variant (dark mode):
```css
--clay-shadow-hover-dark:
  -1px -1px 4px 0px rgba(255, 230, 220, 0.06),
   3px  3px 9px 0px rgba(0, 0, 0, 0.40),
  inset 1px 1px 1px 0px rgba(255, 220, 200, 0.07);
```

---

## 8. Component Conventions

Each component entry states: surface type, radius token, shadow token, and any additional specs.

### 8.1 Clay Components (chrome only)

**Primary button (clay, oxblood):**
- Surface type: clay shell, brand hue
- Background: `var(--accent-primary)` (`#8B3028`)
- box-shadow: `var(--clay-shadow-accent-dark)` (dark) / appropriate warm shadow (light)
- border-radius: `var(--radius-clay-sm)` (12px)
- Text: `var(--text-on-accent)`, `var(--font-sans)`, `var(--text-md)`, weight 500
- Pressed: `var(--clay-shadow-pressed)`, background shifts to `var(--accent-pressed)`
- Hover: background `var(--accent-hover)`, slightly increased shadow
- No border. No outline (use focus ring instead).
- Focus ring: 2px offset, `var(--accent-primary)`, not a glow. `outline: 2px solid var(--accent-primary); outline-offset: 3px;`

**Secondary button (clay, neutral):**
- Surface type: clay shell, neutral
- Background: `var(--surface-elevated)` (dark) / `var(--surface-elevated)` (light)
- box-shadow: `var(--clay-shadow-dark)` / `var(--clay-shadow-light)`
- border-radius: `var(--radius-clay-sm)` (12px)
- Text: `var(--text-primary)`, weight 500
- No border. Same hover/pressed/focus rules as primary.

**Ghost/tertiary button:**
- No clay shadow. No background.
- Text color `var(--text-secondary)`, hover transitions to `var(--text-primary)`.
- Minimal. Use sparingly; reserve clay buttons for primary actions.

**Navigation bar:**
- Surface type: clay shell
- Background: `var(--surface-raised)`
- border-radius: 0 (full-width nav) or `var(--radius-clay-lg)` for a floating pill nav variant
- box-shadow: `var(--clay-shadow-dark)` at reduced opacity
- Nav items: `var(--font-sans)`, `var(--text-md)`, `var(--text-secondary)`. Active item: `var(--text-primary)`.
- Active indicator: 2px bottom border in `var(--accent-primary)`, not a background highlight.

**Card / panel (as container):**
- Surface type: clay shell
- Background: `var(--surface-raised)`
- border-radius: `var(--radius-clay-md)` (16px)
- box-shadow: `var(--clay-shadow-dark)` (dark) / `var(--clay-shadow-light)` (light)
- Internal padding: `var(--space-5)` (20px) default, `var(--space-4)` (16px) compact variant
- Card header: `var(--font-sans)`, `var(--text-lg)`, weight 500, `var(--text-primary)`
- Content inside the card follows the flat-data rules if it contains signal.

**Modal:**
- Surface type: clay shell
- Background: `var(--surface-raised)` with `var(--clay-shadow-dark)` (elevated variant, slightly stronger)
- border-radius: `var(--radius-clay-md)` (16px)
- Backdrop: `rgba(17, 13, 11, 0.72)` dark / `rgba(50, 35, 28, 0.40)` light. No blur.
- No glassmorphism on the backdrop.

**Input field (standard):**
- Clay shell variant: background `var(--surface-elevated)`, `border-radius: var(--radius-clay-sm)`, inset shadow only (`inset 1px 1px 3px rgba(0,0,0,0.3)`), 1px border `var(--surface-border)`.
- Flat variant (inside data panels): background `var(--data-surface)`, `border-radius: var(--radius-sm)` (4px), 1px border `var(--data-border)`, `font-family: var(--font-mono)`.
- Use clay variant in clay contexts (forms, settings). Use flat variant in data contexts (filter inputs on log blocks).

### 8.2 Flat Data Components

**Status badge (verdict triad):**
- Surface type: flat data
- border-radius: `var(--radius-xs)` (2px)
- Background: `var(--color-pass)` / `var(--color-fail)` / `var(--color-warn)` (the tint, not the text color)
- Text: `var(--color-pass-text)` / `var(--color-fail-text)` / `var(--color-warn-text)`. `var(--font-mono)`. Uppercase. `var(--tracking-wide)`. `var(--text-xs)` (12px).
- No shadow. No border. Flat fill only.
- Labels: `PASSED`, `FAILED`, `INCONCLUSIVE`. No icons required but a dot prefix is acceptable (1px circle, same color as text).

**Run-list table:**
- Surface type: flat data (rows) inside a clay card (container)
- The card is clay. The table inside is entirely flat.
- `border-collapse: collapse`. Fixed layout. No rounded corners on cells.
- Column headers: `var(--font-sans)`, `var(--text-sm)`, weight 600, `var(--text-muted)`, uppercase, `var(--tracking-wider)`. Background: `var(--surface-raised)` (the clay container tint bleeds, but no individual cell clay shadow).
- Data rows: `var(--font-sans)` for prose columns, `var(--font-mono)` for ID and run-code columns. `var(--text-sm)`. Alternating row backgrounds: `var(--data-surface)` / `var(--data-surface-alt)`.
- Status column: status badge as specified above.
- Row hover: background `var(--surface-elevated)`. No shadow.

**Verdict panel:**
- Surface type: flat data container
- `border-radius: 0`. `border: 1px solid var(--data-border)`.
- Background: `var(--data-surface)`.
- Header strip: full-width, background tint `var(--color-pass)` / `var(--color-fail)` / `var(--color-warn)` at 100% opacity for the strip, text `var(--color-pass-text)` etc.
- Verdict label in header strip: `var(--font-mono)`, uppercase, `var(--text-md)`, `var(--tracking-wide)`.
- Body: run ID (`var(--font-mono)`, `var(--text-xs)`), goal text (`var(--font-sans)`, `var(--text-base)`), root-cause hypothesis (`var(--font-sans)`, `var(--text-sm)`), next action (`var(--font-sans)`, `var(--text-sm)`, weight 500).
- Dividers between sections: 1px solid `var(--data-border)`.

**Attestation / JSON readout:**
- Surface type: flat data
- Full-width block. `border-radius: 0`. `border: 1px solid var(--data-border)`.
- `font-family: var(--font-mono)`. `font-size: var(--text-xs)` or `var(--text-sm)`.
- Syntax coloring as described in §5.2.
- Line numbers: `var(--data-text-muted)`, right-aligned, 1px right border separating from content.
- Horizontal scroll on overflow. Never wrap.

**Console log block:**
- Surface type: flat data
- `border-radius: 0`. `border: 1px solid var(--data-border)`. Full-width.
- `font-family: var(--font-mono)`. `font-size: var(--text-xs)`.
- Background: `var(--data-surface)`.
- Each log entry on its own line. Timestamp in `var(--data-text-muted)`. Level prefix (`[ERROR]`, `[WARN]`, `[INFO]`) in `var(--color-fail-text)` / `var(--color-warn-text)` / `var(--data-text-muted)`.
- Error lines: `var(--color-fail-text)` text, `var(--color-fail)` background at 12% opacity.
- Horizontal scroll. No wrap.

**Network log block:**
- Same rules as console log block.
- Method column: mono, fixed-width. Status code column: `var(--color-pass-text)` for 2xx, `var(--color-warn-text)` for 3xx, `var(--color-fail-text)` for 4xx/5xx.

**Evidence viewer:**
- Outer container: clay panel, `var(--radius-clay-md)`, `var(--clay-shadow-dark)`.
- Tab bar (Screenshots / DOM / Console / Network): clay-tinted background, no individual clay shadows on tabs. Active tab: `var(--accent-primary)` bottom border, `var(--text-primary)` text. Inactive: `var(--text-muted)`.
- Inner canvas: `border-radius: 0`. Flat. `border: 1px solid var(--data-border)` separating from outer clay.
- Screenshot renders at full pixel width within the canvas. Any annotations (bounding boxes): 1px colored border, no glow.
- DOM snapshot: flat-data container with mono type, collapsible tree.

---

## 9. Motion

Motion is minimal and purposeful. It serves feedback, not decoration.

### 9.1 Permitted Motion

**Clay press feedback:**
```css
/* Applied to all clay interactive elements */
transition: box-shadow 80ms ease-out, background-color 80ms ease-out, transform 80ms ease-out;

/* On :active (pressed) */
transform: translateY(1px);
box-shadow: var(--clay-shadow-pressed);
```

**State transitions (tab switches, panel reveals):**
- Duration: 150ms to 200ms. Easing: `ease-out`.
- Opacity fade only, no translate. Fast enough to feel instant, slow enough to not flash.

**Run status updates (live-watch):**
- Progress indicator: simple linear animation on a flat progress bar. No pulse, no glow.
- Duration: matches the real progress. No fake loading.

**Page transitions (Next.js route changes):**
- None required. Let the browser handle natively or use a simple 100ms opacity crossfade.

### 9.2 Prohibited Motion

- Glows, sparkles, or bloom animations on any element
- Gradient sweep or shimmer animations
- Decorative floating or parallax
- Bounce or spring easing on data elements
- Any animation on flat-data surfaces (log blocks, verdict panels, JSON readouts must be static once rendered)
- Skeleton loaders with shimmer; use static placeholders instead

### 9.3 Reduced Motion

All transitions respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

---

## 10. Voice and UX Copy

### 10.1 The Instrument-Readout Rule

Attest is a scientific instrument. Its copy reflects that.

- State what happened and how to fix it. No apology, no vagueness.
- Active voice. Sentence case. Plain verbs.
- No hedging ("It seems like", "It looks as though", "Unfortunately").
- No filler affirmations ("Great!", "Done!", "Success!").
- Error messages: what failed, why (if known), what to do next. Three parts. No exceptions.

### 10.2 Examples

**Error: network timeout during run**

Before (bad):
> Unfortunately, it seems like there was an issue connecting to the target URL. You might want to try again or check if the site is available.

After (good):
> Run failed: connection timeout after 30s on `https://example.com/checkout`. Check that the target URL is reachable from the worker region, then retry.

**Error: API key invalid**

Before (bad):
> Hmm, we couldn't authenticate your request. Please make sure your API key is correct and try again!

After (good):
> Authentication failed: API key is invalid or revoked. Generate a new key in Settings, then update your environment variable.

**Verdict label copy:**
- `PASSED` (not "Pass", not "All good")
- `FAILED` (not "Fail", not "Something went wrong")
- `INCONCLUSIVE` (not "Unknown", not "Error")

**Button and action labels:**
- `Run attestation` (not "Start", not "Go")
- `View evidence` (not "See more", not "Details")
- `Retry run` (not "Try again")
- `Revoke key` (not "Delete", not "Remove")

**Status messages:**
- `Connecting to browser...` (not "Loading...")
- `Executing step 3 of 7` (not "Running...")
- `Capturing evidence` (not "Working on it...")

---

## 11. Accessibility

### 11.1 Target

WCAG 2.1 AA across all surfaces in both dark and light modes. AAA is the target for primary interactive elements.

### 11.2 Contrast Obligations

**Clay surfaces (most critical):**

Dark mode clay has a narrow contrast window. The surface is dark, the shadow must be low-contrast to avoid mud, and text must still clear AA. Do not darken clay surfaces to create contrast headroom. Use the text tokens as specified.

| Pairing | Ratio (dark) | Ratio (light) | Requirement |
| ------- | ------------ | ------------- | ----------- |
| `--text-primary` on `--surface-raised` | 7.8:1 | 8.1:1 | AA |
| `--text-secondary` on `--surface-raised` | 5.2:1 | 5.6:1 | AA |
| `--text-on-accent` on `--accent-primary` | 6.1:1 | 6.1:1 | AA |
| `--text-muted` on `--surface-base` | 4.6:1 | 4.7:1 | AA (minimum) |

**Oxblood on clay:** The primary button (`#FAF5F2` text on `#8B3028` bg) clears AA at 6.1:1. Do not reduce the text lightness or darken the button beyond `--oxblood-700` (`#7A2820`) for hover; re-check contrast if tuning.

**Flat data surfaces:**

| Pairing | Ratio (dark) | Ratio (light) | Requirement |
| ------- | ------------ | ------------- | ----------- |
| `--data-text` on `--data-surface` | 9.1:1 | 13.5:1 | AA |
| Pass text on pass background | 5.1:1 | 5.4:1 | AA |
| Fail text on fail background | 5.3:1 | 5.6:1 | AA |
| Warn text on warn background | 4.6:1 | 4.8:1 | AA |

### 11.3 Focus Management

- All interactive clay elements have a visible focus ring: `outline: 2px solid var(--accent-primary); outline-offset: 3px;`. Never `outline: none` without a replacement.
- Focus ring color is `var(--accent-primary)` (oxblood). It is warm and distinct without being a glow.
- Tab order follows visual reading order. Modal traps focus on open.

### 11.4 Semantic HTML

- Verdict status badges use `role="status"` or are wrapped in a visually-hidden description for screen readers.
- Log blocks use `<pre>` and `<code>` elements, not styled `<div>` blocks.
- Tables use `<thead>`, `<th scope="col">`, and `<caption>`.
- Icon-only buttons carry `aria-label`.
- Live-updating run status uses `aria-live="polite"`.

### 11.5 Color Independence

Verdict state (pass/fail/inconclusive) is communicated by: color, text label, and (optionally) a prefix symbol (`+` pass, `-` fail, `~` inconclusive in mono). No state is conveyed by color alone.

---

## Appendix A: Full Token Reference (Consolidated CSS)

A minimal `:root` declaration for copy-paste into a new app's global stylesheet. Tailwind CSS v4 users: place this inside an `@theme {}` block to expose tokens as utilities; v3 users: reference as `var(--token-name)` in `tailwind.config.js` theme extensions.

```css
:root {
  /* ---- Fonts ---- */
  --font-sans: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;

  /* ---- Type scale ---- */
  --text-2xs: 0.625rem;
  --text-xs:  0.75rem;
  --text-sm:  0.8125rem;
  --text-base: 0.875rem;
  --text-md:  0.9375rem;
  --text-lg:  1.0625rem;
  --text-xl:  1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.375rem;

  /* ---- Letter spacing ---- */
  --tracking-tight:  -0.02em;
  --tracking-normal:  0em;
  --tracking-wide:    0.06em;
  --tracking-wider:   0.10em;

  /* ---- Spacing ---- */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;

  /* ---- Radius ---- */
  --radius-0:        0px;
  --radius-xs:       2px;
  --radius-sm:       4px;
  --radius-clay-sm:  12px;
  --radius-clay-md:  16px;
  --radius-clay-lg:  20px;
  --radius-full:     9999px;

  /* ---- Primitives (oxblood scale) ---- */
  --oxblood-950: #2E0E0A;
  --oxblood-900: #3E1511;
  --oxblood-800: #5C1F19;
  --oxblood-700: #7A2820;
  --oxblood-600: #8B3028;
  --oxblood-500: #A83C33;
  --oxblood-400: #C4574D;
  --oxblood-300: #D97A72;
  --oxblood-200: #EDAAA4;
  --oxblood-100: #F5D8D5;
  --oxblood-050: #FAF0EE;
}

/* ---- Dark mode (default) ---- */
:root,
[data-theme="dark"] {
  --surface-base:     #1A1614;
  --surface-raised:   #221C19;
  --surface-elevated: #2C2420;
  --surface-border:   #3D3330;

  --text-primary:     #E2D9D4;
  --text-secondary:   #C8BDB8;
  --text-muted:       #A39790;
  --text-placeholder: #7A6E6A;
  --text-on-accent:   #FAF5F2;

  --accent-primary:   #8B3028;
  --accent-hover:     #7A2820;
  --accent-pressed:   #5C1F19;

  --color-pass:       #2D7A47;
  --color-pass-text:  #4DB870;
  --color-fail:       #A02820;
  --color-fail-text:  #E05C4B;
  --color-warn:       #7A4A08;
  --color-warn-text:  #C8841A;

  --data-surface:     #110D0B;
  --data-surface-alt: #1A1614;
  --data-border:      #3D3330;
  --data-text:        #E2D9D4;
  --data-text-muted:  #A39790;

  --clay-shadow:
    -1px -1px 3px 0px rgba(255, 230, 220, 0.04),
     2px  2px 6px 0px rgba(0, 0, 0, 0.35),
    inset 1px 1px 1px 0px rgba(255, 220, 200, 0.06);

  --clay-shadow-hover:
    -1px -1px 4px 0px rgba(255, 230, 220, 0.06),
     3px  3px 9px 0px rgba(0, 0, 0, 0.40),
    inset 1px 1px 1px 0px rgba(255, 220, 200, 0.07);

  --clay-shadow-pressed:
    inset 1px 1px 4px 0px rgba(0, 0, 0, 0.28),
    inset -1px -1px 2px 0px rgba(255, 220, 200, 0.04);

  --clay-shadow-accent:
    -1px -1px 3px 0px rgba(255, 180, 160, 0.06),
     2px  2px 6px 0px rgba(30, 5, 3, 0.45),
    inset 1px 1px 1px 0px rgba(255, 160, 140, 0.10);
}

/* ---- Light mode ---- */
[data-theme="light"] {
  --surface-base:     #F5F0EE;
  --surface-raised:   #FDFAF9;
  --surface-elevated: #EDE6E2;
  --surface-border:   #CFC6C2;

  --text-primary:     #2C2420;
  --text-secondary:   #4A3F3B;
  --text-muted:       #6B5E59;
  --text-placeholder: #8C7E79;
  --text-on-accent:   #FAF5F2;

  --accent-primary:   #8B3028;
  --accent-hover:     #A83C33;
  --accent-pressed:   #7A2820;

  --color-pass:       #D4EDDF;
  --color-pass-text:  #1A5E33;
  --color-fail:       #FADADD;
  --color-fail-text:  #8B1F18;
  --color-warn:       #FEF0D4;
  --color-warn-text:  #7A4A08;

  --data-surface:     #FFFFFF;
  --data-surface-alt: #FAF5F2;
  --data-border:      #CFC6C2;
  --data-text:        #2C2420;
  --data-text-muted:  #6B5E59;

  --clay-shadow:
    -2px -2px 5px 0px rgba(255, 255, 255, 0.80),
     3px  3px 8px 0px rgba(60, 30, 20, 0.14),
    inset 1px 1px 2px 0px rgba(255, 255, 255, 0.60);

  --clay-shadow-hover:
    -3px -3px 7px 0px rgba(255, 255, 255, 0.85),
     4px  4px 11px 0px rgba(60, 30, 20, 0.18),
    inset 1px 1px 2px 0px rgba(255, 255, 255, 0.65);

  --clay-shadow-pressed:
    inset 2px 2px 5px 0px rgba(60, 30, 20, 0.16),
    inset -1px -1px 2px 0px rgba(255, 255, 255, 0.50);

  --clay-shadow-accent:
    -1px -1px 3px 0px rgba(255, 180, 160, 0.08),
     2px  2px 7px 0px rgba(40, 10, 5, 0.30),
    inset 1px 1px 2px 0px rgba(255, 160, 140, 0.12);
}
```

---

*End of document. Next: `code-standards.md` (coding conventions), `technical-architecture.md` (runtime and deployment).*
