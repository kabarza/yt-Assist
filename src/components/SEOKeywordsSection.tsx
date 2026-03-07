import { useState } from 'react'
import { Copy, Check, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SEOKeywords, SearchVolume } from '../types/seo'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SEOKeywordsSectionProps {
  keywords: SEOKeywords
}

function VolumeIcon({ volume }: { volume?: SearchVolume }) {
  if (!volume) return null

  switch (volume) {
    case 'high':
      return <TrendingUp className="h-3 w-3 text-green-500" />
    case 'medium':
      return <Minus className="h-3 w-3 text-yellow-500" />
    case 'low':
      return <TrendingDown className="h-3 w-3 text-blue-500" />
  }
}

function VolumeLabel({ volume }: { volume?: SearchVolume }) {
  if (!volume) return null

  const colors = {
    high: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-blue-600 dark:text-blue-400',
  }

  return (
    <span className={cn('text-xs font-medium uppercase', colors[volume])}>
      {volume}
    </span>
  )
}

function KeywordChip({ keyword, volume, onCopy }: {
  keyword: string
  volume?: SearchVolume
  onCopy: (keyword: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyword)
      setCopied(true)
      onCopy(keyword)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Copy failed:', err)
      toast.error('Failed to copy keyword')
    }
  }

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent transition-colors border border-border">
      <VolumeIcon volume={volume} />
      <span className="text-sm text-foreground flex-1">{keyword}</span>
      <VolumeLabel volume={volume} />
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        aria-label={`Copy ${keyword}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

export default function SEOKeywordsSection({ keywords }: SEOKeywordsSectionProps) {
  const handleCopy = (keyword: string) => {
    toast.success(`Copied "${keyword}"`)
  }

  const copyAllKeywords = async () => {
    const allKeywords = [
      ...keywords.primary.map(k => k.keyword),
      ...keywords.secondary.map(k => k.keyword),
      ...keywords.longTail.map(k => k.keyword),
    ].join(', ')

    try {
      await navigator.clipboard.writeText(allKeywords)
      toast.success('All keywords copied to clipboard')
    } catch (err) {
      console.error('Copy failed:', err)
      toast.error('Failed to copy keywords')
    }
  }

  const hasKeywords = keywords.primary.length > 0 || keywords.secondary.length > 0 || keywords.longTail.length > 0

  if (!hasKeywords) {
    return (
      <div className="p-4 bg-card border border-border rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          No keywords generated yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">SEO Keywords</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={copyAllKeywords}
          className="gap-2"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy All
        </Button>
      </div>

      {/* Primary Keywords */}
      {keywords.primary.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              Primary
            </Badge>
            <span className="text-xs text-muted-foreground">
              Main topics that represent your content
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {keywords.primary.map((kw, idx) => (
              <KeywordChip
                key={idx}
                keyword={kw.keyword}
                volume={kw.volume}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}

      {/* Secondary Keywords */}
      {keywords.secondary.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Secondary
            </Badge>
            <span className="text-xs text-muted-foreground">
              Supporting topics and related concepts
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {keywords.secondary.map((kw, idx) => (
              <KeywordChip
                key={idx}
                keyword={kw.keyword}
                volume={kw.volume}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}

      {/* Long-tail Keywords */}
      {keywords.longTail.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Long-tail
            </Badge>
            <span className="text-xs text-muted-foreground">
              Specific search phrases (lower competition)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {keywords.longTail.map((kw, idx) => (
              <KeywordChip
                key={idx}
                keyword={kw.keyword}
                volume={kw.volume}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-xs">
        <span className="text-muted-foreground font-medium">Search Volume:</span>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-foreground">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Minus className="h-3 w-3 text-yellow-500" />
          <span className="text-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3 text-blue-500" />
          <span className="text-foreground">Low</span>
        </div>
      </div>
    </div>
  )
}
