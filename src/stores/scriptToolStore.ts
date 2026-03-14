import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  GeneratedScript,
  ScriptStyle,
  ScriptToolSessionState,
} from '@/types/toolSessions'

interface ScriptToolStore extends ScriptToolSessionState {
  setTopic: (topic: string) => void
  setContext: (context: string) => void
  setDuration: (duration: string) => void
  setStyle: (style: ScriptStyle) => void
  setKeyPoints: (keyPoints: string) => void
  setGeneratedScript: (generatedScript: GeneratedScript | null) => void
}

export const useScriptToolStore = create<ScriptToolStore>()(
  persist(
    (set) => ({
      topic: '',
      context: '',
      duration: '10',
      style: 'casual',
      keyPoints: '',
      generatedScript: null,
      setTopic: (topic) => set({ topic }),
      setContext: (context) => set({ context }),
      setDuration: (duration) => set({ duration }),
      setStyle: (style) => set({ style }),
      setKeyPoints: (keyPoints) => set({ keyPoints }),
      setGeneratedScript: (generatedScript) => set({ generatedScript }),
    }),
    {
      name: 'yt-assist-script-tool-session',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
