# Canvas Lab — Foundational UX & Functionality Rebuild Plan

**Date:** March 18, 2026  
**Status:** Proposed replacement plan (post-current iteration rollback)

---

## 1) Why This Rebuild Is Needed

The current Canvas Lab implementation works for specific YouTube packaging flows, but the interaction model is still "feature-first" rather than "foundation-first." We need to rebuild around a universal model:

- A node is a **prompt program**.
- Inputs are typed fields.
- Outputs are typed response contracts.
- UI controls map cleanly to prompt-generation and response-capture behavior.

This creates a reusable foundation for Transcript Source, future content nodes, and custom pipelines.

---

## 2) Research Snapshot (What We Should Build On)

### A. Reliable structured response capture

1. **OpenAI Structured Outputs** support schema-constrained responses and are recommended over plain JSON mode when possible.  
   Source: https://developers.openai.com/api/docs/guides/structured-outputs

2. **Anthropic OpenAI-compat mode** has a key caveat: strict function-calling schema guarantees are not enforced there. Use Anthropic native structured mechanisms when schema adherence matters.  
   Source: https://platform.claude.com/docs/en/api/openai-sdk

3. **Gemini structured output** supports JSON responses with explicit schema config (`responseMimeType` + `responseJsonSchema` / `response_json_schema`).  
   Source: https://ai.google.dev/gemini-api/docs/structured-output

**Conclusion:** move Canvas Lab to a **schema-first output contract** with provider-specific adapters and strict validation.

### B. Canvas interaction patterns

4. React Flow supports native right-click hooks such as `onNodeContextMenu` to implement node/pane context menus cleanly.  
   Source: https://reactflow.dev/examples/interaction/context-menu

5. For three-dot menu accessibility, implement Menu Button semantics and keyboard interaction patterns (Enter/Space to open, arrow support).  
   Source: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

---

## 3) Current-State Observations from Codebase

- Transcript Source mixes durable concepts (typed inputs, optional guidance) with packaging-specific UX in one surface.
- Output handling already has promising primitives (`PromptBuilderOutputDefinition`, `presentation`, `requestedCount`, `enabled`) but not yet generalized end-to-end.
- Node header controls are currently always-visible and crowded (status, delete, debug, stage).
- Refinement controls are positioned before/around content in ways that do not match user intent hierarchy.
- Scroll behavior capture exists (`onWheelCapture`) but still has usability gaps in nested content situations.

---

## 4) Product Direction: New Core Model

## 4.1 Node Architecture (unified)

Every generation node will be represented as:

```ts
PromptProgramNode {
  id
  label
  inputSchema: InputField[]
  outputSchema: OutputField[]
  promptTemplate: TemplateBlock[]
  responseContract: JsonSchema
  viewConfig: NodeViewConfig
}
```

### InputField types (v1)

- `long_text` (e.g., transcript)
- `short_text` (e.g., counts, word limits)
- `number`
- `boolean` (e.g., "prefer transcript timestamps")

Field attributes:

- `required: boolean`
- `defaultValue`
- `section: core | optional`
- `visible: always | collapsible`
- `promptLabel`, `description`, `injectionRule`

### OutputField types (v1)

- `text_item_list` (rows)
- `combined_block`
- `table`
- `code_block`

Output attributes:

- `enabled`
- `label`
- `description/promptHint`
- `count`
- `grouping: combined | separate`
- `captureKey` (stable key for parser)

---

## 5) Transcript Source Rebuild (as the first template)

Transcript Source becomes a **template instance** of PromptProgramNode:

### Core inputs (always visible)

1. Transcript (`long_text`, required)
2. Import Packaging action (action control, not a field)

### Optional inputs (collapsible)

- Must include (`short_text`)
- Nice to include (`short_text`)
- Words to avoid (`short_text`)
- Additional context (`long_text`)
- Prefer transcript timestamps (`boolean`, default true)
- Include specific name (`boolean`) + Name value (`short_text`, conditional)

### Output settings (separate collapsible section)

- User can add/edit/remove outputs
- Per output: enable/disable, label, description, count, format type, grouping mode
- Ordering controls to define final prompt order

This keeps transcript source behavior but makes it reusable for non-packaging use cases.

---

## 6) Response Contract Strategy (Reliability First)

## 6.1 Contract layer

Introduce a canonical `OutputContract` builder:

- Builds JSON Schema from configured output fields
- Keeps stable `captureKey`s
- Generates parser + validator

## 6.2 Provider adapters

- OpenAI: structured output mode with strict schema
- Gemini: `application/json` + schema config
- Anthropic: native structured outputs path (avoid relying on OpenAI compatibility strictness)

## 6.3 Fallback rules

If provider cannot guarantee strict schema in a path:

1. Attempt strict-native route first
2. Validate response against contract
3. If invalid, run single repair pass with explicit validator errors
4. Mark run as `partial`/`warning` if repair fails

---

## 7) Node UX Redesign Plan

## 7.1 Header actions

- Replace always-visible delete with **three-dot overflow menu**.
- Menu options (v1): Rename, Duplicate, Disconnect links, Delete.
- Keep destructive actions behind one click + confirm.

## 7.2 Status badge placement

- Move status chip outside node border (top-left offset).
- Node title area becomes clean and unblocked.

## 7.3 Content vs controls hierarchy

For generation nodes:

- **Top:** AI response content (primary real estate)
- **Bottom panel:** refinement controls (`input`, `Refine`, `5 more`, `10 more`) grouped together

This aligns interaction order with user intent.

## 7.4 Scroll behavior

- Node-level scroll must take precedence while hovered.
- Canvas pan/zoom should not hijack vertical scroll when node content can scroll.
- Preserve trackpad gestures for canvas only when node viewport is at scroll limit or gesture is horizontal/pinch.

## 7.5 Hover actions & icon clarity

- Keep copy / accept / pin controls hidden until hover (or focus-visible).
- Add tooltips for all icons.
- Clarify semantics:
  - **Check** = Accept item for downstream use.
  - **Pin** = Keep highlighted/favored item across refinements.

## 7.6 Right-click interactions

- Add pane context menu: Add Node, Paste Node, Auto-layout (future).
- Add node context menu: Run, Duplicate, Disconnect, Delete, Open Debug.

---

## 8) Reusability & Templates

Add reusable node/template operations:

- Save node as template
- Duplicate node
- Copy/paste node config between workspaces
- Preset library (starting with Transcript Source + Packaging)

Longer-term: template versioning and migration handlers.

---

## 9) Implementation Phases

## Phase 0 — Alignment & rollback boundary (1–2 days)

- Freeze current UX deltas causing friction.
- Confirm non-negotiables and success criteria.
- Define migration constraints for existing workspace data.

## Phase 1 — Data model foundation (2–4 days)

- Add generic input/output field models.
- Add output contract builder + schema validation module.
- Add migration from legacy transcript/prompt configs.

## Phase 2 — Transcript Source template refactor (3–5 days)

- Rebuild Transcript Source on generic model.
- Keep import packaging integration intact.
- Split Optional Input and Output Settings panels.

## Phase 3 — Node shell UX pass (3–4 days)

- Header overflow menu
- External status chip
- Response-first body layout
- Bottom refinement control rail
- Hover-only action icons + tooltips

## Phase 4 — Context menus & interaction polish (2–3 days)

- Right-click pane/node menus
- Scroll conflict fixes and edge handling
- Keyboard and accessibility pass for menu interactions

## Phase 5 — Template persistence & reuse (2–4 days)

- Save/load templates
- Copy/paste node config
- Preset management surface

## Phase 6 — QA + instrumentation (2–3 days)

- Contract validation telemetry
- Node interaction metrics (misclicks, failed parse rate, repair rate)
- UX acceptance checklist

---

## 10) Acceptance Criteria

1. Transcript Source can be fully represented by generic typed inputs + outputs.
2. Users can add/edit/reorder output definitions without code changes.
3. >=95% of model responses validate against generated schema on first pass in supported strict modes.
4. Node content scroll works reliably on trackpad hover without unintended canvas movement.
5. Header actions are discoverable but visually quiet (overflow menu).
6. Response content is visibly primary; refinement controls are grouped at bottom.

---

## 11) Risks & Mitigations

- **Risk:** Provider inconsistency in schema adherence.  
  **Mitigation:** per-provider adapter + validator + repair pass.

- **Risk:** Migration breaks old workspaces.  
  **Mitigation:** explicit migration layer and fallback defaults.

- **Risk:** UX scope creep during rebuild.  
  **Mitigation:** phase gates with acceptance criteria before new additions.

---

## 12) Immediate Next Actions (This Week)

1. Approve this foundational direction.
2. Create technical design doc for `InputField`, `OutputField`, `OutputContract` types.
3. Build a single vertical slice: Transcript Source (new model) -> one generated output.
4. Validate strict schema flow on OpenAI + Gemini + Anthropic-native route.
5. Schedule UX review on new node shell before scaling to all node kinds.

