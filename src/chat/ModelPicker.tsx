import { useState } from 'react'
import { Search, Filter, ChevronDown, Check, Server } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Provider } from '../types/chat'
import { MODELS } from '../types/chat'
import { getEndpointDisplayName, hasCustomEndpoint } from '../utils/apiClient'

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
          className="inline-flex h-10 min-w-0 max-w-[11rem] items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground transition-[color,box-shadow,border-color] hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          aria-label={`Model: ${activeModel.name}. Click to change.`}
        >
          {hasCustomEndpoint(provider) && (
            <Server
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label={getEndpointDisplayName(provider)}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-left font-semibold">
            {activeModel.name}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
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
        className="w-[360px] rounded-2xl border border-border/70 bg-popover p-0 shadow-xl"
      >
        {/* Search row */}
        <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-3">
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
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {filteredGroups.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No models match your search.
            </p>
          )}

          {filteredGroups.map((group, gi) => (
            <div key={group.provider}>
              {/* Section label */}
              <div className={cn('px-2.5 py-2', gi > 0 && 'mt-1 border-t border-border/70 pt-3')}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                      'mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100',
                      'hover:bg-accent/70',
                      isActive && 'bg-accent text-accent-foreground'
                    )}
                    aria-label={`${m.name} — ${MODEL_DESCRIPTIONS[m.id] ?? ''}${isActive ? ', currently selected' : ''}`}
                  >
                    {/* Text block */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('truncate text-sm font-medium', isActive ? 'text-accent-foreground' : 'text-foreground')}>
                        {m.name}
                      </p>
                      <p className={cn('truncate text-xs', isActive ? 'text-accent-foreground/80' : 'text-muted-foreground')}>
                        {MODEL_DESCRIPTIONS[m.id] ?? ''}
                      </p>
                    </div>

                    {/* Active checkmark */}
                    {isActive && (
                      <Check className="h-4 w-4 shrink-0 text-accent-foreground" />
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
