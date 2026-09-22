# DRDO.vn — Design System (Master)

Visual language: **natural skincare + botanical ingredients + premium editorial + modern e-commerce**.
Mood: elegant, natural, calm, premium, clean, trustworthy, warm, environmentally conscious.

## Color palette

| Token | Value | Use |
| --- | --- | --- |
| `--color-forest` | `#2F5D33` | Primary brand green, CTAs, active states |
| `--color-forest-dark` | `#234D2A` | Headline accents, hover on primary |
| `--color-forest-deep` | `#17261A` | Body/headline text (forest charcoal) |
| `--color-sage` | `#718A62` | Secondary green, icons, muted accents |
| `--color-sage-light` | `#94A984` | Soft decorative green |
| `--color-sage-50` | `#EDF1E4` | Pale sage section background |
| `--color-ivory` | `#FAF9F4` | Primary page background |
| `--color-cream` | `#F7F5EE` | Alternate section background |
| `--color-sand` | `#ECE8DC` | Neutral surface, borders soft fill |
| `--color-sand-dark` | `#DED9C9` | Stronger neutral |
| `--color-surface` | `#FFFFFF` | Cards on cream backgrounds |
| `--color-border` | `#E3DFD2` | Hairline borders |
| `--color-text` | `#17261A` | Text |
| `--color-text-muted` | `#5E6B58` | Gray-green muted text |
| `--color-gold` | `#D9A428` | Rating stars, small promo accents |
| `--color-sale` | `#B4552D` | Sale badge (restrained terracotta) |

## Typography

- Display serif: **Playfair Display** (Vietnamese subset) — H1, H2, editorial statements, logo.
- Body/UI sans: **Inter** (Vietnamese subset) — nav, buttons, filters, metadata, prices.
- Scale: hero `clamp(2.4rem, 4.5vw, 3.4rem)`; section H2 `clamp(1.7rem, 3vw, 2.3rem)`; body 16px/1.6.
- Eyebrow labels: 11–12px sans, uppercase, letter-spacing 0.16em, `--color-sage`.

## Shape, depth, motion

- Radii: `--radius-sm: 8px`, `--radius-md: 14px`, `--radius-lg: 20px`, pill for tags.
- Shadows: restrained — `--shadow-sm` hairline lift, `--shadow-md` soft elevation on hover only.
- No glassmorphism, no neon, no gradients except pale botanical section washes.
- Motion: 150–250ms ease; respect `prefers-reduced-motion`.

## Components

- **Button primary**: forest green fill, ivory text, radius 999px, subtle hover darken + lift.
- **Button outline**: 1px forest border, transparent fill.
- **Product card**: white/off-white surface, 1px `--color-border`, 14px radius, image-dominated top (`aspect-ratio: 4/5`), badge top-left, gold stars, bold forest price, quiet hover (border deepen + tiny translate).
- **Header**: ivory, sticky, hairline bottom border, ~72px, serif logo with leaf mark, sans nav, underline active state, dark green CTA.
- **Section rhythm**: alternate `--color-ivory` / `--color-cream` / `--color-sage-50` backgrounds; 72–96px vertical padding.
- **Icons**: thin-line botanical SVG strokes, `--color-sage` or forest.

## Imagery

Warm daylight, cream backdrops, botanical greens, stone/natural textures, shallow depth of field.
Local assets only (`/images/…`), consistent aesthetic; no hotlinked stock.

## Accessibility

- Text contrast ≥ 4.5:1; muted text ≥ `--color-text-muted` on ivory only.
- Visible `:focus-visible` ring (forest).
- Semantic landmarks, skip link, labelled controls, alt text on imagery.
