// Using 'any' types to avoid complex tldraw type imports
// These will be properly typed at runtime by tldraw itself

export type CanvasMode = 'notes' | 'draw';
export type CanvasType = 'notes' | 'instructions' | 'draft' | 'reference';

export interface DrawingCanvasRef {
  captureImage: () => Promise<string | null>;
}

export interface DrawingData {
  document: any;  // TLStoreSnapshot format from tldraw
  session?: any;
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

export interface CanvasChatState {
  mode: CanvasMode;
  content: string;
  history: CanvasHistoryItem[];
  drawingData: DrawingData | null;
  drawingSnapshot: string | null;
  drawingHistory: DrawingHistoryItem[];
  canvasType: CanvasType;
  canvasInstructions: string;
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
  canvasType: CanvasType;
  canvasInstructions: string;
}
