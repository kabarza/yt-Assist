export interface TemplateSection {
  id: string
  name: string
  content: string
  enabled: boolean
  order: number
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
