import { create } from 'zustand';
import { CanvasHistoryItem, CanvasState, DrawingData, DrawingHistoryItem, CanvasChatState, CanvasType } from '../types/canvas';

const CANVAS_CHATS_KEY = 'yt-assist-canvas-chats';
const CANVAS_OPEN_KEY = 'yt-assist-canvas-open';
const CANVAS_WIDTH_KEY = 'yt-assist-canvas-width';
const MAX_HISTORY_ITEMS = 20;

interface CanvasStore extends CanvasState {
  isOpen: boolean;
  width: number;
  activeChatId: string | null;
  chatStates: Record<string, CanvasChatState>;
  setActiveChatId: (chatId: string | null) => void;
  setContent: (content: string) => void;
  setIsAttached: (isAttached: boolean) => void;
  setIsOpen: (isOpen: boolean) => void;
  setWidth: (width: number) => void;
  setMode: (mode: 'notes' | 'draw') => void;
  setDrawingData: (data: DrawingData | null) => void;
  setDrawingSnapshot: (snapshot: string | null) => void;
  setCanvasType: (type: CanvasType) => void;
  setCanvasInstructions: (instructions: string) => void;
  captureDrawingForAI: () => Promise<void>;
  saveSnapshot: () => void;
  restoreFromHistory: (id: string) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
  saveDrawingSnapshot: () => void;
  restoreDrawingFromHistory: (id: string) => void;
  deleteDrawingHistoryItem: (id: string) => void;
  clearDrawingHistory: () => void;
}

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
};

const createEmptyChatState = (): CanvasChatState => ({
  mode: 'notes',
  content: '',
  history: [],
  drawingData: null,
  drawingSnapshot: null,
  drawingHistory: [],
  canvasType: 'draft',
  canvasInstructions: 'This is the data from the document that we are working on',
});

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // Global UI state
  isOpen: loadFromStorage(CANVAS_OPEN_KEY, false),
  width: loadFromStorage(CANVAS_WIDTH_KEY, 400),
  isAttached: false,
  activeChatId: null,
  chatStates: loadFromStorage(CANVAS_CHATS_KEY, {}),

  // Current chat state (defaults)
  mode: 'notes',
  content: '',
  history: [],
  drawingData: null,
  drawingSnapshot: null,
  drawingHistory: [],
  canvasType: 'draft',
  canvasInstructions: 'This is the data from the document that we are working on',

  setActiveChatId: (chatId: string | null) => {
    const { chatStates, activeChatId: currentChatId } = get();

    // Save current chat state before switching
    if (currentChatId) {
      const currentState = get();
      chatStates[currentChatId] = {
        mode: currentState.mode,
        content: currentState.content,
        history: currentState.history,
        drawingData: currentState.drawingData,
        drawingSnapshot: currentState.drawingSnapshot,
        drawingHistory: currentState.drawingHistory,
        canvasType: currentState.canvasType,
        canvasInstructions: currentState.canvasInstructions,
      };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }

    // Load new chat state
    if (chatId) {
      const chatState = chatStates[chatId] || createEmptyChatState();
      set({
        activeChatId: chatId,
        mode: chatState.mode,
        content: chatState.content,
        history: chatState.history,
        drawingData: chatState.drawingData,
        drawingSnapshot: chatState.drawingSnapshot,
        drawingHistory: chatState.drawingHistory,
        canvasType: chatState.canvasType,
        canvasInstructions: chatState.canvasInstructions,
        isAttached: false, // Reset attachment state when switching chats
      });
    } else {
      set({
        activeChatId: null,
        ...createEmptyChatState(),
        isAttached: false,
      });
    }
  },

  setContent: (content: string) => {
    set({ content });
    const { activeChatId, chatStates } = get();
    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], content };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  setIsAttached: (isAttached: boolean) => {
    set({ isAttached });
  },

  setIsOpen: (isOpen: boolean) => {
    set({ isOpen });
    saveToStorage(CANVAS_OPEN_KEY, isOpen);
  },

  setWidth: (width: number) => {
    set({ width });
    saveToStorage(CANVAS_WIDTH_KEY, width);
  },

  setMode: (mode: 'notes' | 'draw') => {
    set({ mode });
    const { activeChatId, chatStates } = get();
    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], mode };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  setDrawingData: (data: DrawingData | null) => {
    set({ drawingData: data });
    const { activeChatId, chatStates } = get();
    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], drawingData: data };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  setDrawingSnapshot: (snapshot: string | null) => {
    set({ drawingSnapshot: snapshot });
    const { activeChatId, chatStates } = get();
    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], drawingSnapshot: snapshot };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  captureDrawingForAI: async () => {
    // This will be called from the DrawingCanvas component
    // which has access to the Excalidraw API
  },

  saveSnapshot: () => {
    const { content, history, activeChatId, chatStates } = get();

    // Skip if content is empty
    if (!content.trim()) {
      return;
    }

    // Skip if content matches most recent snapshot
    if (history.length > 0 && history[0].content === content) {
      return;
    }

    const preview = content.slice(0, 100).replace(/\n/g, ' ');
    const newItem: CanvasHistoryItem = {
      id: Date.now().toString(),
      content,
      timestamp: Date.now(),
      preview,
    };

    const newHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    set({ history: newHistory });

    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], history: newHistory };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  restoreFromHistory: (id: string) => {
    const { history } = get();
    const item = history.find((h) => h.id === id);
    if (item) {
      get().setContent(item.content);
    }
  },

  deleteHistoryItem: (id: string) => {
    const { history, activeChatId, chatStates } = get();
    const newHistory = history.filter((h) => h.id !== id);
    set({ history: newHistory });

    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], history: newHistory };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  clearHistory: () => {
    const { activeChatId, chatStates } = get();
    set({ history: [] });

    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], history: [] };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  saveDrawingSnapshot: () => {
    const { drawingData, drawingSnapshot, drawingHistory, activeChatId, chatStates } = get();

    if (!drawingData || !drawingSnapshot) {
      return;
    }

    // Skip if data matches most recent snapshot
    if (drawingHistory.length > 0) {
      const mostRecent = drawingHistory[0];
      if (JSON.stringify(mostRecent.data) === JSON.stringify(drawingData)) {
        return;
      }
    }

    const preview = `Drawing ${new Date().toLocaleString()}`;
    const newItem: DrawingHistoryItem = {
      id: Date.now().toString(),
      data: drawingData,
      snapshot: drawingSnapshot,
      timestamp: Date.now(),
      preview,
    };

    const newHistory = [newItem, ...drawingHistory].slice(0, MAX_HISTORY_ITEMS);
    set({ drawingHistory: newHistory });

    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], drawingHistory: newHistory };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  restoreDrawingFromHistory: (id: string) => {
    const { drawingHistory } = get();
    const item = drawingHistory.find((h) => h.id === id);
    if (item) {
      get().setDrawingData(item.data);
      get().setDrawingSnapshot(item.snapshot);
    }
  },

  deleteDrawingHistoryItem: (id: string) => {
    const { drawingHistory, activeChatId, chatStates } = get();
    const newHistory = drawingHistory.filter((h) => h.id !== id);
    set({ drawingHistory: newHistory });

    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], drawingHistory: newHistory };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  clearDrawingHistory: () => {
    const { activeChatId, chatStates } = get();
    set({ drawingHistory: [] });

    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], drawingHistory: [] };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  setCanvasType: (type: CanvasType) => {
    set({ canvasType: type });
    const { activeChatId, chatStates } = get();
    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], canvasType: type };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },

  setCanvasInstructions: (instructions: string) => {
    set({ canvasInstructions: instructions });
    const { activeChatId, chatStates } = get();
    if (activeChatId) {
      chatStates[activeChatId] = { ...chatStates[activeChatId], canvasInstructions: instructions };
      saveToStorage(CANVAS_CHATS_KEY, chatStates);
    }
  },
}));
