export type SearchVolume = 'high' | 'medium' | 'low'

export interface SEOKeyword {
  keyword: string
  volume?: SearchVolume
}

export interface SEOKeywords {
  primary: SEOKeyword[]
  secondary: SEOKeyword[]
  longTail: SEOKeyword[]
}
