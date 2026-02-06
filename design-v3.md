# Design V3 — YT-Assist

Inspired by t3.chat. Stay with shadcn/ui. Colors are loose — the layout, spacing, and interaction patterns are what matter here.

---

## 1. Layout — The Big Picture

No separate chat header bar. The layout is three zones only: sidebar, message area, input box. The input box lives at the very bottom and the model selector lives inside it, not above it.

```
┌──────────┬─────────────────────────────────┐
│          │                                 │
│ Sidebar  │     Message Area                │
│          │     (scrollable, full height)   │
│          │                                 │
│          │  ┌─────────────────────────┐    │
│          │  │  Type your message...   │    │
│          │  │  [Model ∨] [Search] [📎] [↑] │    │
│          │  └─────────────────────────┘    │
│          │       ← breathing room →        │
└──────────┴─────────────────────────────────┘
```

- The top of the page (when sidebar is collapsed) has only 3 small icon buttons: sidebar toggle, search, new chat (`+`). Top-right has share and settings icons. These are minimal — not a full header bar.
- The input box is a **rounded container that floats** above the viewport bottom with visible padding below it. It does not stretch edge-to-edge.
- No chat header row with provider/model selects. That's gone. The model selector moves into the input box toolbar.

---

## 2. Sidebar

### Structure (from screenshots)

- **Title:** "T3.chat" (or "YT-Assist" for us) top-left, plain text, medium weight. No logo.
- **New Chat button:** Full width, tall (py-2.5 or so), has a **colored background** — this is the one accent-colored element in the sidebar. Rounded-lg. No `+` icon visible in t3.chat — just the text "New Chat" centered. It stands out immediately.
- **Search:** Below New Chat. A full-width input with a magnifying glass icon on the left. Placeholder: "Search your threads...". Background is slightly lighter than the sidebar — it reads as an input field, not a button.
- **Date grouping:** "Today" appears as a small muted label above the chat list. This is a section header. Not a border, not a card — just tiny colored text (the accent color, low opacity or muted). Chats are just listed under it as plain text rows.
- **Chat items:** Title only on one line. No icon, no timestamp shown in the row. Just the chat title, truncated. Very minimal.
- **Active chat:** Not visible in these screenshots (only one chat exists), but standard pattern: subtle background fill.
- **Bottom of sidebar:** User avatar (circle), username, and tier label ("Free"). This sits at the very bottom, separated from the chat list by the remaining space. It's pinned to the bottom.
- **Collapse:** When collapsed, the sidebar disappears entirely. The top-left toggle button (looks like a sidebar/panel icon, not a chevron) brings it back.

### What to change from our current Sidebar + ChatList

| Current | V3 Target |
|---|---|
| Two sidebars: main app Sidebar (`w-16`/`w-64`) + ChatList (`w-64`) inside ChatPage | One sidebar. When in chat mode, the main sidebar becomes the chat sidebar. |
| ChatList "New Chat" is a basic `size="sm"` Button | Full-width, accent-colored background, taller, centered text |
| No search input | Add search input below New Chat with magnifying glass icon |
| Chat items have a `MessageCircle` icon | Remove it. Title text only. |
| No date group labels | Add "Today" / "Yesterday" / "Last 7 days" section labels above grouped chats |
| No user info in sidebar | Pin a user/tier row to the bottom of the sidebar (can be placeholder for now) |
| Sidebar toggle is a ChevronLeft that rotates | Use a panel/sidebar icon (like `SidebarLeft` from lucide). No rotation animation needed. |

---

## 3. Top Bar (Collapsed Sidebar State)

When the sidebar is closed, the top-left area shows three small icon buttons in a row:

1. **Sidebar toggle** — panel icon, opens the sidebar
2. **Search** — magnifying glass, opens search (same as the sidebar search)
3. **New chat** — `+` icon, creates a new chat

These are ghost-style icon buttons. Small (`h-8 w-8` or similar). No labels, no borders between them. They just sit there quietly.

Top-right has two icons: a share/export icon and a settings/sliders icon. The settings icon opens a dropdown (see section 6).

When the sidebar IS open, these top-left icons disappear (the sidebar header takes their place). The top-right icons stay.

---

## 4. Message Input Box

This is the most important surface. Everything about it in t3.chat is deliberate.

### Structure

```
┌──────────────────────────────────────────────┐
│                                              │
│  Type your message here...                   │  ← textarea
│                                              │
│  Kimi K2  (0905) ∨   🔍 Search   📎      ↑  │  ← toolbar
│                                              │
└──────────────────────────────────────────────┘
```

- **Rounded on all four corners.** Rounded-lg or rounded-xl. It's a self-contained box, not flush to any edge.
- **Floats above the bottom.** There's clear padding/margin below the box to the viewport edge. It's not pinned to the bottom — it breathes.
- **Textarea and toolbar are in the same container.** No border between them. No separate background on the toolbar row. It's one unified box with a subtle border around the whole thing.
- **Textarea** is the top portion. Placeholder text is muted. Auto-grows with content.
- **Toolbar row** is the bottom portion. Left-aligned items, send button on the far right.

### Toolbar contents (left to right)

1. **Model selector** — `Kimi K2` in medium weight, `(0905)` in muted/lighter weight, then a small chevron-down `∨`. This is a button that opens the model picker (see section 5). It's not a form input — it's styled as inline text with a dropdown arrow.
2. **Search toggle** — an icon + the word "Search" as a pill/button. Has its own subtle border or background to distinguish it from the model selector. This is a toggle — when active it presumably changes appearance.
3. **Attachment** — a paperclip icon button. Ghost style.
4. **Send button** — far right, accent-colored background (the pink/magenta from the screenshots), arrow-up icon only. No text. Rounded. This and the New Chat button are the only two accent-colored elements on the page.

### What to change from our current ChatInput

| Current | V3 Target |
|---|---|
| Full-width `border-t` container | Rounded floating box with padding below |
| Toolbar has `bg-muted/30` + its own `border-t` | No toolbar background. One border around the whole box. |
| Send button: text "Send" + icon, default primary style | Icon-only (arrow up), accent background, rounded |
| Model selector is in a separate header bar above messages | Move into the input toolbar, left side, as inline text + chevron |
| Keyboard hints (`↵ send`, `⇧↵ line`) between toolbar and send | Remove or hide. t3.chat doesn't show these. Keep it clean. |
| Notes/drawing attachment indicators are separate cards above the input | If kept, move them inside the rounded box, above the textarea |
| `px-8 pt-6 pb-8` wrapper | Tighter: `px-4 pb-6` or similar. The rounded box itself is the breathing room. |

---

## 5. Model Picker (Opens From Toolbar)

The model selector in the toolbar is a button. Tapping it opens a **large panel that pops up from the input box**, anchored to that button. It opens upward.

### Panel structure (top to bottom)

1. **Upgrade banner** — a row with "Unlock all models" text, "$8/month" in accent color, and an "Upgrade" button. This is t3.chat-specific (paid tiers). We can skip this or replace with something relevant.
2. **Search input** — full width, with a magnifying glass on the left and a filter/funnel icon on the right. Placeholder: "Search models..."
3. **Model list** — each row is structured as:
   - **Left column:** Provider icon (small, ~20px). These are the actual brand logos/icons — OpenAI swirl, Anthropic "A", Google diamond, Meta infinity, etc. They sit in their own narrow column.
   - **Center:** Model name in medium weight. Can have badge icons next to it (star for favorites, gem for premium). Below the name, a short description in muted smaller text (e.g., "Lightning-fast with surprising capability").
   - **Right column:** Capability icons — small icons indicating what the model can do (vision/eye icon, image generation icon, etc.). And an info `(i)` icon.
4. **Collapsible section** at the bottom: "9 legacy models" with a chevron — tap to expand older models.

### Simplified version for us

We don't need the provider brand icons or capability badges right now. The key structural patterns to adopt:

- Opens **upward** from the toolbar button, not as a dropdown from a header
- Has a **search/filter input** at the top
- Model rows have: **name** (medium weight) + **description** (muted, smaller, below the name)
- Provider is shown as a **section label** or as a small muted tag next to the model name
- The panel has a visible border and rounded corners, same radius as the input box
- It's wider than the trigger button — it spans most of the input box width

---

## 6. Settings Dropdown

The settings icon (top-right, sliders icon) opens a small dropdown. From the screenshot:

- **Theme row:** Label "Theme" on the left. Three icon buttons on the right: sun (light), monitor (system/auto), moon (dark). The active one has a filled/highlighted background. These are toggle-style, not a select.
- **Boring Mode:** Label on left, a toggle switch on the right. (t3.chat-specific — we can skip or replace.)
- **Settings link:** A row with a gear icon + "Settings" text. Taps through to a settings page.

The dropdown itself: rounded-lg, subtle border, dark background matching the app. No shadow (or very subtle). Small — it only contains these 3 items.

### For us

- Replace "Boring Mode" with something relevant or drop it
- The theme toggle pattern (3 icon buttons in a row) is worth adopting — cleaner than a select dropdown for theme switching
- The settings link can point to wherever settings live

---

## 7. Message Bubbles

From screenshot 1 (the conversation view):

- **User message ("Hey"):** Right-aligned. Sits in a small rounded pill/bubble with a subtle background (slightly lighter than the page). Not full-width — it's sized to its content. Rounded on all corners.
- **Assistant message:** Left-aligned, full width. No background, no bubble. Just the text directly on the page background. No avatar or label prefix — the position (left vs right) and styling (bubble vs plain) is the only indicator of who said what.
- No avatars anywhere in the conversation.

### What to change from our current ChatMessage

| Current | V3 Target |
|---|---|
| Check current implementation | User messages: content-width rounded bubble, right-aligned, subtle bg |
| | Assistant messages: left-aligned, no background, no bubble |
| | No avatars, no role labels |

---

## 8. Empty / Welcome State

When no conversation is active (or it's a new chat), t3.chat shows a welcome screen in the main area:

- **Large greeting:** "How can I help you, [username]?" — centered, large font (maybe 24-28px), medium-bold weight. This is the focal point of the empty state.
- **Category pills:** Below the greeting, a row of pill-shaped buttons: "Create", "Explore", "Code", "Learn". Each has a small icon. These are suggestion categories — tapping one presumably pre-fills or filters the input. They have a subtle border and rounded-full shape.
- **Suggestion prompts:** Below the pills, a vertical list of plain text suggestions: "How does AI work?", "Are black holes real?", etc. These are tappable — they fill the input and send. They're styled as plain muted text, no borders or backgrounds. Just text that becomes a link on hover.

### For us

- The greeting + category pills pattern is strong. We can adapt the categories to YouTube-relevant ones: "Titles", "Thumbnails", "Descriptions", "Scripts" or similar.
- Suggestion prompts should be YouTube-relevant too.
- This replaces our current "Select a chat or start a new one" empty state entirely.

---

## 9. Dropdowns & Popovers (General Pattern)

Consistent across settings dropdown and model picker:

- **Border:** 1px, subtle (matches the border color token). Present on all dropdowns.
- **Border radius:** `rounded-lg`. Consistent.
- **Background:** Matches the card/popover color — slightly lifted from the page background.
- **No shadow** (or barely perceptible). The border does the job.
- **Item spacing:** `px-3 py-2` per row.
- **Hover:** Subtle background fill shift. No text color change.
- **Animation:** Appears instantly or with a very fast fade (100ms max). No slide, no bounce.

---

## 10. Scrollbars

Thin. The screenshots don't show scrollbars explicitly but the overall aesthetic demands it.

- **Width:** 4-6px
- **Track:** Transparent
- **Thumb:** Muted foreground, `border-radius: 3px`
- **Hover:** Slightly brighter thumb. Nothing else.

Current scrollbar is 8px — reduce it.

---

## 11. Typography

- **Body / messages:** 13-14px. Already correct.
- **Greeting text (empty state):** 24-28px, font-semibold or bold.
- **Sidebar title ("T3.chat"):** 16px, font-semibold.
- **New Chat button:** 13-14px, font-medium, centered.
- **Search placeholder:** 13px, muted.
- **Date group labels ("Today"):** 11-12px, font-medium, accent/muted color. NOT uppercase in t3.chat — it's capitalized normally.
- **Model name in toolbar:** 13px, font-semibold. The version/variant in parens is lighter weight and muted.
- **Model descriptions in picker:** 12px, muted foreground.
- **Suggestion prompts:** 14-15px, muted. Left-aligned, not centered.

---

## 12. Color Roles (not specific values)

Only two things get the accent color (the pink/magenta in t3.chat):

1. **New Chat button** — background
2. **Send button** — background

Everything else is neutral: whites, grays, blacks. Date group labels ("Today") get a muted version of the accent or just a slightly brighter gray. The accent draws the eye to exactly two actions: start a conversation, send a message.

---

## 13. Performance & Interaction Patterns

Things that make t3.chat feel snappy — none of these are visual flourishes, they're absences of friction:

- **No layout shift on sidebar toggle.** The main content area doesn't reflow — it just gets wider/narrower smoothly.
- **Input focus is automatic** on new chat and on chat switch. User never has to click into the textarea.
- **Model picker closes on outside click immediately.** No delay.
- **Typing is zero-latency.** No debounce, no throttle on the textarea.
- **Scroll position preserved** across chat switches. Already implemented.
- **Transitions: 150ms max.** Currently at 200ms ceiling — tighten toward 150ms where possible.

---

## 14. What NOT to do

- No glassmorphism, no backdrop-blur.
- No gradients.
- No animated icons or spinners that cause layout shift.
- No full-page transitions between tools.
- The model picker is NOT a small dropdown. It's a substantial panel. Don't make it tiny.
- Don't put the model selector back in a header bar. It belongs in the input box toolbar.
- Don't add labels/text to the send button. Icon only.

---

## 15. Implementation Priority

1. **Input box restructure** — rounded floating container, toolbar inside, no separate header. Move model selector here. This is the single biggest visual change.
2. **Model selector** — move into toolbar as text + chevron. Build the upward-opening picker panel with search.
3. **Sidebar consolidation** — merge app sidebar and chat list. New Chat accent button, search input, date groups, remove chat icons, add bottom user row.
4. **Empty/welcome state** — greeting + category pills + suggestion prompts.
5. **Message bubbles** — user messages as right-aligned content-width pills.
6. **Top bar icons** — the 3 icons when sidebar is collapsed.
7. **Settings dropdown** — theme toggle pattern, settings link.
8. **Scrollbars** — thin them down. Trivial CSS change.
