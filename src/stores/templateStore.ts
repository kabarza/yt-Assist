import { useState, useEffect, useCallback } from 'react'
import type { TemplateSection, UserInputs } from '../types/template'
import { defaultSections } from '../data/defaultTemplate'

const STORAGE_KEY = 'yt-assist-template'

// Simple store hook for template sections
export function useTemplateStore() {
  const [sections, setSections] = useState<TemplateSection[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Ignore errors
    }
    return defaultSections
  })

  // Save to localStorage whenever sections change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sections))
    } catch {
      // Ignore errors
    }
  }, [sections])

  const reorderSections = useCallback((oldIndex: number, newIndex: number) => {
    setSections(prev => {
      const newSections = [...prev]
      const [removed] = newSections.splice(oldIndex, 1)
      newSections.splice(newIndex, 0, removed)
      return newSections.map((s, i) => ({ ...s, order: i }))
    })
  }, [])

  const toggleSection = useCallback((id: string) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ))
  }, [])

  const updateSectionContent = useCallback((id: string, content: string) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, content } : s
    ))
  }, [])

  const resetToDefault = useCallback(() => {
    setSections(defaultSections)
  }, [])

  const generatePrompt = useCallback((inputs: UserInputs): string => {
    const enabledSections = sections
      .filter(s => s.enabled)
      .sort((a, b) => a.order - b.order)

    const replaceVars = (content: string): string => {
      return content
        .replace(/\$\{transcript\}/g, inputs.transcript || '[NO TRANSCRIPT PROVIDED]')
        .replace(/\$\{mustInclude\}/g, inputs.mustInclude || '(none)')
        .replace(/\$\{niceToInclude\}/g, inputs.niceToInclude || '(none)')
        .replace(/\$\{avoidWords\}/g, inputs.avoidWords || '(none)')
        .replace(/\$\{includeName\}/g, inputs.includeName ? 'Yes' : 'No')
        .replace(/\$\{nameForTitles\}/g, inputs.nameForTitles || '(none)')
        .replace(/\$\{hashtagCount\}/g, inputs.hashtagCount || '5')
        .replace(/\$\{additionalContext\}/g, inputs.additionalContext || '(none)')
    }

    return enabledSections.map(section => replaceVars(section.content)).join('\n\n')
  }, [sections])

  return {
    sections,
    reorderSections,
    toggleSection,
    updateSectionContent,
    resetToDefault,
    generatePrompt,
  }
}
