import { create } from 'zustand';
import { CanvasHistoryItem, CanvasState, DrawingData, DrawingHistoryItem } from '../types/canvas';

const CANVAS_CONTENT_KEY = 'yt-assist-canvas-content';
const CANVAS_HISTORY_KEY = 'yt-assist-canvas-history';
const CANVAS_ATTACHED_KEY = 'yt-assist-canvas-attached';
const CANVAS_OPEN_KEY = 'yt-assist-canvas-open';
const CANVAS_WIDTH_KEY = 'yt-assist-canvas-width';
const CANVAS_MODE_KEY = 'yt-assist-canvas-mode';
const CANVAS_DRAWING_DATA_KEY = 'yt-assist-canvas-drawing-data';
const CANVAS_DRAWING_SNAPSHOT_KEY = 'yt-assist-canvas-drawing-snapshot';
const CANVAS_DRAWING_HISTORY_KEY = 'yt-assist-canvas-drawing-history';
const MAX_HISTORY_ITEMS = 20;

interface CanvasStore extends CanvasState {
  isOpen: boolean;
  width: number;
  setContent: (content: string) => void;
  setIsAttached: (isAttached: boolean) => void;
  setIsOpen: (isOpen: boolean) => void;
  setWidth: (width: number) => void;
  setMode: (mode: 'notes' | 'draw') => void;
  setDrawingData: (data: DrawingData | null) => void;
  setDrawingSnapshot: (snapshot: string | null) => void;
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

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  mode: loadFromStorage(CANVAS_MODE_KEY, 'notes'),
  content: loadFromStorage(CANVAS_CONTENT_KEY, ''),
  isAttached: loadFromStorage(CANVAS_ATTACHED_KEY, false),
  history: loadFromStorage(CANVAS_HISTORY_KEY, []),
  drawingData: loadFromStorage(CANVAS_DRAWING_DATA_KEY, null),
  drawingSnapshot: loadFromStorage(CANVAS_DRAWING_SNAPSHOT_KEY, null),
  drawingHistory: loadFromStorage(CANVAS_DRAWING_HISTORY_KEY, []),
  isOpen: loadFromStorage(CANVAS_OPEN_KEY, false),
  width: loadFromStorage(CANVAS_WIDTH_KEY, 400),

  setContent: (content: string) => {
    set({ content });
    saveToStorage(CANVAS_CONTENT_KEY, content);
  },

  setIsAttached: (isAttached: boolean) => {
    set({ isAttached });
    saveToStorage(CANVAS_ATTACHED_KEY, isAttached);
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
    saveToStorage(CANVAS_MODE_KEY, mode);
  },

  setDrawingData: (data: DrawingData | null) => {
    set({ drawingData: data });
    saveToStorage(CANVAS_DRAWING_DATA_KEY, data);
  },

  setDrawingSnapshot: (snapshot: string | null) => {
    set({ drawingSnapshot: snapshot });
    saveToStorage(CANVAS_DRAWING_SNAPSHOT_KEY, snapshot);
  },

  captureDrawingForAI: async () => {
    // This will be called from the DrawingCanvas component
    // which has access to the Excalidraw API
  },

  saveSnapshot: () => {
    const { content, history } = get();

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
    saveToStorage(CANVAS_HISTORY_KEY, newHistory);
  },

  restoreFromHistory: (id: string) => {
    const { history } = get();
    const item = history.find((h) => h.id === id);
    if (item) {
      get().setContent(item.content);
    }
  },

  deleteHistoryItem: (id: string) => {
    const { history } = get();
    const newHistory = history.filter((h) => h.id !== id);
    set({ history: newHistory });
    saveToStorage(CANVAS_HISTORY_KEY, newHistory);
  },

  clearHistory: () => {
    set({ history: [] });
    saveToStorage(CANVAS_HISTORY_KEY, []);
  },

  saveDrawingSnapshot: () => {
    const { drawingData, drawingSnapshot, drawingHistory } = get();

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
    saveToStorage(CANVAS_DRAWING_HISTORY_KEY, newHistory);
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
    const { drawingHistory } = get();
    const newHistory = drawingHistory.filter((h) => h.id !== id);
    set({ drawingHistory: newHistory });
    saveToStorage(CANVAS_DRAWING_HISTORY_KEY, newHistory);
  },

  clearDrawingHistory: () => {
    set({ drawingHistory: [] });
    saveToStorage(CANVAS_DRAWING_HISTORY_KEY, []);
  },
}));
