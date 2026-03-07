import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, ArrowRight } from 'lucide-react'
import type { OutputHistoryItem } from '../stores/outputHistoryStore'

interface OutputDiffViewProps {
  oldOutput: OutputHistoryItem
  newOutput: OutputHistoryItem
  onClose: () => void
}

// Simple line-by-line diff
function computeLineDiff(oldText: string, newText: string): {
  oldLines: Array<{ line: string; type: 'removed' | 'unchanged' | 'context' }>
  newLines: Array<{ line: string; type: 'added' | 'unchanged' | 'context' }>
} {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  const oldResult: Array<{ line: string; type: 'removed' | 'unchanged' | 'context' }> = []
  const newResult: Array<{ line: string; type: 'added' | 'unchanged' | 'context' }> = []

  // Simple comparison - check if lines exist in both
  const newSet = new Set(newLines)
  const oldSet = new Set(oldLines)

  oldLines.forEach(line => {
    if (newSet.has(line)) {
      oldResult.push({ line, type: 'unchanged' })
    } else {
      oldResult.push({ line, type: 'removed' })
    }
  })

  newLines.forEach(line => {
    if (oldSet.has(line)) {
      newResult.push({ line, type: 'unchanged' })
    } else {
      newResult.push({ line, type: 'added' })
    }
  })

  return { oldLines: oldResult, newLines: newResult }
}

function DiffPanel({
  title,
  lines,
  timestamp,
}: {
  title: string
  lines: Array<{ line: string; type: string }>
  timestamp: number
}) {
  const date = new Date(timestamp)

  return (
    <Card className="flex-1 min-w-0 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {date.toLocaleString()}
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {lines.map((item, idx) => (
              <div
                key={idx}
                className={
                  item.type === 'removed'
                    ? 'bg-red-500/20 text-red-300 px-1 -mx-1'
                    : item.type === 'added'
                    ? 'bg-green-500/20 text-green-300 px-1 -mx-1'
                    : 'text-foreground'
                }
              >
                {item.type === 'removed' && '- '}
                {item.type === 'added' && '+ '}
                {item.line}
              </div>
            ))}
          </pre>
        </div>
      </ScrollArea>
    </Card>
  )
}

export default function OutputDiffView({ oldOutput, newOutput, onClose }: OutputDiffViewProps) {
  const { oldLines, newLines } = computeLineDiff(oldOutput.prompt, newOutput.prompt)

  // Count changes
  const additions = newLines.filter(l => l.type === 'added').length
  const deletions = oldLines.filter(l => l.type === 'removed').length
  const unchanged = oldLines.filter(l => l.type === 'unchanged').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Output Comparison</h2>
          <p className="text-xs text-muted-foreground">
            {additions > 0 && <span className="text-green-500">+{additions} additions</span>}
            {additions > 0 && deletions > 0 && <span className="mx-1">•</span>}
            {deletions > 0 && <span className="text-red-500">-{deletions} deletions</span>}
            {(additions > 0 || deletions > 0) && unchanged > 0 && <span className="mx-1">•</span>}
            {unchanged > 0 && <span>{unchanged} unchanged</span>}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Diff panels */}
      <div className="flex-1 overflow-hidden p-4 gap-4 flex">
        <DiffPanel
          title="Previous Output"
          lines={oldLines}
          timestamp={oldOutput.timestamp}
        />
        <div className="flex items-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <DiffPanel
          title="Current Output"
          lines={newLines}
          timestamp={newOutput.timestamp}
        />
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/20 border border-green-500/40 rounded" />
            <span>Added lines</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500/20 border border-red-500/40 rounded" />
            <span>Removed lines</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted border border-border rounded" />
            <span>Unchanged lines</span>
          </div>
        </div>
      </div>
    </div>
  )
}
