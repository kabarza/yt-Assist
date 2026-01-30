import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { exportToBlob } from '@excalidraw/excalidraw';
import { useCanvasStore } from '../stores/canvasStore';

export const DrawingCanvas = forwardRef((_props, ref) => {
  const { drawingData, setDrawingData } = useCanvasStore();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isInitialLoadRef = useRef(true);

  useImperativeHandle(ref, () => excalidrawAPI);

  useEffect(() => {
    if (!excalidrawAPI) return;

    // Restore drawing data on mount
    if (isInitialLoadRef.current && drawingData) {
      excalidrawAPI.updateScene({
        elements: drawingData.elements as any,
        appState: drawingData.appState,
      });
      isInitialLoadRef.current = false;
    }
  }, [excalidrawAPI, drawingData]);

  const handleChange = (elements: readonly any[], state: any) => {
    const newData = {
      elements,
      appState: {
        viewBackgroundColor: state.viewBackgroundColor,
        currentItemStrokeColor: state.currentItemStrokeColor,
        currentItemBackgroundColor: state.currentItemBackgroundColor,
        currentItemFillStyle: state.currentItemFillStyle,
        currentItemStrokeWidth: state.currentItemStrokeWidth,
        currentItemRoughness: state.currentItemRoughness,
        currentItemOpacity: state.currentItemOpacity,
        currentItemFontFamily: state.currentItemFontFamily,
        currentItemFontSize: state.currentItemFontSize,
        currentItemTextAlign: state.currentItemTextAlign,
        currentItemStrokeStyle: state.currentItemStrokeStyle,
        currentItemRoundness: state.currentItemRoundness,
      },
    };
    setDrawingData(newData);
  };

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        theme="dark"
        initialData={{
          elements: drawingData?.elements || [],
          appState: {
            ...drawingData?.appState,
            viewBackgroundColor: '#1a1a1a',
          },
        }}
      />
    </div>
  );
});

export const captureDrawingForAI = async (
  excalidrawAPI: any
): Promise<string | null> => {
  if (!excalidrawAPI) return null;

  try {
    const elements = excalidrawAPI.getSceneElements();

    const blob = await exportToBlob({
      elements,
      appState: {
        exportWithDarkMode: false,
        exportBackground: true,
      },
      files: excalidrawAPI.getFiles(),
      maxWidthOrHeight: 1024,
    });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to capture drawing:', error);
    return null;
  }
};
