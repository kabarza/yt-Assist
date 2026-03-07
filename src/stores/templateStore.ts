import { useState, useEffect, useCallback } from 'react'
import type { TemplateSection, OutputType, TemplatePreset, UserInputs } from '../types/template'
import { defaultSections, defaultOutputTypes } from '../data/defaultTemplate'

const STORAGE_KEY = 'yt-assist-template'
const OUTPUT_TYPES_KEY = 'yt-assist-output-types'
const PRESETS_KEY = 'yt-assist-presets'
const DEFAULT_PRESET_KEY = 'yt-assist-default-preset'
const ACTIVE_PRESET_KEY = 'yt-assist-active-preset'

// Generate dynamic output specifications based on output types
function generateOutputSpecsContent(outputTypes: OutputType[]): string {
  const enabledOutputs = outputTypes
    .filter(o => o.enabled)
    .sort((a, b) => a.order - b.order)

  if (enabledOutputs.length === 0) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No outputs selected.`
  }

  const outputSpecs: Record<string, (qty: number) => string> = {
    'core-hook': () => `CORE explanation
Exactly 2 lines:
- Line 1: What the video is REALLY about
- Line 2: Why someone should click`,

    'descriptions': (qty) => `YOUTUBE DESCRIPTIONS
- Quantity: ${qty} descriptions
- Format: Code block for each one of the 3
- Each is ONE paragraph
- Must start with: "In this video we talk about ..."
- Must mention: X, Y, and Z (3 concrete things from the transcript)
- Length: Not too short, no filler`,

    'titles-thumbnails': (qty) => `PACKAGING SET A: TITLE + THUMBNAIL PAIRS
- Quantity: ${qty} pairs
- Format: Table with Title and Thumbnail Text columns
- Titles: Follow length rules (40-60 chars) and Must-Include Words if provided
- Thumbnail text: 1-4 words, complements title (not repeats)
- Variety: Each pair should feel like a distinct A/B test option`,

    'extra-thumbnails': (qty) => `PACKAGING SET B: EXTRA THUMBNAIL TEXTS
- Quantity: ${qty} options
- Format: Single column table
- Length: 1-4 words each
- No repeats from Set A
- Include: More aggressive/curious variations`,

    'chapters': () => `CHAPTERS
- Format: Code block for easy copy-paste
- Structure: 00:00 Chapter Title
- Rules: Start at 00:00, minimum 3 chapters, ascending timestamps, 10+ second segments
- Titles: 1-4 words, Title Case, specific not vague`,

    'hashtags': (qty) => `HASHTAGS
- Format: Code block for easy copy-paste
- Quantity: ${qty}
- Relevant only — no spam
- Format: use space between them: #1 #2 #3`,
  }

  const specs = enabledOutputs.map((output, idx) => {
    const specFn = outputSpecs[output.id]
    const spec = specFn ? specFn(output.quantity) : `${output.name}\n- Quantity: ${output.quantity}`
    return `${idx + 1}) ${spec}`
  }).join('\n\n')

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${specs}`
}

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

  const [outputTypes, setOutputTypes] = useState<OutputType[]>(() => {
    try {
      const saved = localStorage.getItem(OUTPUT_TYPES_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Ignore errors
    }
    return defaultOutputTypes
  })

  const [presets, setPresets] = useState<TemplatePreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Ignore errors
    }
    return []
  })

  // Active preset tracking
  const [activePresetId, setActivePresetId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_PRESET_KEY)
    } catch {
      return null
    }
  })

  // Default preset (auto-loads on start)
  const [defaultPresetId, setDefaultPresetIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DEFAULT_PRESET_KEY)
    } catch {
      return null
    }
  })

  // Save to localStorage whenever sections change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sections))
    } catch {
      // Ignore errors
    }
  }, [sections])

  // Save output types to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(OUTPUT_TYPES_KEY, JSON.stringify(outputTypes))
    } catch {
      // Ignore errors
    }
  }, [outputTypes])

  // Save presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
    } catch {
      // Ignore errors
    }
  }, [presets])

  // Save active preset ID to localStorage
  useEffect(() => {
    try {
      if (activePresetId) {
        localStorage.setItem(ACTIVE_PRESET_KEY, activePresetId)
      } else {
        localStorage.removeItem(ACTIVE_PRESET_KEY)
      }
    } catch {
      // Ignore errors
    }
  }, [activePresetId])

  // Save default preset ID to localStorage
  useEffect(() => {
    try {
      if (defaultPresetId) {
        localStorage.setItem(DEFAULT_PRESET_KEY, defaultPresetId)
      } else {
        localStorage.removeItem(DEFAULT_PRESET_KEY)
      }
    } catch {
      // Ignore errors
    }
  }, [defaultPresetId])

  // Section management
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

  // Output types management
  const reorderOutputTypes = useCallback((oldIndex: number, newIndex: number) => {
    setOutputTypes(prev => {
      const newTypes = [...prev]
      const [removed] = newTypes.splice(oldIndex, 1)
      newTypes.splice(newIndex, 0, removed)
      return newTypes.map((o, i) => ({ ...o, order: i }))
    })
  }, [])

  const toggleOutputType = useCallback((id: string) => {
    setOutputTypes(prev => prev.map(o => 
      o.id === id ? { ...o, enabled: !o.enabled } : o
    ))
  }, [])

  const updateOutputTypeQuantity = useCallback((id: string, quantity: number) => {
    setOutputTypes(prev => prev.map(o => 
      o.id === id ? { ...o, quantity: Math.max(1, quantity) } : o
    ))
  }, [])

  // Preset management
  const savePreset = useCallback((name: string) => {
    const newPreset: TemplatePreset = {
      id: `preset-${Date.now()}`,
      name,
      sections: JSON.parse(JSON.stringify(sections)),
      outputTypes: JSON.parse(JSON.stringify(outputTypes)),
      createdAt: Date.now(),
    }
    setPresets(prev => [...prev, newPreset])
    setActivePresetId(newPreset.id)
    return newPreset.id
  }, [sections, outputTypes])

  const loadPreset = useCallback((id: string) => {
    const preset = presets.find(p => p.id === id)
    if (preset) {
      setSections(preset.sections)
      setOutputTypes(preset.outputTypes)
      setActivePresetId(id)
    }
  }, [presets])

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id))
    // Clear active/default if deleting that preset
    if (activePresetId === id) {
      setActivePresetId(null)
    }
    if (defaultPresetId === id) {
      setDefaultPresetIdState(null)
    }
  }, [activePresetId, defaultPresetId])

  const setDefaultPreset = useCallback((id: string | null) => {
    setDefaultPresetIdState(id)
  }, [])

  const exportPresets = useCallback(() => {
    return JSON.stringify({
      sections,
      outputTypes,
      presets,
    }, null, 2)
  }, [sections, outputTypes, presets])

  const importPresets = useCallback((jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr)
      if (data.sections) setSections(data.sections)
      if (data.outputTypes) setOutputTypes(data.outputTypes)
      if (data.presets) setPresets(data.presets)
      return true
    } catch {
      return false
    }
  }, [])

  const resetToDefault = useCallback(() => {
    setSections(defaultSections)
    setOutputTypes(defaultOutputTypes)
    setActivePresetId(null)
  }, [])

  // Get active preset object (for displaying name)
  const activePreset = presets.find(p => p.id === activePresetId) || null

  // Auto-load default preset on initialization
  useEffect(() => {
    if (defaultPresetId && presets.length > 0) {
      const defaultPreset = presets.find(p => p.id === defaultPresetId)
      if (defaultPreset && !activePresetId) {
        // Only auto-load if no preset is currently active
        setSections(defaultPreset.sections)
        setOutputTypes(defaultPreset.outputTypes)
        setActivePresetId(defaultPresetId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only on mount

  const generatePrompt = useCallback((inputs: UserInputs): string => {
    // Generate dynamic output specs from output types
    const dynamicOutputSpecs = generateOutputSpecsContent(outputTypes)

    // Replace the output-specs section content with dynamic content
    const sectionsWithDynamicSpecs = sections.map(s => 
      s.id === 'output-specs' ? { ...s, content: dynamicOutputSpecs } : s
    )

    const enabledSections = sectionsWithDynamicSpecs
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
  }, [sections, outputTypes])

  // Generate a preview prompt with placeholder values
  const generatePreviewPrompt = useCallback((): string => {
    const mockInputs: UserInputs = {
      transcript: '[Your transcript will appear here]',
      mustInclude: '[Must-include words]',
      niceToInclude: '[Nice-to-include words]',
      avoidWords: '[Words to avoid]',
      includeName: true,
      nameForTitles: '[Name for titles]',
      hashtagCount: '5',
      additionalContext: '[Additional context]',
    }
    return generatePrompt(mockInputs)
  }, [generatePrompt])

  return {
    // Sections
    sections,
    reorderSections,
    toggleSection,
    updateSectionContent,
    // Output types
    outputTypes,
    reorderOutputTypes,
    toggleOutputType,
    updateOutputTypeQuantity,
    // Presets
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    exportPresets,
    importPresets,
    // Active & Default preset
    activePresetId,
    activePreset,
    defaultPresetId,
    setDefaultPreset,
    // General
    resetToDefault,
    generatePrompt,
    generatePreviewPrompt,
  }
}
