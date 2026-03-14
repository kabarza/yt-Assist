import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  CommentRepliesSessionState,
  GeneratedReply,
  ToneStyle,
} from '@/types/toolSessions'

interface CommentRepliesStore extends CommentRepliesSessionState {
  setComments: (comments: string) => void
  setSelectedTones: (selectedTones: ToneStyle[]) => void
  toggleTone: (tone: ToneStyle) => void
  setCustomTone: (customTone: string) => void
  setGeneratedReplies: (generatedReplies: GeneratedReply[]) => void
}

export const useCommentRepliesStore = create<CommentRepliesStore>()(
  persist(
    (set) => ({
      comments: '',
      selectedTones: ['friendly', 'helpful'],
      customTone: '',
      generatedReplies: [],
      setComments: (comments) => set({ comments }),
      setSelectedTones: (selectedTones) => set({ selectedTones }),
      toggleTone: (tone) =>
        set((state) => ({
          selectedTones: state.selectedTones.includes(tone)
            ? state.selectedTones.filter((entry) => entry !== tone)
            : [...state.selectedTones, tone],
        })),
      setCustomTone: (customTone) => set({ customTone }),
      setGeneratedReplies: (generatedReplies) => set({ generatedReplies }),
    }),
    {
      name: 'yt-assist-comment-replies-session',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
