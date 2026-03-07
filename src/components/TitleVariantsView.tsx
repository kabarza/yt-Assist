import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, Check, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TitleVariant {
  title: string
  angle: 'curiosity' | 'benefit' | 'urgency' | 'question' | 'direct'
  thumbnailText?: string
}

interface TitleVariantsViewProps {
  variants: TitleVariant[]
  isGenerating: boolean
  onSelectVariant?: (title: string) => void
  onClose?: () => void
}

const angleLabels = {
  curiosity: 'Curiosity-Driven',
  benefit: 'Benefit-Focused',
  urgency: 'Urgency/FOMO',
  question: 'Question-Based',
  direct: 'Direct/Straightforward',
}

const angleColors = {
  curiosity: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  benefit: 'bg-green-500/10 text-green-500 border-green-500/20',
  urgency: 'bg-red-500/10 text-red-500 border-red-500/20',
  question: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  direct: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

function VariantCard({
  variant,
  onCopy,
  onSelect,
}: {
  variant: TitleVariant
  onCopy: () => void
  onSelect?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(variant.title)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy()
  }

  return (
    <Card className="p-4 bg-card border-border hover:border-accent transition-colors">
      {/* Angle badge */}
      <div className="mb-3">
        <span
          className={cn(
            'inline-block px-2 py-1 rounded text-xs font-medium border',
            angleColors[variant.angle]
          )}
        >
          {angleLabels[variant.angle]}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-3 leading-tight">
        {variant.title}
      </h3>

      {/* Thumbnail text suggestion */}
      {variant.thumbnailText && (
        <div className="mb-3 p-2 bg-muted/50 rounded border border-border">
          <p className="text-xs text-muted-foreground mb-1">Thumbnail Text:</p>
          <p className="text-sm text-foreground font-medium">{variant.thumbnailText}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-3 gap-1.5"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {onSelect && (
          <Button
            variant="default"
            size="sm"
            onClick={onSelect}
            className="h-8 px-3 gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Use This
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function TitleVariantsView({
  variants,
  isGenerating,
  onSelectVariant,
  onClose,
}: TitleVariantsViewProps) {
  const handleCopy = () => {
    // Optional: toast notification handled by parent
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Title Variants</h2>
            <p className="text-xs text-muted-foreground">
              {isGenerating
                ? 'Generating alternative titles...'
                : `${variants.length} variants with different angles`}
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Loading state */}
      {isGenerating && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4 bg-card border-border animate-pulse">
              <div className="h-6 bg-muted rounded mb-3 w-24" />
              <div className="h-12 bg-muted rounded mb-3" />
              <div className="h-8 bg-muted rounded" />
            </Card>
          ))}
        </div>
      )}

      {/* Variants grid */}
      {!isGenerating && variants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {variants.map((variant, index) => (
            <VariantCard
              key={index}
              variant={variant}
              onCopy={handleCopy}
              onSelect={onSelectVariant ? () => onSelectVariant(variant.title) : undefined}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && variants.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No variants generated yet</p>
        </Card>
      )}

      {/* Info */}
      {!isGenerating && variants.length > 0 && (
        <div className="p-3 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Tip:</span> Each variant uses a different psychological
            angle to attract viewers. Test these with your audience to see which performs best.
          </p>
        </div>
      )}
    </div>
  )
}
