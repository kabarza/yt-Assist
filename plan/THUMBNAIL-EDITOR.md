# Thumbnail Editor Plan

## Goal

Build a lightweight thumbnail editor for repeatable YouTube packaging work:

- fixed thumbnail-first workflow, not a general design canvas
- easy text and image placement
- reusable brand styles (colors, fonts, themes)
- fast keyboard-driven transforms
- AI edits on selected layers
- PNG/JPEG export

This should feel closer to "thumbnail studio" than "mini Figma".

## Recommendation

Use a fixed artboard editor with size presets, not an infinite Figma-style canvas.

Default board:

- YouTube Thumbnail: 1280x720

Optional presets:

- 1920x1080
- 1024x1024
- 1080x1350

Keep the document model artboard-first:

- one board per thumbnail
- explicit layers
- one selected layer at a time
- export from the board, not from the viewport

## Why This Direction

### 1. Your core job is always a final image

You are not designing full multi-frame documents. You are assembling one thumbnail with:

- a background
- one or more cutout images
- short text
- brand styling
- fast variations

That means the editor should optimize for shipping one image, not for exploring an infinite canvas.

### 2. Figma-like freedom adds complexity you do not need

Infinite canvas behavior creates extra work:

- camera/viewport management
- zoom and panning edge cases
- frame nesting
- multi-page mental overhead
- more complex selection behavior

This is useful for design tools. It is not the shortest path for thumbnail creation.

### 3. The current Compose Stage already points in the right direction

The existing compose UI is already fixed to `1280x720` and uses text/image layers:

- [ComposeStage.tsx](/Users/kabarza/Dev/work/yt-assist/src/tools/canvas-lab/ComposeStage.tsx)

That is directionally correct for the product. The limitation is the implementation detail, not the product model.

### 4. The current DOM + `html2canvas` approach will hit limits

The current prototype is good for proving the workflow, but it will get brittle once you add:

- transform handles
- precise resize behavior
- layer snapping
- keyboard tools
- crop/outpaint regions
- richer export quality rules
- future masks

## Editor Engine Recommendation

Use `react-konva` for the actual thumbnail stage.

Do not use `tldraw` as the main thumbnail editor.

Do not keep scaling the current DOM-based compose board as the long-term editor.

## Why `react-konva`

It matches the feature shape well:

- fixed stage size
- explicit layers
- draggable objects
- transform handles
- controlled render order
- image export from the stage

It also fits React state management cleanly, which matches the current app.

## Why not `tldraw` for this feature

`tldraw` is strong for whiteboards, diagrams, and bounded canvases, and it can be heavily customized. But for this feature it is still the wrong center of gravity:

- its default model is still canvas-document oriented
- it brings a lot of editor behavior you would spend time hiding or reshaping
- text/image thumbnail composition needs tighter layer and export control than "drawing app" control

It is useful elsewhere in the app, but I would not make it the core thumbnail engine.

## Why not keep the DOM board

The current board is fine as a prototype, but long-term it will be harder to make robust than a canvas-stage model.

Main reasons:

- transform math gets messy
- export quality depends on DOM capture
- layer interactions become ad hoc
- text measurement and snapping are harder to keep predictable

## Product Shape

Create a new tool, separate from Canvas Lab:

- `Thumbnail Studio`

Canvas Lab should stay the experimental workflow graph.

Thumbnail Studio should be the direct production surface.

Connection between them:

- Canvas Lab can send accepted assets or copy into Thumbnail Studio
- Thumbnail Studio can import reusable assets from the image library

## V1 UX

### Layout

- left panel: assets, brand presets, quick actions
- center: fixed artboard
- right panel: layers and inspector
- bottom or floating strip: AI edit results when a layer edit finishes

### Core tools

- `V`: select/move
- `K`: scale/transform
- `T`: add text
- `Backspace`: delete layer
- `Cmd/Ctrl + D`: duplicate
- `[` and `]`: send layer backward/forward
- `Shift`: constrain proportions or movement

### Core layer types

- background layer
- image layer
- text layer

### Text controls

- IBM Plex as default family
- saved text styles
- color presets
- stroke/shadow presets
- alignment
- max-width box resizing

### Layer controls

- reorder
- lock
- hide
- duplicate
- delete
- rename

### Export

- PNG
- JPEG

## Brand System

Add a persistent thumbnail style system:

- brand colors
- theme presets
- font families
- saved text styles
- saved layout presets

Suggested model:

- `BrandKit`
- `TextStylePreset`
- `ThemePreset`

This lets you create reusable presets like:

- "Bold reaction"
- "Dark drama"
- "Clean authority"

## AI Editing Plan

### V1 principle

AI edits should happen at the selected-layer level, not at the whole-document level by default.

### Layer edit flow

1. User selects a layer.
2. User clicks a quick action or writes a custom prompt.
3. App sends the selected layer image plus prompt to the image API.
4. API returns `1`, `2`, or `4` candidate results.
5. UI opens an inline result picker.
6. User picks one result to replace the original layer.

### Quick actions

- Remove background
- Clean cutout
- Add dramatic rim light
- Change expression slightly
- Make more realistic
- Make more cinematic
- Extend left
- Extend right
- Extend upward
- Extend downward

Prompt templates should be stored in config, not hardcoded in components.

Example:

- `remove_background`: "Keep the subject. Remove the background cleanly and preserve the original subject details."

## Important AI Product Constraint

If "remove background" means true transparent alpha output, do not assume the current Gemini image flow will be reliable enough for that.

Current app reality:

- the image generation tool already uses Gemini image generation and edit-style prompting with reference images
- [imageApiClient.ts](/Users/kabarza/Dev/work/yt-assist/src/utils/imageApiClient.ts)
- [geminiImages.ts](/Users/kabarza/Dev/work/yt-assist/server/routes/geminiImages.ts)

Recommended product stance:

- V1: treat "remove background" as a best-effort AI edit preset using the same Gemini pipeline
- V2: add a dedicated transparent cutout path if you need dependable alpha output

Reason:

- Gemini's docs clearly support image editing from image + prompt
- I did not find equivalent official transparency controls there
- OpenAI's image docs do document transparent background output and image edit/mask support

So if transparent PNG cutouts become a hard requirement, that is likely a separate path.

## Outpaint / Expand Plan

Do not make frame expansion a freeform camera action.

Instead:

1. User changes board size or expands one edge.
2. The editor marks the new empty region.
3. User chooses `Extend left/right/up/down` or writes a custom prompt.
4. App sends:
   - source layer or flattened context image
   - new target dimensions
   - expansion direction
   - prompt
5. Returned image replaces the target layer or background layer.

Recommendation for V1:

- support outpainting only on the background layer

Recommendation for later:

- support outpainting on any image layer with region-aware masks

## Technical Architecture

### New state domain

Create a dedicated store instead of overloading Canvas Lab state:

- `thumbnailEditorStore.ts`

Suggested document model:

- `ThumbnailDocument`
- `ThumbnailBoard`
- `ThumbnailLayer`
- `ThumbnailImageLayer`
- `ThumbnailTextLayer`
- `ThumbnailBrandKit`
- `ThumbnailAiJob`

### Rendering

Use `react-konva` stage primitives:

- `Stage`
- `Layer`
- `Image`
- `Text`
- `Transformer`

### Persistence

Persist thumbnail documents locally first, same pattern as current tool stores:

- IndexedDB for assets and documents
- Zustand for active session state

### Asset reuse

Reuse existing asset storage where it makes sense:

- reusable library images
- generated images
- imported files

But keep thumbnail document state separate from Canvas Lab workspace state.

### API

Add a dedicated thumbnail edit endpoint instead of reusing node execution routes:

- `POST /api/thumbnail/edit`

Request shape:

- selected asset image
- optional context image
- prompt
- count
- mode (`replace`, `outpaint`, `background_remove`)
- target size
- expansion direction if applicable

Response shape:

- candidate images
- warnings

This should still call the same underlying image provider in V1.

## Implementation Phases

### Phase 1

Ship a production editor without AI complexity:

- fixed board presets
- image layer add/remove
- text layer add/remove
- move/resize/select
- layers panel
- brand presets
- PNG/JPEG export

### Phase 2

Add AI layer replacement:

- select image layer
- quick action prompts
- custom prompt
- 1/2/4 candidate picker
- replace layer result

### Phase 3

Add background-only outpainting:

- expand board edges
- prompt-assisted fill
- compare and accept result

### Phase 4

Add advanced editing:

- transparent cutout path
- mask-aware edits
- crop controls
- alignment guides and snapping
- multi-select
- text templates

## Suggested Repo Placement

- UI: `src/tools/thumbnail-studio/`
- Store: `src/stores/thumbnailEditorStore.ts`
- Types: `src/types/thumbnailEditor.ts`
- Persistence: `src/utils/thumbnailEditorPersistence.ts`
- API route: `server/routes/thumbnailEdit.ts`

## Open Questions

- Should a thumbnail document support multiple saved versions, or should each version be a new document?
- Do you want only one board per document, or multiple board tabs for A/B variants?
- Is true transparent cutout required in V1, or only "good enough" visual background removal?
- Should text editing happen inline on the board, or in the inspector only for V1?

## Final Call

Build this as a fixed thumbnail artboard editor with presets.

Use `react-konva` for the stage.

Keep Canvas Lab separate.

Use the current Gemini image pipeline for V1 layer edits, but treat transparent background removal as a likely V2 specialized path unless you are okay with best-effort results.

## Sources

- tldraw camera constraints: https://tldraw.dev/sdk-features/camera
- tldraw custom UI example: https://tldraw.dev/examples/custom-ui
- Konva React docs: https://konvajs.org/docs/react/
- Konva Transformer docs: https://konvajs.org/docs/react/Transformer.html
- Konva export docs: https://konvajs.org/docs/react/Canvas_Export.html
- Gemini image generation and editing docs: https://ai.google.dev/gemini-api/docs/image-generation
- OpenAI image generation and edit docs: https://platform.openai.com/docs/guides/images/image-generation
