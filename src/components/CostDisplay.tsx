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
}

export function ConversationCost({ messages, modelId, showBreakdown = true }: ConversationCostProps) {
  const { totalCost, inputCost, outputCost, inputTokens, outputTokens } = calculateConversationCost(
    messages,
    modelId
  )

  if (showBreakdown) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex h-10 shrink-0 cursor-help items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-[13px] text-muted-foreground whitespace-nowrap">
              <DollarSign className="h-3 w-3" />
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
    <div className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-[13px] text-muted-foreground whitespace-nowrap">
      <DollarSign className="h-3 w-3" />
      <span className="font-mono font-medium">{formatCost(totalCost)}</span>
    </div>
  )
}
