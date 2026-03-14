# Nano Banana Pro Integration Brief

## What "Nano Banana Pro" is

For implementation purposes, the requested models map to:

- Nano Banana 2: `gemini-3.1-flash-image-preview`
- Nano Banana Pro: `gemini-3-pro-image-preview`

Official docs:

- https://ai.google.dev/gemini-api/docs/image-generation
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/libraries

## What it can do for this app

The simple first version you described is supported:

- Accept a text prompt.
- Accept one or more reference images.
- Use prompt + images together to generate a new image.
- Return generated images that users can view, browse, and download.
- Support "generate 1" or "generate several" in the UI.
- Support both prompt-only generation and prompt-plus-image generation.

These models are designed for:

- text-to-image generation
- image editing / transformation
- combining multiple reference images
- conversational follow-up edits if we want that later

The official image generation guide explicitly describes using text and images together, maintaining consistency across edits, and using up to 14 reference images. The current official Nano Banana page also distinguishes Nano Banana 2, Nano Banana Pro, and the older Nano Banana model.

## Best integration approach for this repo

Do not force this through the existing OpenAI chat route.

Use a dedicated Gemini image route on the server and a dedicated `Image Gen` tool in the existing YT Assist left navigation.

Why:

- The current server only proxies chat-style OpenAI and Anthropic requests.
- The current chat flow is optimized for streamed text deltas, not image-generation jobs.
- The current message model can display images, but it does not yet provide a gallery-style output workflow.
- A dedicated tool will keep the first version simple and avoid bending chat UX into something it is not.

## Recommended V1 scope

Build a new `Image Gen` tool with this flow:

1. User enters a prompt.
2. User attaches one or more reference images.
3. User chooses model: Nano Banana 2 or Nano Banana Pro.
4. User chooses generation mode:
   - text-to-image
   - text-and-image-to-image
5. User chooses output count: `1`, `2`, or `4`.
6. User sets standard options such as aspect ratio and resolution.
7. User clicks `Generate`.
8. App shows loading state and returns a result gallery.
9. User can:
   - open images larger
   - move through results
   - download each image
   - review recent generations from a list
   - regenerate with the same inputs

Keep V1 options intentionally small:

- prompt
- reference images
- model selection between the two requested Gemini image models
- generation mode
- output count
- aspect ratio
- resolution

Do not add:

- style presets
- edit history
- asset library
- job queueing
- sharing
- prompt templates
- background processing

## Backend design

Add a new server route:

- `POST /api/images/gemini`

Request shape:

```json
{
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "Create a cinematic thumbnail-style image...",
  "referenceImages": [
    {
      "dataUrl": "data:image/png;base64,...",
      "mimeType": "image/png"
    }
  ],
  "count": 1,
  "aspectRatio": "16:9",
  "imageSize": "1K"
}
```

Response shape:

```json
{
  "images": [
    {
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,..."
    }
  ],
  "text": "Optional model text response"
}
```

Implementation notes:

- Use the Gemini API directly from the Hono server.
- Prefer plain `fetch` first; this avoids adding a dependency if we do not need one.
- Read API key from `GEMINI_API_KEY`, with optional browser override later if needed.
- Send `responseModalities` including `TEXT` and `IMAGE`.
- Send prompt text plus each reference image as content parts.
- Parse returned inline image data into browser-safe `data:` URLs.

## Important product decision: multiple outputs

The simplest and safest V1 is:

- if `count === 1`, make one request
- if `count > 1`, make repeated requests server-side and return the collected images

Reason:

- The official docs clearly show how to generate images, but do not present a simple first-class "`n` images" control for this model in the same way some image APIs do.
- Repeated calls give us predictable UI and let us preserve a stable contract on our side.
- We can later optimize concurrency or batching if the API surface becomes clearer or more capable.

This means "generate 4" is a small orchestration layer in our server, not a model-level feature we should assume exists.

## Frontend design

Add a new tool and route:

- `Image Gen` tool in the sidebar
- route at `/images`

Suggested UI sections:

- top bar: title + generate button
- left panel:
  - model selection
  - mode toggle
  - prompt textarea
  - reference image uploader
  - output count selector
  - aspect ratio and resolution selectors
- right panel:
  - result gallery grid
  - lightbox / preview dialog
  - download action per image
  - recent generations list

V1 state shape:

```ts
interface GeneratedImage {
  id: string
  dataUrl: string
  mimeType: string
  createdAt: number
}

interface ImageGenerationJob {
  prompt: string
  count: number
  references: Array<{
    id: string
    dataUrl: string
    mimeType: string
  }>
  results: GeneratedImage[]
}
```

## Why this fits the current codebase

The repo already has useful primitives:

- local image upload handling in `src/chat/ChatInput.tsx`
- local persistence patterns in Zustand stores
- download patterns using `Blob` and `URL.createObjectURL`
- server routing via Hono

Gaps we would need to add:

- Gemini API key storage or env support
- Gemini image route
- image-generation client utility
- dedicated gallery UI
- optional local persistence for generated images

## Suggested file additions

Server:

- `server/routes/geminiImages.ts`
- register route in `server/index.ts`

Client:

- `src/tools/images/ImageGenerationTool.tsx`
- `src/stores/imageGenerationStore.ts`
- `src/utils/imageApiClient.ts`

Existing files to touch:

- `src/App.tsx`
- `src/Router.tsx`
- `src/components/Sidebar.tsx`
- `src/components/SettingsDialog.tsx`
- `src/stores/settingsStore.ts`

## Settings recommendation

For V1, keep auth simple:

- support `GEMINI_API_KEY` on the server
- optionally add a local browser-stored Gemini key later, matching current OpenAI / Anthropic behavior

If we want the quickest path, server env only is enough for a first internal build.

## Risks and constraints

- Cost: the pricing page treats image generation in model-specific units rather than plain text token pricing.
- Rate limits: Gemini model limits are tier-dependent and must be checked against the account we will use.
- Latency: multi-image output implemented as repeated calls will be slower than a hypothetical native multi-image endpoint.
- Storage: base64 image results can grow local state quickly if we persist too much history.
- UX: chat is not the right place for a browse/download-first image workflow.

## Recommendation

Build this as a dedicated V1 image tool, not as an extension of chat.

That gives us:

- a simple user flow
- cleaner output browsing
- easier download behavior
- less risk in the existing chat feature
- room to add harnesses later without reworking the core UX

## Practical next step

If we move from research to implementation, the smallest useful slice is:

1. add `POST /api/images/gemini`
2. add a minimal `/images` tool
3. support prompt + reference images + count selector
4. render returned images in a simple grid with download buttons

That would be enough to validate the full end-to-end product shape before building advanced controls.
