import type { Chat, ContentPart } from '../types/chat'

export interface SearchMatch {
  chatId: string
  type: 'title' | 'message'
  messageId?: string
  snippet: string
  matchIndex: number
}

export interface ChatSearchResult {
  chat: Chat
  matches: SearchMatch[]
  score: number  // Higher score = better match
}

/**
 * Extract text content from message content parts
 */
function extractTextFromContent(content: ContentPart[]): string {
  return content
    .filter(part => part.type === 'text' && part.text)
    .map(part => part.text!)
    .join(' ')
}

/**
 * Create a snippet around the match position
 * @param text The full text
 * @param matchIndex Index where the match starts
 * @param matchLength Length of the matched text
 * @param contextLength Characters of context on each side
 */
function createSnippet(
  text: string,
  matchIndex: number,
  matchLength: number,
  contextLength: number = 50
): string {
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(text.length, matchIndex + matchLength + contextLength)

  let snippet = text.slice(start, end)

  // Add ellipsis if we're not at the start/end
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'

  return snippet.trim()
}

/**
 * Search for a query string in a chat
 * Returns all matches found in the chat
 */
export function searchInChat(chat: Chat, query: string): SearchMatch[] {
  if (!query.trim()) return []

  const matches: SearchMatch[] = []
  const lowerQuery = query.toLowerCase()

  // Search in title
  const titleLower = chat.title.toLowerCase()
  const titleIndex = titleLower.indexOf(lowerQuery)
  if (titleIndex !== -1) {
    matches.push({
      chatId: chat.id,
      type: 'title',
      snippet: chat.title,
      matchIndex: titleIndex,
    })
  }

  // Search in messages
  for (const message of chat.messages) {
    const messageText = extractTextFromContent(message.content)
    const messageLower = messageText.toLowerCase()

    // Find all occurrences in this message
    let searchIndex = 0
    while (searchIndex < messageLower.length) {
      const matchIndex = messageLower.indexOf(lowerQuery, searchIndex)
      if (matchIndex === -1) break

      matches.push({
        chatId: chat.id,
        type: 'message',
        messageId: message.id,
        snippet: createSnippet(messageText, matchIndex, query.length),
        matchIndex,
      })

      searchIndex = matchIndex + 1  // Move past this match to find the next one
    }
  }

  return matches
}

/**
 * Search across all chats
 * Returns chats with matches, sorted by relevance (score)
 */
export function searchChats(chats: Chat[], query: string): ChatSearchResult[] {
  if (!query.trim()) return []

  const results: ChatSearchResult[] = []

  for (const chat of chats) {
    const matches = searchInChat(chat, query)

    if (matches.length > 0) {
      // Calculate score:
      // - Title matches are worth more (10 points)
      // - Message matches are worth 1 point each
      // - More recent chats get a small boost
      const titleMatches = matches.filter(m => m.type === 'title').length
      const messageMatches = matches.filter(m => m.type === 'message').length
      const recencyBoost = chat.updatedAt / 1000000000  // Small boost for recent chats

      const score = (titleMatches * 10) + messageMatches + recencyBoost

      results.push({
        chat,
        matches,
        score,
      })
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Highlight search query in text
 * Returns HTML string with <mark> tags around matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  let result = ''
  let lastIndex = 0
  let searchIndex = 0

  while (searchIndex < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, searchIndex)
    if (matchIndex === -1) break

    // Add text before match
    result += text.slice(lastIndex, matchIndex)

    // Add highlighted match
    result += '<mark>' + text.slice(matchIndex, matchIndex + query.length) + '</mark>'

    lastIndex = matchIndex + query.length
    searchIndex = matchIndex + 1
  }

  // Add remaining text
  result += text.slice(lastIndex)

  return result
}
