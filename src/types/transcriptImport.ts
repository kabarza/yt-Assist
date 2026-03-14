export type TranscriptSourceMode = 'manual' | 'url'

export type TranscriptImportStatus = 'idle' | 'loading' | 'polling' | 'success' | 'error'

export interface ImportedTranscriptSegment {
  text: string
  offsetSeconds: number
  durationSeconds: number
}

export interface TranscriptImportMetadata {
  sourceUrl: string
  provider: 'supadata'
  wasGenerated: boolean
  title?: string
  language?: string
  availableLanguages: string[]
}

export interface TranscriptImportResponse {
  status: 'completed' | 'pending'
  jobId?: string
  transcriptText?: string
  segments?: ImportedTranscriptSegment[]
  metadata?: TranscriptImportMetadata
}
