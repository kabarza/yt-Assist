# Tailwind v4 + shadcn v4 Migration Report

**Date:** 2026-03-07
**Scope:** Full infrastructure upgrade + UI overhaul + design refinements

---

## What Changed

### Dependencies

| Package | Before | After |
|---|---|---|
| `tailwindcss` | `^3.4.17` (devDep) | `^4.2.1` (devDep) |
| `@tailwindcss/vite` | — | `^4.2.1` (added) |
| `tw-animate-css` | — | `^1.4.0` (added) |
| `tailwindcss-animate` | `^1.0.7` | removed |
| `autoprefixer` | `^10.4.20` | removed |
| `postcss` | `^8.5.1` | removed (transitive only) |

### Deleted Files

| File | Reason |
|---|---|
| `postcss.config.js` | Replaced by `@tailwindcss/vite` plugin |
| `tailwind.config.js` | Config moved into `src/index.css` via `@theme inline` |
| `BASELINE-UI-ChatInput.reference.tsx` | Stale reference file |
| `index.BASELINE-UI.reference.css` | Stale reference file |
| `tailwind.config.BASELINE-UI.reference.js` | Stale reference file |
| `src/tools/packaging/TemplateEditor.tsx.bak` | Backup file |
| `src/chat/ChatPage.tsx.bak` | Backup file |
| `src/chat/ChatPage.tsx.tmp` | Temp file |

### Modified Files

| File | Changes |
|---|---|
| `vite.config.ts` | Added `@tailwindcss/vite` plugin |
| `src/index.css` | Full rewrite for TW v4 (`@import`, `@custom-variant`, `@theme inline`) + design tokens |
| `index.html` | Removed `class="dark"` (ThemeProvider handles it) |
| `src/contexts/ThemeContext.tsx` | Default theme `'dark'` → `'system'` |
| `src/components/ui/*.tsx` (15 files) | `React.forwardRef` → plain functions with `ref` prop + `data-slot` |
| `src/components/ui/button.tsx` | Fixed `bg-white/10` → `bg-accent`, `active:bg-white/25` → `active:bg-secondary/60` |
| `src/components/ui/tabs.tsx` | Fixed `bg-[hsl(...)]` → `bg-muted`/`bg-background`, added `shadow-sm` on active |
| `src/chat/CanvasPanel.tsx` | Fixed `#0a0a0a` → `var(--background)`, hardcoded HSL → semantic tokens, added `shadow-sm` |
| `src/chat/ChatInput.tsx` | Fixed `bg-black/40` → `bg-foreground/40`, `bg-white/10` → `bg-accent` |
| `src/tools/packaging/TemplateEditor.tsx` | Fixed `text-white` → `text-foreground` |

---

## Architecture: Before vs After

### Before (Tailwind v3)

```
postcss.config.js          ← PostCSS pipeline with tailwindcss + autoprefixer
tailwind.config.js         ← JS config: darkMode, content globs, theme.extend, plugins
src/index.css              ← @tailwind directives, @layer base { :root / .dark variables }
                              Variables as raw HSL channels: --background: 0 0% 100%
                              Usage: hsl(var(--background))
```

### After (Tailwind v4)

```
vite.config.ts             ← @tailwindcss/vite plugin (no PostCSS config needed)
src/index.css              ← @import "tailwindcss" + @import "tw-animate-css"
                              @custom-variant dark (&:where(.dark, .dark *))
                              Variables as full hsl(): --background: hsl(0 0% 100%)
                              @theme inline { --color-*: var(--*) } maps to Tailwind
                              Usage: var(--background) in custom CSS
```

Key differences:
- **No PostCSS config** — the Vite plugin handles everything
- **No JS config file** — theme tokens live in CSS via `@theme inline`
- **Dark mode** — `@custom-variant dark` replaces `darkMode: 'class'`
- **CSS variables** — wrapped in `hsl()` at definition, used as `var(--*)` everywhere
- **Animations** — `tw-animate-css` (CSS import) replaces `tailwindcss-animate` (JS plugin)
- **Content detection** — automatic in v4, no `content: [...]` array needed

---

## Design Token Changes

### Dark Theme: Warm Tint

Pure neutral grays → subtle blue tint at `240` hue for a softer, Notion/Apple-like feel.

| Token | Before (v3) | After (v4) |
|---|---|---|
| `--background` | `hsl(0 0% 0%)` pure black | `hsl(240 4% 3.5%)` warm near-black |
| `--card` | `hsl(0 0% 4%)` | `hsl(240 3% 5%)` |
| `--popover` | `hsl(0 0% 7%)` | `hsl(240 3% 7%)` |
| `--secondary` | `hsl(0 0% 10%)` | `hsl(240 3% 11%)` |
| `--muted` | `hsl(0 0% 15%)` | `hsl(240 3% 15%)` |
| `--muted-foreground` | `hsl(0 0% 60%)` | `hsl(240 2% 63%)` |
| `--border` | `hsl(0 0% 15%)` | `hsl(240 3% 14%)` |
| `--sidebar` | `hsl(0 0% 4%)` | `hsl(240 4% 4%)` |

### Light Theme: Stronger Contrast

Original shadcn defaults had insufficient contrast for form elements and tab states.

| Token | Before (v3) | After (v4) | Rationale |
|---|---|---|---|
| `--muted` | `0 0% 96.1%` | `0 0% 93%` | 7% gap from white (was 3.9%) — tabs and toggles now visible |
| `--accent` | `0 0% 96.1%` | `0 0% 93%` | Matches muted for hover states |
| `--muted-foreground` | `0 0% 45.1%` | `0 0% 40%` | Darker placeholder/secondary text |
| `--secondary` | `0 0% 96.1%` | `0 0% 95%` | Slight increase in distinction |
| `--border` / `--input` | `0 0% 89.8%` | `0 0% 82%` | 18% contrast from white — input borders clearly visible |
| `--sidebar-border` | `0 0% 89.8%` | `0 0% 82%` | Matches border |
| `--sidebar` | `0 0% 98%` | `0 0% 97%` | Slight tint for sidebar distinction |

### Border Radius

`--radius`: `0.375rem` → `0.5rem` (softer, more modern corners)

---

## Component Modernization (shadcn v3 → v4)

All 15 UI components updated from the v3 `forwardRef` pattern to v4 plain functions.

### Pattern

```tsx
// v3 (before)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn(...)} {...props} />
  )
)
Button.displayName = "Button"

// v4 (after) — React 19 passes ref as a prop
function Button({ className, ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} data-slot="button" className={cn(...)} {...props} />
}
```

Components updated: `badge`, `button`, `card` (6 sub-components), `dialog` (4), `dropdown-menu` (10), `input`, `label`, `popover`, `scroll-area` (2), `select` (8), `separator`, `switch`, `tabs` (3), `textarea`, `tooltip`.

Each component also received a `data-slot` attribute for CSS targeting per shadcn v4 convention.

---

## Hardcoded Color Fixes

| File | Before | After | Issue |
|---|---|---|---|
| `button.tsx` ghost | `hover:bg-white/10` | `hover:bg-accent` | White overlay invisible in light mode |
| `button.tsx` secondary | `active:bg-white/25` | `active:bg-secondary/60` | Same |
| `tabs.tsx` list | `bg-[hsl(0,0%,8%)]` | `bg-muted` | Hardcoded dark-only value |
| `tabs.tsx` trigger | `bg-[hsl(0,0%,18%)]` | `bg-background` + `shadow-sm` | Hardcoded dark-only value |
| `CanvasPanel.tsx` export bg | `'#0a0a0a'` | `var(--background)` | Hardcoded hex |
| `CanvasPanel.tsx` toggle | `bg-[hsl(0,0%,8%)]` | `bg-muted` | Hardcoded HSL |
| `CanvasPanel.tsx` active | `bg-[hsl(0,0%,18%)]` | `bg-background` + `shadow-sm` | Hardcoded HSL |
| `ChatInput.tsx` overlay | `bg-black/40` | `bg-foreground/40` | Black overlay in light mode |
| `ChatInput.tsx` web search | `bg-white/10` | `bg-accent` | White on white |
| `ChatInput.tsx` notes btn | `bg-white/10` | `bg-accent` | White on white |
| `ChatInput.tsx` drawing btn | `bg-white/10` | `bg-accent` | White on white |
| `TemplateEditor.tsx` title | `text-white` | `text-foreground` | Invisible in light mode |

---

## Theme System

The theme toggle (light / dark / system) continues to work via `ThemeContext`:
- Stored in `localStorage` under `yt-assist-theme`
- `ThemeProvider` adds/removes `dark` class on `<html>`
- `@custom-variant dark (&:where(.dark, .dark *))` in CSS tells TW v4 to use class-based dark mode
- Default changed from `'dark'` to `'system'` for new users
- `index.html` no longer has `class="dark"` hardcoded — ThemeProvider applies it on mount

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | Succeeds (8.5s) |
| `npm run dev:all` | Both Vite + API servers start |
| Light mode | Text readable, borders visible, tabs distinguishable |
| Dark mode | Softer warm tint, no pure black, borders less harsh |
| System theme | Respects OS preference as default |
| Animations | Dialog, dropdown, select open/close animations work |
| Existing localStorage | Saved theme/template data preserved |

---

## Known Limitations

1. **`@tailwindcss/typography`** is still on v0.5.x. A v4-native version (`@tailwindcss/typography@next`) exists but the prose classes used in this app are all custom CSS, so upgrading is optional.

2. **`postcss`** remains as a transitive dependency (via Vite internals) but has no user-facing config file.

3. **tldraw/Excalidraw overrides** still use `!important` and `var()` in custom CSS — these are unaffected by the TW v4 migration since they don't use Tailwind utility classes.
