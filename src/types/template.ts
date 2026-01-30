export interface TemplateSection {
  id: string
  name: string
  content: string
  enabled: boolean
  order: number
}

export interface OutputType {
  id: string
  name: string
  enabled: boolean
  order: number
  quantity: number
  description: string
}

export interface TemplatePreset {
  id: string
  name: string
  sections: TemplateSection[]
  outputTypes: OutputType[]
  createdAt: number
}

export interface Template {
  id: string
  name: string
  sections: TemplateSection[]
}

export interface UserInputs {
  transcript: string
  mustInclude: string
  niceToInclude: string
  avoidWords: string
  includeName: boolean
  nameForTitles: string
  hashtagCount: string
  additionalContext: string
}

// Available template variables
export const TEMPLATE_VARIABLES = [
  { name: 'transcript', description: 'Video transcript' },
  { name: 'mustInclude', description: 'Must-include words' },
  { name: 'niceToInclude', description: 'Nice-to-include words' },
  { name: 'avoidWords', description: 'Words to avoid' },
  { name: 'includeName', description: 'Include name flag' },
  { name: 'nameForTitles', description: 'Name for titles' },
  { name: 'hashtagCount', description: 'Number of hashtags' },
  { name: 'additionalContext', description: 'Additional context' },
] as const
