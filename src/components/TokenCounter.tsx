import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '../types/chat'
import {
  countConversationTokens,
  getModelLimit,
  getUsagePercentage,
  getUsageColor,
  formatTokenCount,
} from '../utils/tokenCount'

interface TokenCounterProps {
  messages: Message[]
  modelId: string
}

export default function TokenCounter({ messages, modelId }: TokenCounterProps) {
  const tokenCount = countConversationTokens(messages)
  const limit = getModelLimit(modelId)
  const percentage = getUsagePercentage(tokenCount, modelId)
  const color = getUsageColor(percentage)

  const colorClasses = {
    green: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400',
    yellow: 'border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400',
    red: 'border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-400',
  }

  const showWarning = percentage >= 80

  return (
    <div
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] whitespace-nowrap',
        colorClasses[color]
      )}
      title={`${tokenCount.toLocaleString()} / ${limit.toLocaleString()} tokens (${percentage.toFixed(1)}%)`}
    >
      {showWarning && <Info className="h-3 w-3" />}
      <span className="font-mono font-medium">
        {formatTokenCount(tokenCount)} / {formatTokenCount(limit)}
      </span>
      <span className="opacity-70">({percentage.toFixed(0)}%)</span>
    </div>
  )
}
