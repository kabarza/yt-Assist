import type { Message } from '../types/chat'
import { countMessageTokens } from './tokenCount'

// Model pricing in USD per million tokens
// Prices as of January 2025 (adjust as needed)
export const MODEL_PRICING = {
  // Anthropic models
  'claude-sonnet-4-20250514': {
    input: 3.0,  // $3 per million input tokens
    output: 15.0, // $15 per million output tokens
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8,
    output: 4.0,
  },

  // OpenAI models (estimated/placeholder pricing)
  'gpt-5.2': {
    input: 5.0,
    output: 15.0,
  },
  'gpt-5.2-pro': {
    input: 10.0,
    output: 30.0,
  },
  'gpt-5.1': {
    input: 3.0,
    output: 10.0,
  },
  'gpt-5.1-mini': {
    input: 0.15,
    output: 0.6,
  },
  'gpt-4.1': {
    input: 2.5,
    output: 10.0,
  },
  'gpt-4.1-mini': {
    input: 0.15,
    output: 0.6,
  },
  'gpt-4.1-nano': {
    input: 0.1,
    output: 0.4,
  },
  'o4-mini': {
    input: 1.0,
    output: 4.0,
  },
  'o3': {
    input: 10.0,
    output: 40.0,
  },
  'o3-mini': {
    input: 1.0,
    output: 4.0,
  },
  'o1': {
    input: 15.0,
    output: 60.0,
  },
  'o1-mini': {
    input: 3.0,
    output: 12.0,
  },
  'gpt-4o': {
    input: 2.5,
    output: 10.0,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.6,
  },
} as const

// Get pricing for a model
export function getModelPricing(modelId: string): { input: number; output: number } {
  return MODEL_PRICING[modelId as keyof typeof MODEL_PRICING] || { input: 1.0, output: 3.0 }
}

// Calculate cost for a single message
export function calculateMessageCost(message: Message, modelId: string): number {
  const tokenCount = countMessageTokens(message)
  const pricing = getModelPricing(modelId)

  // User messages are input tokens, assistant messages are output tokens
  const costPerMillionTokens = message.role === 'user' ? pricing.input : pricing.output

  // Convert to actual cost (tokens / 1,000,000 * price)
  return (tokenCount / 1_000_000) * costPerMillionTokens
}

// Calculate total conversation cost
export function calculateConversationCost(messages: Message[], modelId: string): {
  totalCost: number
  inputCost: number
  outputCost: number
  inputTokens: number
  outputTokens: number
} {
  const pricing = getModelPricing(modelId)

  let inputTokens = 0
  let outputTokens = 0

  for (const message of messages) {
    const tokenCount = countMessageTokens(message)
    if (message.role === 'user') {
      inputTokens += tokenCount
    } else {
      outputTokens += tokenCount
    }
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return {
    totalCost: inputCost + outputCost,
    inputCost,
    outputCost,
    inputTokens,
    outputTokens,
  }
}

// Format cost for display
export function formatCost(cost: number): string {
  if (cost < 0.001) {
    // Show in fractions of a cent for very small costs
    return `<$0.001`
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`
  }
  return `$${cost.toFixed(2)}`
}

// Format cost breakdown for tooltip
export function formatCostBreakdown(
  inputTokens: number,
  outputTokens: number,
  inputCost: number,
  outputCost: number
): string {
  return `Input: ${inputTokens.toLocaleString()} tokens ($${inputCost.toFixed(4)})
Output: ${outputTokens.toLocaleString()} tokens ($${outputCost.toFixed(4)})
Total: $${(inputCost + outputCost).toFixed(4)}`
}
