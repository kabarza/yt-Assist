// Using 'any' types temporarily to avoid complex Excalidraw type imports
// These will be properly typed at runtime by Excalidraw itself

export type CanvasMode = 'notes' | 'draw';

export interface DrawingData {
  elements: readonly any[];
  appState: any;
}

export interface CanvasHistoryItem {
  id: string;
  content: string;
  timestamp: number;
  preview: string;
}

export interface DrawingHistoryItem {
  id: string;
  data: DrawingData;
  snapshot: string;
  timestamp: number;
  preview: string;
}

export interface CanvasState {
  mode: CanvasMode;
  content: string;
  isAttached: boolean;
  history: CanvasHistoryItem[];
  drawingData: DrawingData | null;
  drawingSnapshot: string | null;
  drawingHistory: DrawingHistoryItem[];
  isOpen: boolean;
  width: number;
}
