import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  AnalyticsInsights,
  BatchItem,
  CompetitorAnalysisResult,
  PackagingSessionState,
  TranscriptImportSessionState,
} from '@/types/toolSessions'
import type { UserInputs } from '@/types/template'

export const DEFAULT_PACKAGING_INPUTS: UserInputs = {
  transcript: '',
  transcriptSourceMode: 'manual',
  transcriptUrl: '',
  transcriptIncludeTimestamps: true,
  mustInclude: '',
  niceToInclude: '',
  avoidWords: '',
  hashtagCount: '5',
  additionalContext: '',
}

export const DEFAULT_TRANSCRIPT_IMPORT_STATE: TranscriptImportSessionState = {
  status: 'idle',
  error: null,
  jobId: null,
  metadata: null,
}

interface PackagingSessionStore extends PackagingSessionState {
  setUserInputs: (next: UserInputs) => void
  updateUserInput: <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => void
  setGeneratedPrompt: (prompt: string) => void
  clearGeneratedPrompt: () => void
  setTranscriptImport: (next: Partial<TranscriptImportSessionState>) => void
  resetTranscriptImport: () => void
  setCompetitorTitle: (competitorTitle: string) => void
  setCompetitorDescription: (competitorDescription: string) => void
  setYourTopic: (yourTopic: string) => void
  setAnalysisResult: (analysisResult: CompetitorAnalysisResult | null) => void
  setAnalyticsData: (analyticsData: string) => void
  setInsights: (insights: AnalyticsInsights | null) => void
  setBatchItems: (batchItems: BatchItem[] | ((items: BatchItem[]) => BatchItem[])) => void
  setNewBatchItemName: (newBatchItemName: string) => void
  setNewBatchItemTranscript: (newBatchItemTranscript: string) => void
  setBatchAddFormOpen: (isBatchAddFormOpen: boolean) => void
  setSelectedBatchItemId: (selectedBatchItemId: string | null) => void
}

const initialState: PackagingSessionState = {
  userInputs: DEFAULT_PACKAGING_INPUTS,
  generatedPrompt: '',
  transcriptImport: DEFAULT_TRANSCRIPT_IMPORT_STATE,
  competitorTitle: '',
  competitorDescription: '',
  yourTopic: '',
  analysisResult: null,
  analyticsData: '',
  insights: null,
  batchItems: [],
  newBatchItemName: '',
  newBatchItemTranscript: '',
  isBatchAddFormOpen: false,
  selectedBatchItemId: null,
}

export const usePackagingSessionStore = create<PackagingSessionStore>()(
  persist(
    (set) => ({
      ...initialState,
      setUserInputs: (next) => set({ userInputs: next }),
      updateUserInput: (field, value) =>
        set((state) => ({
          userInputs: {
            ...state.userInputs,
            [field]: value,
          },
        })),
      setGeneratedPrompt: (generatedPrompt) => set({ generatedPrompt }),
      clearGeneratedPrompt: () => set({ generatedPrompt: '' }),
      setTranscriptImport: (next) =>
        set((state) => ({
          transcriptImport: {
            ...state.transcriptImport,
            ...next,
          },
        })),
      resetTranscriptImport: () => set({ transcriptImport: DEFAULT_TRANSCRIPT_IMPORT_STATE }),
      setCompetitorTitle: (competitorTitle) => set({ competitorTitle }),
      setCompetitorDescription: (competitorDescription) => set({ competitorDescription }),
      setYourTopic: (yourTopic) => set({ yourTopic }),
      setAnalysisResult: (analysisResult) => set({ analysisResult }),
      setAnalyticsData: (analyticsData) => set({ analyticsData }),
      setInsights: (insights) => set({ insights }),
      setBatchItems: (batchItems) =>
        set((state) => ({
          batchItems:
            typeof batchItems === 'function'
              ? batchItems(state.batchItems)
              : batchItems,
        })),
      setNewBatchItemName: (newBatchItemName) => set({ newBatchItemName }),
      setNewBatchItemTranscript: (newBatchItemTranscript) => set({ newBatchItemTranscript }),
      setBatchAddFormOpen: (isBatchAddFormOpen) => set({ isBatchAddFormOpen }),
      setSelectedBatchItemId: (selectedBatchItemId) => set({ selectedBatchItemId }),
    }),
    {
      name: 'yt-assist-packaging-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userInputs: state.userInputs,
        generatedPrompt: state.generatedPrompt,
        transcriptImport: {
          ...DEFAULT_TRANSCRIPT_IMPORT_STATE,
          metadata: state.transcriptImport.metadata,
        },
        competitorTitle: state.competitorTitle,
        competitorDescription: state.competitorDescription,
        yourTopic: state.yourTopic,
        analysisResult: state.analysisResult,
        analyticsData: state.analyticsData,
        insights: state.insights,
        batchItems: state.batchItems,
        newBatchItemName: state.newBatchItemName,
        newBatchItemTranscript: state.newBatchItemTranscript,
        isBatchAddFormOpen: state.isBatchAddFormOpen,
        selectedBatchItemId: state.selectedBatchItemId,
      }),
    },
  ),
)
