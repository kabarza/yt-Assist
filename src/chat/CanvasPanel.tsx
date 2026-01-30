import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useCanvasStore } from '../stores/canvasStore';
import { DrawingCanvas } from './DrawingCanvas';
import ConfirmDialog from '../components/ConfirmDialog';

interface CanvasPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({ width, onWidthChange, onClose }) => {
  const {
    mode,
    setMode,
    content,
    setContent,
    history,
    saveSnapshot,
    restoreFromHistory,
    deleteHistoryItem,
    clearHistory,
    drawingHistory,
    saveDrawingSnapshot,
    restoreDrawingFromHistory,
    deleteDrawingHistoryItem,
    clearDrawingHistory,
    setDrawingSnapshot,
  } = useCanvasStore();
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromStore = useRef(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });
  const drawingCanvasRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your notes here... Use this space to brainstorm ideas, draft content, or keep track of information while chatting.',
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      if (!isUpdatingFromStore.current) {
        // Get markdown content from the editor
        const markdown = (editor.storage as any).markdown.getMarkdown();
        setContent(markdown);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none h-full p-3',
      },
    },
  });

  // Update editor when content changes from outside (e.g., history restore)
  useEffect(() => {
    if (editor && !isUpdatingFromStore.current) {
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      if (content !== currentMarkdown) {
        isUpdatingFromStore.current = true;
        editor.commands.setContent(content);
        isUpdatingFromStore.current = false;
      }
    }
  }, [content, editor]);

  // Auto-save on idle (debounced)
  useEffect(() => {
    const contentDiff = Math.abs(content.length - lastContentRef.current.length);

    if (contentDiff >= 50) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        saveSnapshot();
        lastContentRef.current = content;
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, saveSnapshot]);

  // Close history menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyMenuRef.current && !historyMenuRef.current.contains(event.target as Node)) {
        setShowHistoryMenu(false);
      }
    };

    if (showHistoryMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showHistoryMenu]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      width: width,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartRef.current.x - e.clientX;
      const newWidth = Math.max(300, Math.min(600, resizeStartRef.current.width + deltaX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  return (
    <div
      className="h-full bg-gray-900 border-l border-gray-800 flex flex-col relative shadow-2xl transition-all duration-300 ease-out"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-lime-500/50 transition-colors ${
          isResizing ? 'bg-lime-500' : 'bg-transparent'
        }`}
        onMouseDown={handleResizeStart}
      />

      {/* Collapsed Toggle (on left edge) */}
      <button
        onClick={onClose}
        className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-gray-900 border border-gray-800 border-r-0 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-lime-400 hover:bg-gray-800 transition-all shadow-lg"
        title="Close canvas"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-100">Canvas</h2>
          <div className="relative" ref={historyMenuRef}>
            <button
              onClick={() => setShowHistoryMenu(!showHistoryMenu)}
              disabled={mode === 'notes' ? history.length === 0 : drawingHistory.length === 0}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="View history"
            >
              History ({mode === 'notes' ? history.length : drawingHistory.length})
            </button>

            {showHistoryMenu && mode === 'notes' && history.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Snapshots</span>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Clear all history"
                  >
                    Clear all
                  </button>
                </div>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => {
                          restoreFromHistory(item.id);
                          setShowHistoryMenu(false);
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {formatTimestamp(item.timestamp)}
                        </div>
                        <div className="text-sm text-gray-200 truncate">
                          {item.preview || '(empty)'}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteHistoryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showHistoryMenu && mode === 'draw' && drawingHistory.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Drawings</span>
                  <button
                    onClick={() => {
                      if (confirm('Clear all drawing history?')) {
                        clearDrawingHistory();
                        setShowHistoryMenu(false);
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                {drawingHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => {
                          restoreDrawingFromHistory(item.id);
                          setShowHistoryMenu(false);
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {formatTimestamp(item.timestamp)}
                        </div>
                        <div className="text-sm text-gray-200 truncate">
                          {item.preview}
                        </div>
                        {item.snapshot && (
                          <img
                            src={item.snapshot}
                            alt="Drawing preview"
                            className="mt-1 w-full h-16 object-cover rounded border border-gray-600"
                          />
                        )}
                      </button>
                      <button
                        onClick={() => deleteDrawingHistoryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-900">
        <button
          onClick={() => setMode('notes')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'notes'
              ? 'text-lime-400 border-b-2 border-lime-400 bg-gray-800'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => setMode('draw')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'draw'
              ? 'text-lime-400 border-b-2 border-lime-400 bg-gray-800'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          Draw
        </button>
      </div>

      {/* Capture Button for Draw Mode */}
      {mode === 'draw' && (
        <div className="px-3 py-2 border-b border-gray-800 bg-gray-900">
          <button
            onClick={async () => {
              const { captureDrawingForAI } = await import('./DrawingCanvas');
              const snapshot = await captureDrawingForAI(drawingCanvasRef.current);
              if (snapshot) {
                setDrawingSnapshot(snapshot);
                saveDrawingSnapshot();
              }
            }}
            className="w-full px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white text-sm font-medium rounded transition-colors"
          >
            Capture for AI
          </button>
        </div>
      )}

      {/* Editor Toolbar */}
      {mode === 'notes' && editor && (
        <div className="px-3 py-1.5 border-b border-gray-800 flex items-center gap-0.5 flex-wrap bg-gray-900">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('bold')
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Bold (Cmd+B)"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('italic')
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Italic (Cmd+I)"
          >
            <em>I</em>
          </button>
          <div className="w-px h-5 bg-gray-700 mx-0.5" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Heading 3"
          >
            H3
          </button>
          <div className="w-px h-5 bg-gray-700 mx-0.5" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Bullet List"
          >
            • List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('orderedList')
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Numbered List"
          >
            1. List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
              editor.isActive('codeBlock')
                ? 'bg-lime-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Code Block"
          >
            {'</>'}
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-gray-800">
        {mode === 'notes' ? (
          <div className="h-full overflow-y-auto">
            <EditorContent editor={editor} className="h-full" />
          </div>
        ) : (
          <DrawingCanvas ref={drawingCanvasRef} />
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All History?"
        message="This will permanently delete all canvas history snapshots. This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (mode === 'notes') {
            clearHistory();
          } else {
            clearDrawingHistory();
          }
          setShowHistoryMenu(false);
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
