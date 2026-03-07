import type { Chat, ContentPart, Citation } from '../types/chat'

export type ExportFormat = 'markdown' | 'json' | 'text'

/**
 * Format a timestamp to a readable date-time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Extract text content from ContentPart array
 */
function getTextContent(content: ContentPart[]): string {
  return content
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n\n')
}

/**
 * Format citations as text
 */
function formatCitations(citations: Citation[]): string {
  if (!citations || citations.length === 0) return ''

  return '\n\n**Sources:**\n' + citations
    .map((cite, idx) => `${idx + 1}. [${cite.title}](${cite.url})`)
    .join('\n')
}

/**
 * Export chat as Markdown format
 */
export function exportAsMarkdown(chat: Chat): string {
  let markdown = `# ${chat.title}\n\n`
  markdown += `**Provider:** ${chat.provider}\n`
  markdown += `**Model:** ${chat.model}\n`
  markdown += `**Created:** ${formatTimestamp(chat.createdAt)}\n`
  markdown += `**Updated:** ${formatTimestamp(chat.updatedAt)}\n\n`
  markdown += '---\n\n'

  for (const message of chat.messages) {
    const role = message.role === 'user' ? 'User' : 'Assistant'
    markdown += `## ${role}\n`
    markdown += `*${formatTimestamp(message.timestamp)}*\n\n`

    // Add text content
    const textContent = getTextContent(message.content)
    if (textContent) {
      markdown += `${textContent}\n`
    }

    // Add image references
    const images = message.content.filter((part) => part.type === 'image')
    if (images.length > 0) {
      markdown += `\n*[${images.length} image${images.length > 1 ? 's' : ''} attached]*\n`
    }

    // Add citations if available
    if (message.citations && message.citations.length > 0) {
      markdown += formatCitations(message.citations)
    }

    markdown += '\n\n---\n\n'
  }

  return markdown
}

/**
 * Export chat as JSON format
 */
export function exportAsJSON(chat: Chat): string {
  return JSON.stringify(chat, null, 2)
}

/**
 * Export chat as plain text format
 */
export function exportAsText(chat: Chat): string {
  let text = `${chat.title}\n`
  text += `${'='.repeat(chat.title.length)}\n\n`
  text += `Provider: ${chat.provider}\n`
  text += `Model: ${chat.model}\n`
  text += `Created: ${formatTimestamp(chat.createdAt)}\n`
  text += `Updated: ${formatTimestamp(chat.updatedAt)}\n\n`
  text += '-'.repeat(60) + '\n\n'

  for (const message of chat.messages) {
    const role = message.role === 'user' ? 'USER' : 'ASSISTANT'
    text += `[${role}] - ${formatTimestamp(message.timestamp)}\n\n`

    // Add text content
    const textContent = getTextContent(message.content)
    if (textContent) {
      text += `${textContent}\n`
    }

    // Add image references
    const images = message.content.filter((part) => part.type === 'image')
    if (images.length > 0) {
      text += `\n[${images.length} image${images.length > 1 ? 's' : ''} attached]\n`
    }

    // Add citations if available
    if (message.citations && message.citations.length > 0) {
      text += '\n\nSources:\n'
      message.citations.forEach((cite, idx) => {
        text += `${idx + 1}. ${cite.title} - ${cite.url}\n`
      })
    }

    text += '\n' + '-'.repeat(60) + '\n\n'
  }

  return text
}

/**
 * Generate filename for export
 */
export function generateFilename(chat: Chat, format: ExportFormat): string {
  const sanitizedTitle = chat.title
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 50)

  const date = new Date().toISOString().split('T')[0]
  const extension = format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'txt'

  return `${sanitizedTitle}-${date}.${extension}`
}

/**
 * Download file to browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Main export function
 */
export function exportChat(chat: Chat, format: ExportFormat) {
  let content: string
  let mimeType: string

  switch (format) {
    case 'markdown':
      content = exportAsMarkdown(chat)
      mimeType = 'text/markdown'
      break
    case 'json':
      content = exportAsJSON(chat)
      mimeType = 'application/json'
      break
    case 'text':
      content = exportAsText(chat)
      mimeType = 'text/plain'
      break
  }

  const filename = generateFilename(chat, format)
  downloadFile(content, filename, mimeType)
}
