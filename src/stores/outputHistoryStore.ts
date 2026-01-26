import { useState, useEffect, useCallback } from 'react'

export interface OutputHistoryItem {
  id: string
  prompt: string
  timestamp: number
  preview: string // First 100 chars for display
}

const STORAGE_KEY = 'yt-assist-output-history'
const MAX_HISTORY = 20

export function useOutputHistory() {
  const [history, setHistory] = useState<OutputHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Ignore errors
    }
    return []
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch {
      // Ignore errors
    }
  }, [history])

  const addToHistory = useCallback((prompt: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const preview = prompt.replace(/\s+/g, ' ').trim().slice(0, 100)
    
    const newItem: OutputHistoryItem = {
      id,
      prompt,
      timestamp: Date.now(),
      preview: preview + (prompt.length > 100 ? '...' : ''),
    }

    setHistory(prev => {
      // Don't add duplicate prompts
      if (prev.length > 0 && prev[0].prompt === prompt) {
        return prev
      }
      return [newItem, ...prev].slice(0, MAX_HISTORY)
    })
  }, [])

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  }
}
