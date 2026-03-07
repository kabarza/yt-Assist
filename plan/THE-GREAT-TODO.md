# THE GREAT TODO: YT-Assist Remaining Work

**Date:** February 9, 2026
**Current Status:** Validation In Progress (feature-rich, but current branch is not release-ready)
**Remaining:** Backlog requires re-triage against actual implementation

---

## Validation Snapshot (Feb 9, 2026)

- Automated tests: **not configured** (`package.json` has no `test` script and no test suites were found)
- Typecheck/build gate: **failing**
  - Command run: `npm run build`
  - Current failures: `src/chat/ModelPicker.tsx`, `src/components/ComparisonModeSelector.tsx`, `src/components/FolderList.tsx`, `src/components/OutputDiffView.tsx`, `src/components/Sidebar.tsx`, `src/components/ThumbnailPreview.tsx`, `src/tools/comments/CommentRepliesTool.tsx`
- Status notes below were updated using direct source inspection in `src/` and `server/`

---

## Priority Levels

- 🔴 **Critical** - Security/stability issues, must fix before public deployment
- 🟠 **High** - Significant UX improvements, partially implemented features
- 🟡 **Medium** - Nice-to-have features, polish items
- 🟢 **Low** - Future enhancements, experimental features

---

## Table of Contents

1. [Critical Security & Stability](#critical-security--stability)
2. [High Priority Features](#high-priority-features)
3. [Partially Implemented Features](#partially-implemented-features)
4. [Design V3 Implementation](#design-v3-implementation)
5. [Accessibility Polish](#accessibility-polish)
6. [Performance Optimizations](#performance-optimizations)
7. [Feature Enhancements](#feature-enhancements)
8. [New Features (Not Started)](#new-features-not-started)
9. [Infrastructure & DevOps](#infrastructure--devops)
10. [Documentation](#documentation)

---

## Critical Security & Stability

### 🔴 1. API Key Security

**Current Issue:**
- API keys stored in localStorage (visible in DevTools)
- XSS vulnerability risk
- Not suitable for production multi-user deployment

**TODO:**
```typescript
// Move to server-side environment variables
// .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

// server/index.ts
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

// Remove client-side API key storage
// Delete from settingsStore
// Update API routes to use server-side keys
```

**Implementation:**
1. Remove API key inputs from Settings dialog
2. Load keys from server environment
3. Update backend routes to use env vars
4. Add key validation on server startup
5. Remove localStorage API key storage

**Files to Modify:**
- `server/routes/anthropic.ts`
- `server/routes/openai.ts`
- `src/components/SettingsDialog.tsx`
- `src/stores/settingsStore.ts`

---

### 🔴 2. Rate Limiting

**Current Issue:**
- No request throttling
- Vulnerable to abuse
- Could rack up unexpected API costs

**TODO:**
```typescript
// server/middleware/rateLimit.ts
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'minute',
});

export const rateLimitMiddleware = async (c, next) => {
  const remaining = await limiter.removeTokens(1);
  if (remaining < 0) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  await next();
};
```

**Implementation:**
1. Install `limiter` package
2. Create rate limit middleware
3. Apply to API routes
4. Add per-IP tracking
5. Return 429 status when exceeded
6. Add retry-after header

**Files to Create:**
- `server/middleware/rateLimit.ts`

**Files to Modify:**
- `server/index.ts`

---

### 🔴 3. Input Validation & Sanitization

**Current Issue:**
- No server-side validation
- Accepts any message content
- Potential for prompt injection

**TODO:**
```typescript
// server/utils/validation.ts
export function validateChatRequest(body: unknown) {
  const schema = z.object({
    model: z.string().min(1),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.array(z.union([
        z.object({ type: z.literal('text'), text: z.string().max(100000) }),
        z.object({ type: z.literal('image'), imageData: z.string(), mimeType: z.string() }),
      ])),
    })),
    stream: z.boolean().optional(),
    webSearch: z.boolean().optional(),
    systemPrompt: z.string().max(10000).optional(),
  });

  return schema.parse(body);
}
```

**Implementation:**
1. Install `zod` for schema validation
2. Create validation schemas
3. Validate all incoming requests
4. Sanitize user inputs
5. Return 400 for invalid requests
6. Add content length limits

**Files to Create:**
- `server/utils/validation.ts`

**Files to Modify:**
- `server/routes/anthropic.ts`
- `server/routes/openai.ts`

---

### 🔴 4. HTTPS Enforcement

**Current Issue:**
- No HTTPS redirect
- Vulnerable to man-in-the-middle attacks

**TODO:**
```typescript
// server/middleware/https.ts
export const httpsRedirect = (c, next) => {
  const proto = c.req.header('x-forwarded-proto');
  if (proto === 'http') {
    return c.redirect(`https://${c.req.header('host')}${c.req.url}`, 301);
  }
  return next();
};
```

**Implementation:**
1. Add HTTPS redirect middleware
2. Set security headers (HSTS, CSP, X-Frame-Options)
3. Force HTTPS in production
4. Add SSL/TLS certificate setup guide

**Files to Create:**
- `server/middleware/https.ts`
- `server/middleware/security.ts`

---

## High Priority Features

### 🟠 5. Canvas Export as Image/PDF

**Status:** Partially Implemented
- `html2canvas` dependency installed
- Notes export to PNG is wired in `src/chat/CanvasPanel.tsx`
- Drawing export to PNG is wired via `captureImage()`
- PDF/SVG export options are not implemented

**TODO:**
```typescript
// src/chat/CanvasPanel.tsx
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const exportAsImage = async () => {
  const element = canvasRef.current;
  const canvas = await html2canvas(element, {
    backgroundColor: '#0a0a0a',
  });

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `canvas-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
};

const exportAsPDF = async () => {
  const element = canvasRef.current;
  const canvas = await html2canvas(element);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`canvas-${Date.now()}.pdf`);
};
```

**Implementation:**
1. Install `jspdf` package
2. Add ref to canvas container
3. Wire up export buttons
4. Add loading states
5. Handle drawing canvas export (tldraw has built-in export)
6. Add export format selector (PNG, PDF, SVG)

**Files to Modify:**
- `src/chat/CanvasPanel.tsx`
- `src/chat/DrawingCanvas.tsx`

---

### 🟠 6. Mermaid Diagram Support

**Status:** Mostly Implemented
- `mermaid` dependency installed (v11)
- Extension exists and is wired into TipTap editor
- Insert-diagram button exists in canvas toolbar
- Remaining work is polish (preview UX, error handling, syntax helpers)

**TODO:**
```typescript
// src/extensions/MermaidExtension.tsx
import { Node } from '@tiptap/core';
import mermaid from 'mermaid';

export const MermaidDiagram = Node.create({
  name: 'mermaidDiagram',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'text*',

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'mermaid', ...HTMLAttributes }, 0];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'mermaid-diagram';

      mermaid.initialize({ startOnLoad: false, theme: 'dark' });

      mermaid.render('diagram-' + Date.now(), node.textContent, (svg) => {
        dom.innerHTML = svg;
      });

      return { dom };
    };
  },
});
```

**Implementation (remaining):**
1. Improve mermaid syntax error presentation
2. Add better authoring UX (templates/snippets)
3. Add optional live preview toggle for large diagrams
4. Add tests for rendering and theme changes

**Files to Modify:**
- `src/chat/CanvasPanel.tsx`
- `src/extensions/MermaidExtension.tsx`

---

### 🟠 7. Drag-and-Drop Chat to Folder

**Status:** Implemented (native HTML drag-and-drop)
- Folder system exists
- Drag source/drop targets are implemented in `src/components/FolderList.tsx`
- `dnd-kit`-based implementation below is now optional enhancement, not required for baseline functionality

**TODO:**
```typescript
// src/components/ChatList.tsx
import { useDraggable, useDroppable } from '@dnd-kit/core';

const DraggableChat = ({ chat }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: chat.id,
    data: { type: 'chat', chat },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {/* chat item UI */}
    </div>
  );
};

const DroppableFolder = ({ folder }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: folder.id,
    data: { type: 'folder', folder },
  });

  return (
    <div ref={setNodeRef} className={isOver ? 'bg-lime-500/10' : ''}>
      {/* folder UI */}
    </div>
  );
};

// In sidebar
<DndContext onDragEnd={handleDragEnd}>
  {folders.map(folder => (
    <DroppableFolder key={folder.id} folder={folder} />
  ))}

  {chats.map(chat => (
    <DraggableChat key={chat.id} chat={chat} />
  ))}
</DndContext>
```

**Implementation (remaining):**
1. Add keyboard-accessible move actions for non-pointer users
2. Improve drop-target visual feedback
3. Decide whether to migrate from native DnD to `dnd-kit`
4. Add regression tests for folder move behavior

**Files to Modify:**
- `src/components/Sidebar.tsx`
- `src/components/FolderList.tsx`

---

### 🟠 8. Cloud Sync (Optional Account System)

**Status:** Not Started
**Priority:** High for multi-device users

**TODO:**
```typescript
// New backend routes
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

POST /api/sync/chats
POST /api/sync/canvas
POST /api/sync/settings
GET  /api/sync/pull
POST /api/sync/push

// Sync strategy
1. Conflict resolution (last-write-wins or merge)
2. Differential sync (only changed data)
3. Encryption at rest (user data)
4. Background sync (service worker)
5. Sync status indicator
```

**Implementation:**
1. Add authentication system (JWT or session)
2. Create database schema (PostgreSQL or MongoDB)
3. Implement sync endpoints
4. Add sync conflict resolution
5. Create account settings UI
6. Add sync status indicator
7. Implement background sync
8. Add data encryption

**Dependencies:** Database, auth provider (Clerk, Auth0, or custom)

**Files to Create:**
- `server/routes/auth.ts`
- `server/routes/sync.ts`
- `server/db/schema.ts`
- `src/components/AccountDialog.tsx`
- `src/hooks/useSync.ts`

---

### 🟠 9. Model Comparison - Add Cost/Speed Metrics

**Status:** Partially Implemented
- Comparison mode exists
- Shows responses side-by-side
- Missing: cost comparison, speed metrics, quality ratings

**TODO:**
```typescript
// Add to ComparisonView
interface ComparisonMetrics {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latency: number; // ms to first token
  duration: number; // ms total
  throughput: number; // tokens/sec
}

// Display metrics table
<div className="grid grid-cols-3 gap-4 mb-4">
  {comparisons.map(({ model, metrics }) => (
    <div key={model}>
      <h3>{model}</h3>
      <p>Cost: ${metrics.cost.toFixed(4)}</p>
      <p>Latency: {metrics.latency}ms</p>
      <p>Speed: {metrics.throughput} tok/s</p>
    </div>
  ))}
</div>

// Add quality rating UI
<button onClick={() => rateResponse(model, 'winner')}>
  👍 Best Response
</button>
```

**Implementation:**
1. Track metrics during generation
2. Calculate throughput and latency
3. Display metrics table
4. Add quality rating buttons
5. Store ratings for future reference
6. Add comparison history

**Files to Modify:**
- `src/components/ComparisonView.tsx`
- `src/chat/ChatPage.tsx`

---

## Partially Implemented Features

### 🟡 10. Stop Generation Button

**Status:** Implemented ✓ (regression testing still needed)
**Location:** `ChatInput.tsx`

**TODO:**
- [ ] Test with long-running responses
- [ ] Add visual feedback (spinner → stop icon)
- [ ] Handle abort edge cases
- [ ] Add keyboard shortcut (Escape)

---

### 🟡 11. AI Suggestions Panel

**Status:** Implemented
**Location:** `src/chat/AISuggestionsPanel.tsx`

**TODO:**
```typescript
// Wire up AI suggestion generation
const generateSuggestions = async () => {
  const response = await fetch('/api/chat/anthropic', {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4',
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: `Based on this canvas content:\n\n${canvasContent}\n\nSuggest 3 additions or improvements.`,
        }],
      }],
    }),
  });

  // Parse and display suggestions
};
```

**Implementation (remaining):**
1. Add explicit provider/model selection per suggestion run (optional)
2. Improve malformed JSON handling from model responses
3. Add test coverage for suggestion parse/apply flow

**Files to Modify:**
- `src/chat/AISuggestionsPanel.tsx`
- `src/chat/CanvasPanel.tsx`

---

### 🟡 12. Batch Processing - Progress Tracking

**Status:** Partially Implemented
**Location:** `src/tools/packaging/BatchView.tsx`

**TODO:**
```typescript
// Add progress state
const [progress, setProgress] = useState({
  current: 0,
  total: 0,
  status: 'idle' | 'processing' | 'done',
});

// Process with updates
for (let i = 0; i < transcripts.length; i++) {
  setProgress({ current: i + 1, total: transcripts.length, status: 'processing' });
  await processTranscript(transcripts[i]);
}

// Progress UI
<div className="w-full bg-gray-800 rounded-full h-2">
  <div
    className="bg-lime-500 h-2 rounded-full transition-all"
    style={{ width: `${(progress.current / progress.total) * 100}%` }}
  />
</div>
<p>{progress.current} / {progress.total} processed</p>
```

**Implementation:**
1. Add progress state
2. Update during processing
3. Add progress bar UI
4. Add cancel button
5. Add results summary table

**Files to Modify:**
- `src/tools/packaging/BatchView.tsx`

---

### 🟡 13. Competitor Analysis - URL Fetching

**Status:** UI exists, manual paste only
**Location:** `src/tools/packaging/CompetitorAnalysisView.tsx`

**TODO:**
```typescript
// Add YouTube API integration
const fetchVideoData = async (url: string) => {
  const videoId = extractVideoId(url);
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${YOUTUBE_API_KEY}`
  );

  const data = await response.json();
  return {
    title: data.items[0].snippet.title,
    description: data.items[0].snippet.description,
    views: data.items[0].statistics.viewCount,
    likes: data.items[0].statistics.likeCount,
    thumbnail: data.items[0].snippet.thumbnails.high.url,
  };
};
```

**Implementation:**
1. Add YouTube Data API integration
2. Auto-fetch video metadata from URL
3. Display thumbnail preview
4. Show view/like stats
5. Extract transcript (via youtube-transcript-api or similar)
6. Generate comparison analysis

**Files to Modify:**
- `src/tools/packaging/CompetitorAnalysisView.tsx`

**Dependencies:**
- YouTube Data API key
- youtube-transcript-api (backend)

---

### 🟡 14. Analytics View - AI Insights

**Status:** Partially Implemented
**Location:** `src/tools/packaging/AnalyticsView.tsx`

**TODO:**
```typescript
// Line 38: Comment about "ACTIONABLE RECOMMENDATIONS" implementation
// Add AI analysis of analytics data

const analyzeAnalytics = async (data: AnalyticsData) => {
  const prompt = `Analyze this YouTube channel analytics data and provide actionable recommendations:

Views: ${data.views}
Watch time: ${data.watchTime}
CTR: ${data.ctr}%
Retention: ${data.retention}%

Provide:
1. 3 specific improvements for thumbnails
2. 3 specific improvements for titles
3. 3 content strategy recommendations`;

  const response = await fetch('/api/chat/anthropic', {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });

  return response;
};
```

**Implementation:**
1. Parse analytics CSV/JSON upload
2. Generate AI analysis prompt
3. Stream recommendations
4. Display in structured format
5. Add export recommendations button

**Files to Modify:**
- `src/tools/packaging/AnalyticsView.tsx`

---

## Design V3 Implementation

Based on `design-v3.md`, the following design changes are pending:

### 🟡 15. Welcome Screen with Category Pills

**Status:** Implemented (without user-name personalization)

**TODO:**
```tsx
// src/chat/WelcomeScreen.tsx - redesign
<div className="flex flex-col items-center justify-center h-full px-8 py-16">
  <h1 className="text-2xl font-semibold text-gray-100 mb-6 text-center">
    How can I help you, {userName}?
  </h1>

  {/* Category pills */}
  <div className="flex gap-3 mb-8">
    {['Titles', 'Thumbnails', 'Descriptions', 'Scripts'].map(category => (
      <button
        key={category}
        className="px-4 py-2 rounded-full border border-gray-700 text-sm hover:bg-gray-800 transition-colors"
        onClick={() => handleCategory(category)}
      >
        <Icon className="inline mr-2" />
        {category}
      </button>
    ))}
  </div>

  {/* Suggestion prompts */}
  <div className="w-full max-w-md space-y-2">
    {examplePrompts.map(prompt => (
      <button
        key={prompt}
        className="w-full text-left px-4 py-3 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-colors"
        onClick={() => handlePrompt(prompt)}
      >
        {prompt}
      </button>
    ))}
  </div>
</div>
```

**Implementation:**
1. Redesign WelcomeScreen component
2. Add category pills with icons
3. Add YouTube-specific example prompts
4. Style with t3.chat aesthetic
5. Add greeting with user name (placeholder or from settings)

**Files to Modify:**
- `src/chat/WelcomeScreen.tsx`

---

### 🟡 16. Message Bubbles - User Right-Aligned

**Status:** Implemented

**TODO:**
```tsx
// src/chat/ChatMessage.tsx - update styling
// User messages: right-aligned, rounded bubble
<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
  {isUser ? (
    <div className="max-w-[80%] px-4 py-2 bg-gray-800 rounded-2xl text-gray-100">
      {content}
    </div>
  ) : (
    <div className="max-w-none text-gray-100">
      {content}
    </div>
  )}
</div>
```

**Implementation:**
1. Add conditional styling for user messages
2. Right-align user message container
3. Content-width bubble (not full width)
4. Remove avatars
5. Remove role labels
6. Keep assistant messages plain (no bubble)

**Files to Modify:**
- `src/chat/ChatMessage.tsx`

---

### 🟡 17. Model Picker - Upward-Opening Panel

**Status:** Implemented (currently includes a TypeScript prop error to fix)

**TODO:**
```tsx
// src/chat/ModelPicker.tsx - redesign panel
// Panel opens upward from toolbar button
<div className="relative">
  <button
    onClick={togglePicker}
    className="flex items-center gap-2 text-sm"
  >
    <span className="font-semibold">{modelName}</span>
    <span className="text-gray-500">({modelVersion})</span>
    <ChevronDown className="w-4 h-4" />
  </button>

  {isOpen && (
    <div className="absolute bottom-full mb-2 left-0 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
      {/* Search input */}
      <div className="p-3 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search models..."
          className="w-full px-3 py-2 bg-gray-800 rounded-lg"
        />
      </div>

      {/* Model list */}
      <div className="max-h-96 overflow-y-auto p-2">
        {filteredModels.map(model => (
          <button
            key={model.id}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            <div className="font-medium">{model.name}</div>
            <div className="text-sm text-gray-500">{model.description}</div>
          </button>
        ))}
      </div>
    </div>
  )}
</div>
```

**Implementation:**
1. Redesign ModelPicker to open upward
2. Add search/filter input
3. Add model descriptions
4. Style as large panel (not tiny dropdown)
5. Position relative to toolbar button

**Files to Modify:**
- `src/chat/ModelPicker.tsx`

---

### 🟡 18. Floating Input Box Design

**Status:** Implemented

**TODO:**
```tsx
// src/chat/ChatInput.tsx - redesign container
<div className="px-8 pb-6">
  <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
    {/* Textarea */}
    <textarea
      className="w-full px-6 py-4 bg-transparent resize-none focus:outline-none"
      placeholder="Type your message..."
      rows={3}
    />

    {/* Toolbar */}
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800">
      <div className="flex items-center gap-4">
        <ModelPicker />
        <SearchToggle />
        <AttachButton />
      </div>

      <button className="px-4 py-2 bg-lime-500 rounded-lg">
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

**Implementation:**
1. Add max-width container
2. Add rounded corners to input box
3. Add padding below (breathing room)
4. Unified border around whole box
5. Move model selector to toolbar
6. Icon-only send button

**Files to Modify:**
- `src/chat/ChatInput.tsx`

---

### 🟡 19. Sidebar - Top Icons When Collapsed

**Status:** Implemented

**TODO:**
```tsx
// src/components/Sidebar.tsx - add top icons
{!expanded && (
  <div className="fixed top-4 left-4 flex gap-2">
    <button className="p-2 hover:bg-gray-800 rounded-lg">
      <SidebarIcon className="w-5 h-5" />
    </button>
    <button className="p-2 hover:bg-gray-800 rounded-lg">
      <Search className="w-5 h-5" />
    </button>
    <button className="p-2 hover:bg-gray-800 rounded-lg">
      <Plus className="w-5 h-5" />
    </button>
  </div>
)}
```

**Implementation:**
1. Add icon buttons when sidebar collapsed
2. Position fixed top-left
3. Sidebar toggle
4. Search (opens search modal)
5. New chat

**Files to Modify:**
- `src/components/Sidebar.tsx`
- `src/chat/ChatPage.tsx`

---

### 🟡 20. Thin Scrollbars (4-6px)

**Status:** Implemented

**TODO:**
```css
/* src/index.css */
/* Webkit browsers (Chrome, Safari) */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
```

**Files to Modify:**
- `src/index.css`

---

## Accessibility Polish

### 🟡 21. Touch Target Sizes

**Issue:** Some buttons < 44×44px minimum

**TODO:**
- [ ] Audit all interactive elements
- [ ] Increase size to 44×44px minimum (or add padding)
- [ ] Test on mobile devices
- [ ] Verify no accidental taps

**Files to Check:**
- All button components
- Icon buttons
- Toggle switches
- Drag handles

---

### 🟡 22. Color Contrast Adjustments

**Issue:** Some gray text on gray backgrounds may not meet WCAG AA

**TODO:**
```typescript
// Run contrast checker on:
- Muted text (text-gray-500) on bg-gray-900
- Secondary buttons (text-gray-400) on bg-gray-800
- Disabled states
- Placeholder text

// Adjust to meet 4.5:1 ratio for normal text, 3:1 for large text
```

**Tools:**
- WebAIM Contrast Checker
- Axe DevTools
- Chrome DevTools contrast ratio

---

### 🟡 23. Skip to Content Link

**Status:** Not Started

**TODO:**
```tsx
// src/App.tsx - add skip link
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-lime-500 focus:text-gray-900 focus:rounded-lg"
>
  Skip to content
</a>

<main id="main-content">
  {/* app content */}
</main>
```

**Implementation:**
1. Add skip link at top of DOM
2. Style with sr-only (hidden until focused)
3. Show on keyboard focus
4. Link to main content area

**Files to Modify:**
- `src/App.tsx`

---

### 🟡 24. Keyboard Shortcuts Help

**Status:** Implemented in `SettingsDialog` shortcuts tab (not a standalone dialog)

**TODO:**
```tsx
// src/components/KeyboardShortcutsDialog.tsx
<Dialog>
  <DialogTrigger>?</DialogTrigger>
  <DialogContent>
    <h2>Keyboard Shortcuts</h2>

    <div className="space-y-4">
      <div>
        <h3>Navigation</h3>
        <ShortcutRow keys={['Cmd', 'N']} action="New chat" />
        <ShortcutRow keys={['Cmd', 'B']} action="Toggle sidebar" />
        <ShortcutRow keys={['/']} action="Focus input" />
        <ShortcutRow keys={['Cmd', '1-4']} action="Switch tools" />
      </div>

      <div>
        <h3>Chat</h3>
        <ShortcutRow keys={['Enter']} action="Send message" />
        <ShortcutRow keys={['Shift', 'Enter']} action="New line" />
        <ShortcutRow keys={['Escape']} action="Cancel/close" />
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**Implementation (remaining):**
1. Decide whether to keep shortcuts embedded in settings or extract to dedicated dialog
2. Add dedicated `?` trigger only if standalone dialog is adopted
3. Keep shortcuts list in sync with actual bindings

**Files to Modify:**
- `src/components/SettingsDialog.tsx`

---

### 🟡 25. Reduced Motion - Full Implementation

**Status:** CSS exists, needs JS support

**TODO:**
```typescript
// src/hooks/useReducedMotion.ts
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// Usage in components
const prefersReducedMotion = useReducedMotion();

<div
  className={prefersReducedMotion ? '' : 'transition-all duration-200'}
>
  {/* content */}
</div>
```

**Implementation:**
1. Create useReducedMotion hook
2. Use in animated components
3. Disable animations when true
4. Keep instant feedback (no animations)
5. Test with system preference enabled

**Files to Create:**
- `src/hooks/useReducedMotion.ts`

**Files to Modify:**
- All components with animations

---

## Performance Optimizations

### 🟢 26. Bundle Size Reduction

**Current:** ~500KB gzipped, 1.5MB uncompressed

**TODO:**
1. **Analyze bundle:**
   ```bash
   npm run build -- --analyze
   ```

2. **Tree-shake Radix UI:**
   - Import only used components
   - Remove unused Dialog/Dropdown variants

3. **Replace Mermaid:**
   - Heavy dependency (200KB+)
   - Consider lighter alternative or lazy load

4. **Code splitting:**
   - Split tools into separate chunks
   - Lazy load tldraw canvas
   - Lazy load Mermaid

5. **CDN for heavy deps:**
   - Move React to CDN
   - Move icons to CDN sprite

**Target:** <300KB gzipped

---

### 🟢 27. Image Optimization

**TODO:**
1. **Implement thumbnails:**
   ```typescript
   const createThumbnail = (base64: string, maxWidth = 300) => {
     return new Promise((resolve) => {
       const img = new Image();
       img.onload = () => {
         const canvas = document.createElement('canvas');
         const ratio = maxWidth / img.width;
         canvas.width = maxWidth;
         canvas.height = img.height * ratio;

         const ctx = canvas.getContext('2d');
         ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

         resolve(canvas.toDataURL('image/jpeg', 0.8));
       };
       img.src = base64;
     });
   };
   ```

2. **Lazy load images:**
   - Use IntersectionObserver
   - Load thumbnails first
   - Full resolution on click

3. **Size limits:**
   - Max 5MB per image
   - Compress before upload
   - Show compression options

**Files to Modify:**
- `src/chat/ChatInput.tsx`
- `src/chat/ChatMessage.tsx`

---

### 🟢 28. Virtual Scrolling for Long Chats

**TODO:**
```typescript
// Install react-virtual
npm install @tanstack/react-virtual

// src/chat/ChatPage.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100,
  overscan: 5,
});

<div ref={parentRef} className="h-full overflow-auto">
  <div style={{ height: virtualizer.getTotalSize() }}>
    {virtualizer.getVirtualItems().map(virtualItem => (
      <div
        key={virtualItem.index}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualItem.start}px)`,
        }}
      >
        <ChatMessage message={messages[virtualItem.index]} />
      </div>
    ))}
  </div>
</div>
```

**Implementation:**
1. Install @tanstack/react-virtual
2. Implement virtualizer for message list
3. Implement virtualizer for chat list
4. Test scroll restoration
5. Handle dynamic heights

**Files to Modify:**
- `src/chat/ChatPage.tsx`
- `src/components/ChatList.tsx`

---

### 🟢 29. Service Worker for Offline Caching

**TODO:**
```typescript
// public/sw.js
const CACHE_NAME = 'yt-assist-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Register in main.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

**Implementation:**
1. Create service worker
2. Cache app shell
3. Cache API responses (with TTL)
4. Add update notification
5. Handle cache invalidation

**Files to Create:**
- `public/sw.js`

**Files to Modify:**
- `src/main.tsx`

---

## Feature Enhancements

### 🟢 30. Chat Sharing (Server-Side Store)

**TODO:**
```typescript
// Backend
POST /api/share/create
  - Save chat to database
  - Generate unique share ID
  - Return shareable URL

GET /api/share/:id
  - Fetch shared chat
  - Return read-only view

// Frontend
const shareChat = async (chatId: string) => {
  const response = await fetch('/api/share/create', {
    method: 'POST',
    body: JSON.stringify({ chatId }),
  });

  const { shareId } = await response.json();
  const shareUrl = `${window.location.origin}/share/${shareId}`;

  // Copy to clipboard
  navigator.clipboard.writeText(shareUrl);
};

// Share page component
<ShareView chatId={shareId} readOnly />
```

**Implementation:**
1. Add database for shared chats
2. Create share endpoints
3. Add share button to chat
4. Create read-only share view
5. Add optional password protection
6. Add expiration dates

---

### 🟢 31. Web Search with Anthropic (MCP Integration)

**TODO:**
```typescript
// Install MCP SDK
npm install @modelcontextprotocol/sdk

// server/mcp/brave-search.ts
import { createMCPServer } from '@modelcontextprotocol/sdk';

const braveSearchTool = {
  name: 'brave_search',
  description: 'Search the web using Brave Search API',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      count: { type: 'number', default: 10 },
    },
  },
  handler: async ({ query, count }) => {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${query}&count=${count}`,
      {
        headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY },
      }
    );

    return response.json();
  },
};

// Enable in Anthropic route
const response = await anthropic.messages.create({
  model,
  messages,
  tools: [braveSearchTool],
});
```

**Implementation:**
1. Choose search provider (Brave, Bing, Google)
2. Implement MCP server for search
3. Add tool to Anthropic route
4. Handle tool calls and results
5. Display search results with citations

**Dependencies:**
- Brave Search API key (or alternative)
- @modelcontextprotocol/sdk

---

### 🟢 32. Image Generation (DALL-E Integration)

**TODO:**
```typescript
// Backend route
POST /api/image/generate
  - Accepts prompt
  - Calls DALL-E API
  - Returns image URL

// Frontend
const generateImage = async (prompt: string) => {
  const response = await fetch('/api/image/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  const { imageUrl } = await response.json();
  return imageUrl;
};

// Add to chat input
<button onClick={() => generateImage(prompt)}>
  Generate Image
</button>
```

**Implementation:**
1. Add DALL-E route to backend
2. Add generate button to chat input
3. Display generated images in chat
4. Allow editing prompt and regenerating
5. Save to chat history

**Files to Create:**
- `server/routes/image.ts`

**Files to Modify:**
- `src/chat/ChatInput.tsx`
- `src/chat/ChatMessage.tsx`

---

### 🟢 33. Content Calendar

**TODO:**
```tsx
// New tool: Content Calendar
// src/tools/calendar/ContentCalendar.tsx

interface ContentPlan {
  id: string;
  date: Date;
  title: string;
  description: string;
  status: 'planned' | 'scripted' | 'recorded' | 'edited' | 'published';
  packaging?: PackagingOutput;
  script?: ScriptOutput;
  notes: string;
}

<Calendar
  events={contentPlans}
  onDateClick={handleCreatePlan}
  onEventClick={handleEditPlan}
/>

<ContentPlanDialog
  plan={selectedPlan}
  onSave={handleSave}
  onGeneratePackaging={() => navigateTo('packaging')}
  onGenerateScript={() => navigateTo('script')}
/>
```

**Implementation:**
1. Create calendar view component
2. Add event creation/editing
3. Link to packaging/script tools
4. Add status workflow
5. Export to CSV/iCal

**Files to Create:**
- `src/tools/calendar/ContentCalendar.tsx`
- `src/tools/calendar/ContentPlanDialog.tsx`

---

### 🟢 34. Voice Input (Speech-to-Text)

**TODO:**
```typescript
// src/hooks/useVoiceInput.ts
export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const recognition = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');

      setTranscript(transcript);
    };

    return recognition;
  }, []);

  const startListening = () => {
    if (recognition) {
      recognition.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  return { isListening, transcript, startListening, stopListening };
}

// Add to ChatInput
<button onClick={isListening ? stopListening : startListening}>
  {isListening ? <MicOff /> : <Mic />}
</button>
```

**Implementation:**
1. Create useVoiceInput hook
2. Add mic button to chat input
3. Show listening indicator
4. Append transcript to input
5. Handle errors (no mic permission)

**Files to Create:**
- `src/hooks/useVoiceInput.ts`

**Files to Modify:**
- `src/chat/ChatInput.tsx`

---

## New Features (Not Started)

### 🟢 35. Multi-Language Support (i18n)

**TODO:**
1. Install i18next
2. Create translation files (en, es, fr, etc.)
3. Wrap all UI strings in t() function
4. Add language selector to settings
5. Store preference in localStorage

---

### 🟢 36. Dark/Light Mode - Full Implementation

**Status:** Theme toggle exists, but needs complete styling

**TODO:**
1. Create light theme color palette
2. Update all components with theme-aware classes
3. Test contrast in both themes
4. Add theme preview in settings

**Files to Modify:**
- All component files
- `tailwind.config.js`
- `src/index.css`

---

### 🟢 37. Browser Extension

**TODO:**
1. Create extension manifest
2. Add YouTube integration (capture transcript)
3. Right-click context menu for packaging
4. One-click send to YT-Assist
5. Publish to Chrome Web Store

---

### 🟢 38. Mobile App (React Native)

**TODO:**
1. Set up React Native project
2. Port components to RN
3. Add native features (camera, voice)
4. Publish to App Store/Play Store

---

### 🟢 39. API Rate Limiting Dashboard

**TODO:**
```tsx
// src/components/UsageStatsDialog.tsx
<Dialog>
  <h2>API Usage</h2>

  <div className="space-y-4">
    <div>
      <h3>This Month</h3>
      <p>Tokens: {stats.tokensThisMonth.toLocaleString()}</p>
      <p>Cost: ${stats.costThisMonth.toFixed(2)}</p>
      <p>Requests: {stats.requestsThisMonth}</p>
    </div>

    <div>
      <h3>By Model</h3>
      <BarChart data={stats.byModel} />
    </div>

    <div>
      <h3>By Day</h3>
      <LineChart data={stats.byDay} />
    </div>
  </div>
</Dialog>
```

**Implementation:**
1. Track usage in backend
2. Store in database or analytics service
3. Create usage stats component
4. Add charts/graphs
5. Add export to CSV

---

### 🟢 40. Team Collaboration Features

**TODO:**
1. Multi-user accounts
2. Shared workspaces
3. Commenting on chats/outputs
4. Version control for templates
5. Activity log

---

## Infrastructure & DevOps

### 🟢 41. Automated Testing

**TODO:**
```bash
# Install testing libraries
npm install -D vitest @testing-library/react @testing-library/user-event

# Unit tests for stores
npm install -D @testing-library/react-hooks

# E2E tests
npm install -D playwright
```

**Test Coverage Goals:**
- Unit tests: 80%+
- Integration tests: Core user flows
- E2E tests: Critical paths (chat, packaging)

**Files to Create:**
- `src/**/*.test.tsx` (component tests)
- `src/stores/**/*.test.ts` (store tests)
- `tests/e2e/**/*.spec.ts` (E2E tests)

---

### 🟢 42. CI/CD Pipeline

**TODO:**
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy
```

**Implementation:**
1. Set up GitHub Actions
2. Add test job
3. Add build job
4. Add deploy job (to chosen platform)
5. Add environment secrets

---

### 🟢 43. Error Tracking (Sentry)

**TODO:**
```typescript
// Install Sentry
npm install @sentry/react

// src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Wrap app
<Sentry.ErrorBoundary fallback={ErrorFallback}>
  <App />
</Sentry.ErrorBoundary>
```

**Implementation:**
1. Create Sentry account
2. Install SDK
3. Add error boundary
4. Configure source maps upload
5. Set up alerts

---

### 🟢 44. Analytics (PostHog / Mixpanel)

**TODO:**
```typescript
// Install PostHog
npm install posthog-js

// src/utils/analytics.ts
import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: 'https://app.posthog.com',
});

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  posthog.capture(event, properties);
};

// Track events
trackEvent('chat_sent', { provider, model, messageLength });
trackEvent('packaging_generated', { outputTypes });
```

**Implementation:**
1. Choose analytics provider
2. Install SDK
3. Add tracking to key events
4. Create dashboards
5. Set up funnels

---

### 🟢 45. Database Migration (PostgreSQL)

**TODO:**
```typescript
// Install Drizzle ORM + PostgreSQL
npm install drizzle-orm postgres
npm install -D drizzle-kit

// server/db/schema.ts
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  title: text('title'),
  messages: jsonb('messages'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Implementation:**
1. Set up PostgreSQL database
2. Define schema with Drizzle ORM
3. Create migration scripts
4. Update sync endpoints to use DB
5. Migrate data from localStorage

---

## Documentation

### 🟢 46. API Documentation

**TODO:**
1. Document all API endpoints
2. Add request/response examples
3. Document authentication
4. Add rate limiting details
5. Publish to Swagger/OpenAPI

**Files to Create:**
- `docs/api/README.md`
- `docs/api/anthropic.md`
- `docs/api/openai.md`
- `openapi.yaml`

---

### 🟢 47. User Guide

**TODO:**
1. Getting started guide
2. Feature walkthroughs
3. Video tutorials
4. FAQ section
5. Troubleshooting guide

**Files to Create:**
- `docs/user-guide/getting-started.md`
- `docs/user-guide/chat.md`
- `docs/user-guide/packaging-tool.md`
- `docs/user-guide/canvas.md`

---

### 🟢 48. Contribution Guide

**TODO:**
1. Code style guide
2. Git workflow
3. PR template
4. Issue templates
5. Development setup

**Files to Create:**
- `CONTRIBUTING.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`

---

## Summary

### Reality-Based Status

- The app has broad feature coverage, but the current branch fails `npm run build`
- Automated tests are not configured, so implementation confidence depends on manual verification
- Several TODO entries were stale and are now marked as implemented or mostly implemented

### Verified Implemented (moved from “not done” to “done/mostly done”)

- #6 Mermaid support (core integration complete)
- #7 Drag-and-drop chat-to-folder (native implementation)
- #10 Stop generation (AbortController + UI)
- #11 AI suggestions panel (integrated with Canvas + API)
- #15 Welcome screen category pills
- #16 Right-aligned user bubbles
- #17 Upward-opening model picker with search
- #18 Floating input box pattern
- #19 Collapsed-sidebar icon navigation
- #20 Thin scrollbars
- #24 Keyboard shortcuts help (in Settings tab)

### Highest-Impact Remaining Work

- Build/typecheck fixes (current blocker)
- #2 Rate limiting middleware
- #3 Server-side validation and sanitization
- #4 HTTPS/security headers enforcement
- #8 Cloud sync/account system
- #9 Comparison metrics (cost/speed/latency)
- #13 Competitor URL ingestion and metadata fetch
- #23 Skip-to-content accessibility link

---

**Report Generated:** February 9, 2026
**Total Tracked Items:** 48 (re-triage in progress)
**Status:** Feature-rich, but not release-ready (build failing + security hardening pending)
