import { useState } from 'react'
import { Search, Filter, ChevronDown, Check } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Provider } from '../types/chat'
import { MODELS } from '../types/chat'

// ---------------------------------------------------------------------------
// Static description map — enriches each model with a one-line synopsis.
// ---------------------------------------------------------------------------
const MODEL_DESCRIPTIONS: Record<string, string> = {
  'gpt-5.2':                'Latest flagship, highest capability',
  'gpt-5.2-pro':            'Extended reasoning and analysis',
  'gpt-5.1':                'Balanced performance and speed',
  'gpt-5.1-mini':           'Fast and efficient',
  'gpt-4.1':                'Reliable general purpose',
  'gpt-4.1-mini':           'Lightweight and quick',
  'gpt-4.1-nano':           'Fastest response times',
  'o4-mini':                'Reasoning specialist, compact',
  'o3':                     'Deep reasoning and analysis',
  'o3-mini':                'Reasoning, optimized for speed',
  'o1':                     'Advanced reasoning',
  'o1-mini':                'Reasoning, lightweight',
  'gpt-4o':                 'Multimodal flagship',
  'gpt-4o-mini':            'Multimodal, efficient',
  'claude-sonnet-4-20250514':    'Anthropic\'s latest flagship',
  'claude-3-5-sonnet-20241022':  'Balanced capability',
  'claude-3-5-haiku-20241022':   'Fast and lightweight',
}

// ---------------------------------------------------------------------------
// Derive a short parenthetical badge from the model id.
// Examples: "gpt-5.2" → "GPT-5.2", "claude-sonnet-4-20250514" → "Sonnet 4"
// ---------------------------------------------------------------------------
function shortBadge(provider: Provider, modelId: string): string {
  if (provider === 'anthropic') {
    // Strip the date suffix and "claude-" prefix, capitalise first segment.
    // claude-sonnet-4-20250514  →  Sonnet 4
    // claude-3-5-sonnet-20241022 → 3.5 Sonnet
    const match = modelId.match(/^claude-(.+)-\d{8}$/)
    if (match) {
      const core = match[1] // e.g. "sonnet-4" or "3-5-sonnet"
      // Split on hyphens, re-join with dots for version numbers and spaces otherwise.
      const parts = core.split('-')
      // Rebuild: numeric parts joined by dots, text parts capitalised.
      const rebuilt: string[] = []
      let i = 0
      while (i < parts.length) {
        if (/^\d+$/.test(parts[i])) {
          // Collect consecutive numeric segments as a dotted version.
          let version = parts[i]
          while (i + 1 < parts.length && /^\d+$/.test(parts[i + 1])) {
            i++
            version += '.' + parts[i]
          }
          rebuilt.push(version)
        } else {
          rebuilt.push(parts[i].charAt(0).toUpperCase() + parts[i].slice(1))
        }
        i++
      }
      return rebuilt.join(' ')
    }
    return modelId
  }
  // OpenAI: just return the id uppercased for display.
  return modelId.toUpperCase()
}

// ---------------------------------------------------------------------------
// Provider display labels (used for the grouped section headers).
// ---------------------------------------------------------------------------
const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

// ---------------------------------------------------------------------------
// Ordered list of providers in the dropdown.  Current provider comes first
// so it always appears at the top.
// ---------------------------------------------------------------------------
function orderedProviders(current: Provider): Provider[] {
  const all: Provider[] = ['openai', 'anthropic']
  return [current, ...all.filter((p) => p !== current)]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ModelPickerProps {
  provider: Provider
  model: string
  onProviderChange: (provider: Provider) => void
  onModelChange: (model: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ModelPicker({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Resolve the display name for the currently active model.
  const activeModel =
    MODELS[provider].find((m) => m.id === model) ??
    MODELS[provider][0]

  // ---------------------------------------------------------------------------
  // Filtered + grouped model list.  The query matches against both the model
  // name and its description (case-insensitive).
  // ---------------------------------------------------------------------------
  const normalised = query.toLowerCase()

  const filteredGroups = orderedProviders(provider)
    .map((p) => {
      const models = MODELS[p].filter((m) => {
        if (!normalised) return true
        const desc = (MODEL_DESCRIPTIONS[m.id] ?? '').toLowerCase()
        return m.name.toLowerCase().includes(normalised) || desc.includes(normalised)
      })
      return { provider: p, models } as const
    })
    .filter((g) => g.models.length > 0)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleSelect = (p: Provider, id: string) => {
    if (p !== provider) onProviderChange(p)
    onModelChange(id)
    setOpen(false)
    setQuery('')
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* ── Trigger ────────────────────────────────────────────────────── */}
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-foreground/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          aria-label={`Model: ${activeModel.name}. Click to change.`}
        >
          <span className="font-semibold">{activeModel.name}</span>
          <span className="text-muted-foreground text-xs font-normal">
            ({shortBadge(provider, activeModel.id)})
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>

      {/* ── Popover panel ──────────────────────────────────────────────── */}
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[320px] p-0 border border-border rounded-lg bg-popover shadow-lg"
      >
        {/* Search row */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-0"
            autoFocus
            aria-label="Search models"
          />
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-40" />
        </div>

        {/* Scrollable model list */}
        <div className="max-h-[340px] overflow-y-auto py-1.5">
          {filteredGroups.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-4">
              No models match your search.
            </p>
          )}

          {filteredGroups.map((group, gi) => (
            <div key={group.provider}>
              {/* Section label */}
              <div className={cn('px-3 py-1.5', gi > 0 && 'mt-1 border-t border-border')}>
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {PROVIDER_LABELS[group.provider]}
                </span>
              </div>

              {/* Model rows */}
              {group.models.map((m) => {
                const isActive = m.id === model && group.provider === provider
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(group.provider, m.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors duration-100',
                      'hover:bg-muted/60',
                      isActive && 'bg-muted/40'
                    )}
                    aria-label={`${m.name} — ${MODEL_DESCRIPTIONS[m.id] ?? ''}${isActive ? ', currently selected' : ''}`}
                  >
                    {/* Text block */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isActive ? 'text-foreground' : 'text-foreground/90')}>
                        {m.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {MODEL_DESCRIPTIONS[m.id] ?? ''}
                      </p>
                    </div>

                    {/* Active checkmark */}
                    {isActive && (
                      <Check className="h-4 w-4 text-foreground shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
