import { DollarSign } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { Message } from '../types/chat'
import {
  calculateConversationCost,
  calculateMessageCost,
  formatCost,
  formatCostBreakdown,
} from '../utils/pricing'

interface MessageCostProps {
  message: Message
  modelId: string
}

export function MessageCost({ message, modelId }: MessageCostProps) {
  const cost = calculateMessageCost(message, modelId)

  if (cost < 0.0001) {
    return null // Don't show extremely small costs
  }

  return (
    <span className="text-xs text-muted-foreground font-mono">
      {formatCost(cost)}
    </span>
  )
}

interface ConversationCostProps {
  messages: Message[]
  modelId: string
  showBreakdown?: boolean
  compact?: boolean
}

export function ConversationCost({
  messages,
  modelId,
  showBreakdown = true,
  compact = false,
}: ConversationCostProps) {
  const { totalCost, inputCost, outputCost, inputTokens, outputTokens } = calculateConversationCost(
    messages,
    modelId
  )

  const containerClassName = compact
    ? 'inline-flex h-7 shrink-0 cursor-help items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 text-[11px] text-muted-foreground whitespace-nowrap'
    : 'inline-flex h-10 shrink-0 cursor-help items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-[13px] text-muted-foreground whitespace-nowrap'

  if (showBreakdown) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={containerClassName}>
              <DollarSign className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
              <span className="font-mono font-medium">{formatCost(totalCost)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <pre className="whitespace-pre-wrap">
              {formatCostBreakdown(inputTokens, outputTokens, inputCost, outputCost)}
            </pre>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={containerClassName}>
      <DollarSign className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      <span className="font-mono font-medium">{formatCost(totalCost)}</span>
    </div>
  )
}
