import type { UserInputs } from './template'
import type { TranscriptImportMetadata, TranscriptImportStatus } from './transcriptImport'

export interface TranscriptImportSessionState {
  status: TranscriptImportStatus
  error: string | null
  jobId: string | null
  metadata: TranscriptImportMetadata | null
}

export interface PackagingSessionState {
  userInputs: UserInputs
  generatedPrompt: string
  transcriptImport: TranscriptImportSessionState
  competitorTitle: string
  competitorDescription: string
  yourTopic: string
  analysisResult: CompetitorAnalysisResult | null
  analyticsData: string
  insights: AnalyticsInsights | null
  batchItems: BatchItem[]
  newBatchItemName: string
  newBatchItemTranscript: string
  isBatchAddFormOpen: boolean
  selectedBatchItemId: string | null
}

export interface CompetitorAnalysisResult {
  analysis: string
  timestamp: number
}

export interface AnalyticsInsights {
  topPerformers: string
  underperforming: string
  patterns: string
  retention: string
  recommendations: string
}

export interface BatchItem {
  id: string
  name: string
  transcript: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  output?: string
  error?: string
}

export type ToneStyle = 'friendly' | 'professional' | 'humorous' | 'helpful'

export interface GeneratedReply {
  id: string
  comment: string
  replies: Array<{
    tone: ToneStyle
    reply: string
  }>
}

export interface CommentRepliesSessionState {
  comments: string
  selectedTones: ToneStyle[]
  customTone: string
  generatedReplies: GeneratedReply[]
}

export type ScriptStyle = 'casual' | 'formal' | 'energetic' | 'educational'

export interface ScriptSection {
  title: string
  content: string
  timing: string
  brollSuggestions: string[]
  transitions: string
}

export interface GeneratedScript {
  intro: ScriptSection
  mainContent: ScriptSection[]
  outro: ScriptSection
  fullScript: string
}

export interface ScriptToolSessionState {
  topic: string
  context: string
  duration: string
  style: ScriptStyle
  keyPoints: string
  generatedScript: GeneratedScript | null
}
