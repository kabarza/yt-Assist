import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Tldraw, useEditor, loadSnapshot, getSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import { useCanvasStore } from '../stores/canvasStore';
import type { DrawingCanvasRef } from '../types/canvas';

// Inner component to access editor via hook
function DrawingCanvasInner({ onEditorReady }: { onEditorReady: (editor: any) => void }) {
  const editor = useEditor();

  useEffect(() => {
    if (editor) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return null;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef>((_props, ref) => {
  const { drawingData, setDrawingData } = useCanvasStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  // Expose the captureImage method via ref
  useImperativeHandle(ref, () => ({
    captureImage: async () => {
      if (!editorRef.current) {
        console.error('No editor instance available for capture');
        return null;
      }

      try {
        console.log('Capturing drawing using tldraw native export...');

        // Get all shape IDs from the current page
        const shapeIds = editorRef.current.getCurrentPageShapeIds();

        if (shapeIds.size === 0) {
          console.warn('No shapes on canvas to capture');
          return null;
        }

        // Use tldraw's built-in toImage method
        const { blob } = await editorRef.current.toImage([...shapeIds], {
          format: 'png',
          background: true,
          scale: 2, // Higher quality
        });

        if (!blob) {
          console.error('Failed to generate image blob');
          return null;
        }

        // Convert blob to data URL
        return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            console.log('Drawing captured successfully using native export');
            resolve(dataUrl);
          };
          reader.onerror = () => {
            console.error('Failed to read blob as data URL');
            resolve(null);
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Failed to capture drawing:', error);
        return null;
      }
    },
  }));

  const handleMount = useCallback((editor: any) => {
    // Store the editor reference for capture
    editorRef.current = editor;

    // Restore saved data if it exists
    if (drawingData) {
      try {
        // Load snapshot using the correct tldraw v4 API
        loadSnapshot(editor.store, drawingData);
      } catch (e) {
        console.warn('Could not restore drawing data:', e);
      }
    }

    // Set default tool to pen (draw)
    editor.setCurrentTool('draw');

    // Subscribe to changes using the history listener
    const unsubscribe = editor.store.listen(() => {
      // Save the store snapshot whenever there's a change
      try {
        const snapshot = getSnapshot(editor.store);
        setDrawingData(snapshot);
      } catch (e) {
        console.error('Failed to get snapshot:', e);
      }
    });

    // Return cleanup function
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [drawingData, setDrawingData]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <Tldraw
        onMount={handleMount}
        inferDarkMode
      >
        <DrawingCanvasInner onEditorReady={() => {}} />
      </Tldraw>
    </div>
  );
});

