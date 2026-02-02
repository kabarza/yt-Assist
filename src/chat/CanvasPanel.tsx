import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useCanvasStore } from '../stores/canvasStore';
import { DrawingCanvas } from './DrawingCanvas';
import ConfirmDialog from '../components/ConfirmDialog';
import type { DrawingCanvasRef } from '../types/canvas';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, X, Settings } from 'lucide-react';

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
    restoreDrawingFromHistory,
    deleteDrawingHistoryItem,
    clearDrawingHistory,
    setDrawingSnapshot,
    canvasType,
    canvasInstructions,
    setCanvasType,
    setCanvasInstructions,
  } = useCanvasStore();
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromStore = useRef(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);

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

  // Auto-capture drawing snapshot when in draw mode (debounced)
  useEffect(() => {
    if (mode !== 'draw' || !drawingCanvasRef.current) return;

    const captureTimer = setInterval(async () => {
      if (drawingCanvasRef.current) {
        const snapshot = await drawingCanvasRef.current.captureImage();
        if (snapshot) {
          setDrawingSnapshot(snapshot);
        }
      }
    }, 2000); // Capture every 2 seconds while drawing

    return () => clearInterval(captureTimer);
  }, [mode, setDrawingSnapshot]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  // Capture drawing snapshot when switching away from draw mode
  const handleModeChange = async (newMode: 'notes' | 'draw') => {
    // If switching away from draw mode, capture the current drawing
    if (mode === 'draw' && newMode === 'notes' && drawingCanvasRef.current) {
      const snapshot = await drawingCanvasRef.current.captureImage();
      if (snapshot) {
        setDrawingSnapshot(snapshot);
      }
    }
    setMode(newMode);
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
      className="h-full bg-muted border-l border-border flex flex-col relative shadow-2xl"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent transition-colors duration-200 ${
          isResizing ? 'bg-accent' : 'bg-transparent'
        }`}
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground text-balance">Canvas</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 -ml-1"
            aria-label="Close canvas panel"
            title="Close canvas panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Canvas Settings */}
          <Popover open={showSettings} onOpenChange={setShowSettings}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Canvas settings"
                title="Canvas settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Canvas Settings</h3>
                  <p className="text-xs text-muted-foreground">Configure how the AI should interpret your canvas content</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="canvas-type" className="text-sm font-medium">
                    Canvas Type
                  </Label>
                  <select
                    id="canvas-type"
                    value={canvasType}
                    onChange={(e) => setCanvasType(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="notes">Notes - Personal thoughts and observations</option>
                    <option value="instructions">Instructions - Directives to follow</option>
                    <option value="draft">Draft - Document in progress</option>
                    <option value="reference">Reference - Background material</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="canvas-instructions" className="text-sm font-medium">
                    AI Instructions
                  </Label>
                  <Textarea
                    id="canvas-instructions"
                    value={canvasInstructions}
                    onChange={(e) => setCanvasInstructions(e.target.value)}
                    placeholder="Tell the AI how to use this canvas content..."
                    className="min-h-[100px] text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide custom instructions for how the AI should interpret and use this canvas content.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative" ref={historyMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistoryMenu(!showHistoryMenu)}
              disabled={mode === 'notes' ? history.length === 0 : drawingHistory.length === 0}
              className="h-7 text-xs"
              title="View history"
            >
              History ({mode === 'notes' ? history.length : drawingHistory.length})
            </Button>

            {showHistoryMenu && mode === 'notes' && history.length > 0 && (
              <ScrollArea className="absolute left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-dropdown max-h-96">
                <div className="p-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Snapshots</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearConfirm(true)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    aria-label="Clear all history"
                  >
                    Clear all
                  </Button>
                </div>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 border-b border-border last:border-b-0 hover:bg-accent transition-colors duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          restoreFromHistory(item.id);
                          setShowHistoryMenu(false);
                        }}
                        className="flex-1 text-left h-auto p-0 justify-start"
                      >
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatTimestamp(item.timestamp)}
                          </div>
                          <div className="text-sm text-foreground truncate">
                            {item.preview || '(empty)'}
                          </div>
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteHistoryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            )}

            {showHistoryMenu && mode === 'draw' && drawingHistory.length > 0 && (
              <ScrollArea className="absolute left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-dropdown max-h-96">
                <div className="p-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Drawings</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Clear all drawing history?')) {
                        clearDrawingHistory();
                        setShowHistoryMenu(false);
                      }
                    }}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Clear all
                  </Button>
                </div>
                {drawingHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 border-b border-border last:border-b-0 hover:bg-accent transition-colors duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          restoreDrawingFromHistory(item.id);
                          setShowHistoryMenu(false);
                        }}
                        className="flex-1 text-left h-auto p-0 justify-start"
                      >
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatTimestamp(item.timestamp)}
                          </div>
                          <div className="text-sm text-foreground truncate">
                            {item.preview}
                          </div>
                          {item.snapshot && (
                            <img
                              src={item.snapshot}
                              alt="Drawing preview"
                              className="mt-1 w-full h-16 object-cover rounded border border-border"
                            />
                          )}
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDrawingHistoryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(value) => handleModeChange(value as 'notes' | 'draw')} className="border-b border-border">
        <TabsList className="flex-1 h-auto rounded-none bg-transparent p-0 w-full">
          <TabsTrigger value="notes" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
            Notes
          </TabsTrigger>
          <TabsTrigger value="draw" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
            Draw
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Editor Toolbar */}
      {mode === 'notes' && editor && (
        <div className="px-3 py-1.5 border-b border-border flex items-center gap-0.5 flex-wrap bg-muted/30">
          <Button
            variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-7 px-2 text-xs"
            title="Bold (Cmd+B)"
          >
            <strong>B</strong>
          </Button>
          <Button
            variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-7 px-2 text-xs"
            title="Italic (Cmd+I)"
          >
            <em>I</em>
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button
            variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="h-7 px-2 text-xs"
            title="Heading 1"
          >
            H1
          </Button>
          <Button
            variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="h-7 px-2 text-xs"
            title="Heading 2"
          >
            H2
          </Button>
          <Button
            variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className="h-7 px-2 text-xs"
            title="Heading 3"
          >
            H3
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button
            variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="h-7 px-2 text-xs"
            title="Bullet List"
          >
            • List
          </Button>
          <Button
            variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="h-7 px-2 text-xs"
            title="Numbered List"
          >
            1. List
          </Button>
          <Button
            variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className="h-7 px-2 text-xs"
            title="Code Block"
          >
            {'</>'}
          </Button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-card">
        {mode === 'notes' ? (
          <ScrollArea className="h-full">
            <EditorContent editor={editor} className="h-full" />
          </ScrollArea>
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
