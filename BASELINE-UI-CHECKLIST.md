# Baseline-UI Implementation Checklist

Quick reference for applying baseline-ui fixes to your codebase.

---

## Global Setup

### ✅ Tailwind Config
```bash
# Add to tailwind.config.js theme.extend
zIndex: {
  'dropdown': '10',
  'sticky': '20',
  'modal': '30',
  'popover': '40',
  'tooltip': '50',
}
```

### ✅ CSS Utilities
```css
/* Add to index.css */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  .text-pretty {
    text-wrap: pretty;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Find & Replace Patterns

### 1. Remove Gradients
**Find:** `bg-gradient-to-[r|t|b|l]`
**Action:** Replace with solid color at appropriate opacity

**Examples:**
```tsx
// ❌ bg-gradient-to-r from-transparent via-lime-500/20 to-transparent
// ✅ bg-lime-500/20

// ❌ bg-gradient-to-t from-black/60 to-transparent
// ✅ bg-black/40
```

---

### 2. Fix Animation Durations
**Find:** `duration-300`
**Replace:** `duration-200`

**Exception:** Keep 300ms+ for entrance animations (modals, panels)

---

### 3. Replace transition-all
**Find:** `transition-all`
**Replace:** Specific properties

**Common Patterns:**
```tsx
// Buttons (color changes)
transition-[color,background-color] duration-200

// Hover effects
transition-colors duration-200

// Shadows
transition-[box-shadow] duration-200

// Complex (opacity + transform)
transition-[opacity,transform] duration-200
```

---

### 4. Add aria-label to Icon Buttons
**Find:** `<button` with only icon children
**Action:** Add `aria-label="..."`

**Pattern:**
```tsx
<button
  onClick={...}
  aria-label="Descriptive action"  // ← ADD THIS
  title="..."
>
  <IconComponent />
</button>
```

---

### 5. Replace w-* h-* with size-*
**Find:** `w-(\d+) h-\1` (same width and height)
**Replace:** `size-$1`

**Examples:**
```tsx
// ❌ w-4 h-4
// ✅ size-4

// ❌ w-8 h-8
// ✅ size-8
```

---

### 6. Fix Z-Index Values
**Find:** `z-50`, `z-40`, `z-30`, etc.
**Replace:** Semantic values

**Mapping:**
```
z-50 (dropdown/menu) → z-dropdown
z-40 (popover)       → z-popover
z-30 (modal)         → z-modal
```

---

### 7. Add Typography Utilities
**Find:** `<h1`, `<h2`, `<h3>` (headings)
**Action:** Add `text-balance`

**Find:** `<p` in body text, prose
**Action:** Add `text-pretty`

**Examples:**
```tsx
// Headings
<h1 className="text-xl font-bold text-balance">

// Body text
<p className="text-gray-400 text-pretty">
```

---

### 8. Remove Backdrop Blur on Large Areas
**Find:** `backdrop-blur-sm` on input containers
**Action:** Increase background opacity instead

**Pattern:**
```tsx
// ❌ bg-gray-950/80 backdrop-blur-sm
// ✅ bg-gray-950/95
```

---

### 9. Remove tracking-* Unless Needed
**Find:** `tracking-wider`, `tracking-wide`
**Action:** Remove unless explicitly requested by design

**Exception:** Keep on uppercase labels if intentional

---

### 10. Fix Layout Animations
**Find:** Transitions on `w-*`, `h-*`, `top`, `left`, `margin`, `padding`
**Action:** Remove transition or use `transform`

**Example:**
```tsx
// ❌ transition-all duration-300 ${expanded ? 'w-64' : 'w-16'}
// ✅ ${expanded ? 'w-64' : 'w-16'}  // instant toggle
```

---

## Component-by-Component Checklist

### ChatInput.tsx
- [ ] Remove gradient on focus border (line 166)
- [ ] Remove gradient dividers (line 198, 202)
- [ ] Remove gradient on image overlay (line 216)
- [ ] Remove backdrop-blur-sm (line 168, 232)
- [ ] Add aria-label to image button (line 264)
- [ ] Add aria-label to canvas button (line 294)
- [ ] Fix transition-all to specific properties (12 places)
- [ ] Change duration-300 to duration-200 (8 places)
- [ ] Change w-7 h-7 to size-7 (line 220)
- [ ] Remove tracking-wider (line 200)

### Sidebar.tsx
- [ ] Remove width animation (line 86)
- [ ] Add aria-label to toggle button (line 94)
- [ ] Add text-balance to heading (line 92)
- [ ] Change transition-all to transition-colors (line 116)
- [ ] Add duration-200 to transitions (line 96, 116)
- [ ] Change w-4 h-4 to size-4 (line 37)

### ChatMessage.tsx
- [ ] Add text-pretty to prose (line 77, 119)
- [ ] Change w-5 h-5 to size-5 (icons)
- [ ] Change w-8 h-8 to size-8 (avatar)
- [ ] Add duration-200 to transition (line 101)

### ChatPage.tsx
- [ ] Add aria-label to canvas toggle (line 348)
- [ ] Change w-5 h-5 to size-5 (line 357)
- [ ] Add duration-200 to transitions (line 349, 364, 397)

### CanvasPanel.tsx
- [ ] Remove transition-all duration-300 (line 144)
- [ ] Change z-50 to z-dropdown (line 180)
- [ ] Add aria-label to close button (line 156)
- [ ] Add aria-label to delete buttons (line 217)
- [ ] Add text-balance to heading (line 168)
- [ ] Add duration-200 to all transitions (8 places)
- [ ] Change w-4 h-4 to size-4 (icons)

### PackagingTool.tsx
- [ ] Change z-50 to z-dropdown (line 152)
- [ ] Add text-balance to heading (line 112)
- [ ] Add text-pretty to description (line 113)
- [ ] Change transition-all to transition-colors (line 125)
- [ ] Add aria-label to preset buttons (line 193, 216)
- [ ] Add duration-200 to transitions (5 places)
- [ ] Change w-4 h-4 to size-4 (icons)

---

## Testing Checklist

### Visual Regression
- [ ] No gradients visible in UI
- [ ] Sidebar collapse is instant
- [ ] All transitions feel responsive (200ms)
- [ ] No unexpected layout shifts

### Performance
- [ ] Open DevTools Performance tab
- [ ] Record interaction with sidebar, chat input, canvas
- [ ] Verify no "Layout" (purple) bars during animations
- [ ] Check 60fps maintained on throttled CPU

### Accessibility
- [ ] Tab through all interactive elements
- [ ] Screen reader announces all icon buttons
- [ ] Focus visible on all elements
- [ ] Escape closes dropdowns/menus

### Motion Preferences
- [ ] Enable "Reduce motion" in OS settings
- [ ] Verify animations are instant/minimal
- [ ] Test in both macOS and Windows if possible

---

## Common Mistakes to Avoid

### ❌ Don't animate these properties:
- width, height
- top, left, right, bottom
- margin, padding
- font-size
- line-height

### ❌ Don't use:
- `transition-all` (too generic)
- `duration-300` or higher for interactions
- `backdrop-blur` on large surfaces
- Decorative gradients
- `tracking-*` unless intentional
- Arbitrary z-index values

### ✅ Do use:
- transform (translate, scale, rotate)
- opacity
- color, background-color
- box-shadow
- Specific transition properties
- duration-200 for interactions
- Semantic z-index values

---

## Quick Validation Commands

### Find potential violations:
```bash
# Find gradient usage
grep -r "bg-gradient" src/

# Find transition-all
grep -r "transition-all" src/

# Find duration-300 or higher
grep -r "duration-[3-9]" src/

# Find backdrop-blur
grep -r "backdrop-blur" src/

# Find arbitrary z-index
grep -r "z-[0-9]" src/

# Find icon buttons without aria-label (manual check needed)
grep -B2 -A2 "<button" src/ | grep -v "aria-label"
```

### Verify fixes:
```bash
# Should return nothing
grep -r "bg-gradient" src/
grep -r "transition-all" src/
grep -r "backdrop-blur" src/
grep -r "z-50" src/
```

---

## Priority Order

### High Priority (Do First)
1. ✅ Add z-index scale to Tailwind config
2. ✅ Fix ChatInput.tsx (most violations)
3. ✅ Fix Sidebar.tsx (layout animation)
4. ✅ Add aria-labels to all icon buttons

### Medium Priority
5. ✅ Fix remaining components (Canvas, ChatPage, etc.)
6. ✅ Replace transition-all everywhere
7. ✅ Add typography utilities

### Low Priority (Nice to Have)
8. ✅ Replace w-* h-* with size-*
9. ✅ Add prefers-reduced-motion support
10. ✅ Consider Radix primitives

---

## Time Estimates

| Task | Time | Priority |
|------|------|----------|
| Global config updates | 15 min | High |
| ChatInput.tsx fixes | 45 min | High |
| Sidebar.tsx fixes | 30 min | High |
| ChatPage.tsx fixes | 20 min | Medium |
| ChatMessage.tsx fixes | 15 min | Medium |
| CanvasPanel.tsx fixes | 30 min | Medium |
| PackagingTool.tsx fixes | 25 min | Medium |
| Testing & validation | 60 min | High |
| **Total** | **4 hours** | |

---

## Resources

- Full documentation: `BASELINE-UI-REFERENCE.md`
- Working example: `BASELINE-UI-ChatInput.reference.tsx`
- Summary: `BASELINE-UI-SUMMARY.md`
- Baseline-UI guidelines: https://github.com/anthropics/claude-code

---

## Questions?

If stuck on a specific pattern, check the full reference docs or the working ChatInput example. All fixes are documented with before/after code snippets.
