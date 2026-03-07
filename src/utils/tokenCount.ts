import type { Message } from '../types/chat'

// Approximate token count using ~4 characters per token rule of thumb
// This is a rough estimate - actual tokenization varies by model
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Count tokens in message content
export function countMessageTokens(message: Message): number {
  let total = 0

  for (const part of message.content) {
    if (part.type === 'text' && part.text) {
      total += estimateTokens(part.text)
    }
    // Images are expensive - rough estimate based on typical vision model token usage
    if (part.type === 'image') {
      total += 1000 // Approximate tokens for an image
    }
  }

  return total
}

// Count total tokens in conversation
export function countConversationTokens(messages: Message[]): number {
  return messages.reduce((sum, message) => sum + countMessageTokens(message), 0)
}

// Model context window limits (in tokens)
export const MODEL_LIMITS: Record<string, number> = {
  // Anthropic models
  'claude-sonnet-4-20250514': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-20241022': 200000,

  // OpenAI models
  'gpt-5.2': 128000,
  'gpt-5.2-pro': 128000,
  'gpt-5.1': 128000,
  'gpt-5.1-mini': 128000,
  'gpt-4.1': 128000,
  'gpt-4.1-mini': 128000,
  'gpt-4.1-nano': 128000,
  'o4-mini': 128000,
  'o3': 200000,
  'o3-mini': 200000,
  'o1': 200000,
  'o1-mini': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
}

// Get context window limit for a model
export function getModelLimit(modelId: string): number {
  return MODEL_LIMITS[modelId] || 128000 // Default to 128k if unknown
}

// Calculate usage percentage
export function getUsagePercentage(tokenCount: number, modelId: string): number {
  const limit = getModelLimit(modelId)
  return (tokenCount / limit) * 100
}

// Get color based on usage percentage
export function getUsageColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage < 50) return 'green'
  if (percentage < 80) return 'yellow'
  return 'red'
}

// Format token count for display
export function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 1000000).toFixed(1)}M`
}
