import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { MermaidExtension } from '../extensions/MermaidExtension';
import { useCanvasStore } from '../stores/canvasStore';
import { useChatStore } from '../stores/chatStore';
import { DrawingCanvas } from './DrawingCanvas';
import ConfirmDialog from '../components/ConfirmDialog';
import AISuggestionsPanel from './AISuggestionsPanel';
import type { DrawingCanvasRef } from '../types/canvas';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, X, Settings, Clock, Download, FileText, GitBranch, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { CANVAS_TEMPLATES } from '../types/canvasTemplates';

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
  const { activeChat } = useChatStore();
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDrawingClearConfirm, setShowDrawingClearConfirm] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
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
      MermaidExtension,
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
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none h-full p-5 text-sm prose-headings:my-4 prose-li:my-0 prose-ol:my-3 prose-p:my-2 prose-pre:my-4 prose-table:my-4 prose-ul:my-3',
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

  // Export notes as PNG using html2canvas
  const handleExportNotes = async () => {
    if (!editor) return;

    try {
      // Get the TipTap editor element
      const editorElement = document.querySelector('.ProseMirror') as HTMLElement;
      if (!editorElement) {
        console.error('Editor element not found');
        return;
      }

      // Capture the editor content
      const canvas = await html2canvas(editorElement, {
        backgroundColor: 'var(--background)', // Theme-aware background
        scale: 2, // Higher quality
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.download = `canvas-notes-${date}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to export notes:', error);
    }
  };

  // Export drawing as PNG using tldraw's built-in method
  const handleExportDrawing = async () => {
    if (!drawingCanvasRef.current) return;

    try {
      const dataUrl = await drawingCanvasRef.current.captureImage();
      if (!dataUrl) {
        console.error('Failed to capture drawing');
        return;
      }

      // Convert data URL to blob and download
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `canvas-drawing-${date}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export drawing:', error);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    // If there's existing content and it's not blank template, show confirmation
    if (content.trim() && templateId !== 'blank') {
      setSelectedTemplate(templateId);
      setShowTemplateConfirm(true);
      setShowTemplates(false);
    } else {
      applyTemplate(templateId);
      setShowTemplates(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = CANVAS_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setContent(template.content);
      if (editor) {
        editor.commands.setContent(template.content);
      }
    }
  };

  // Add AI suggestion to canvas
  const handleAddSuggestion = (suggestionText: string) => {
    if (!editor) return;

    // Get current content and append suggestion
    const currentContent = content;
    const newContent = currentContent + suggestionText;

    setContent(newContent);
    editor.commands.setContent(newContent);

    // Scroll to bottom to show new content
    setTimeout(() => {
      const editorElement = document.querySelector('.ProseMirror') as HTMLElement;
      if (editorElement) {
        editorElement.scrollTop = editorElement.scrollHeight;
      }
    }, 100);
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
      className="relative flex h-full flex-col border-l border-border bg-background"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize canvas panel"
        tabIndex={0}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent transition-colors duration-200 focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          isResizing ? 'bg-accent' : 'bg-transparent'
        }`}
        onMouseDown={handleResizeStart}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 10
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onWidthChange(Math.min(600, width + step))
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            onWidthChange(Math.max(300, width - step))
          }
        }}
      />

      {/* Header — single consolidated bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
        {/* Left: close arrow + mode pills */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
            aria-label="Close canvas panel"
            title="Close canvas panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="inline-flex h-10 items-center rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => handleModeChange('notes')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                mode === 'notes'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Notes
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('draw')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                mode === 'draw'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Draw
            </button>
          </div>
        </div>

        {/* Right: templates + AI brainstorming + export + settings + history icons */}
        <div className="flex items-center gap-1">
          {/* Templates (Notes mode only) */}
          {mode === 'notes' && (
            <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
                  aria-label="Canvas templates"
                  title="Canvas templates"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="p-2">
                  <span className="text-xs font-medium text-foreground">Templates</span>
                </div>
                <DropdownMenuSeparator />
                {CANVAS_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors duration-150"
                  >
                    <div className="text-sm font-medium text-foreground">{template.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{template.description}</div>
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* AI Brainstorming (Notes mode only) */}
          {mode === 'notes' && activeChat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAISuggestions(!showAISuggestions)}
              className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
              aria-label="AI Brainstorming"
              title="AI Brainstorming"
            >
              <Sparkles className={`h-4 w-4 ${showAISuggestions ? 'text-foreground' : ''}`} />
            </Button>
          )}

          {/* Mermaid Diagram (Notes mode only) */}
          {mode === 'notes' && editor && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                editor.chain().focus().setMermaid('graph TD\n  A[Start] --> B[Process]\n  B --> C[Decision]\n  C -->|Yes| D[Success]\n  C -->|No| E[Retry]\n  E --> B').run()
              }}
              className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
              aria-label="Insert Mermaid diagram"
              title="Insert Mermaid diagram"
            >
              <GitBranch className="h-4 w-4" />
            </Button>
          )}

          {/* Export Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={mode === 'notes' ? handleExportNotes : handleExportDrawing}
            disabled={mode === 'notes' ? !content.trim() : false}
            className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
            aria-label={`Export ${mode} as PNG`}
            title={`Export ${mode} as PNG`}
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Canvas Settings */}
          <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
                aria-label="Canvas settings"
                title="Canvas settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="p-3">
                <Label htmlFor="canvas-type" className="text-xs text-muted-foreground">
                  Canvas Type
                </Label>
                <select
                  id="canvas-type"
                  value={canvasType}
                  onChange={(e) => setCanvasType(e.target.value as any)}
                  className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="notes">Notes - Personal thoughts</option>
                  <option value="instructions">Instructions - Directives to follow</option>
                  <option value="draft">Draft - Document in progress</option>
                  <option value="reference">Reference - Background material</option>
                </select>
              </div>
              <DropdownMenuSeparator />
              <div className="p-3">
                <Label htmlFor="canvas-instructions" className="text-xs text-muted-foreground">
                  AI Instructions
                </Label>
                <Textarea
                  id="canvas-instructions"
                  value={canvasInstructions}
                  onChange={(e) => setCanvasInstructions(e.target.value)}
                  placeholder="Tell the AI how to use this canvas content..."
                  className="mt-1.5 min-h-[80px] text-sm"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Custom instructions for how the AI should interpret this canvas content.
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* History */}
          <div className="relative" ref={historyMenuRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistoryMenu(!showHistoryMenu)}
              disabled={mode === 'notes' ? history.length === 0 : drawingHistory.length === 0}
              className="size-8 rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]"
              aria-label="View history"
              title="View history"
            >
              <Clock className="h-4 w-4" />
            </Button>

            {showHistoryMenu && mode === 'notes' && history.length > 0 && (
              <ScrollArea className="absolute right-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-dropdown max-h-96">
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
                        aria-label="Delete this snapshot"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            )}

            {showHistoryMenu && mode === 'draw' && drawingHistory.length > 0 && (
              <ScrollArea className="absolute right-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-dropdown max-h-96">
                <div className="p-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Drawings</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDrawingClearConfirm(true)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    aria-label="Clear all drawing history"
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
                        aria-label="Delete this drawing"
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

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-card relative">
        {mode === 'notes' ? (
          <ScrollArea className="h-full">
            <EditorContent editor={editor} className="h-full" />
          </ScrollArea>
        ) : (
          <DrawingCanvas ref={drawingCanvasRef} />
        )}

        {/* AI Suggestions Panel (Notes mode only) */}
        {mode === 'notes' && showAISuggestions && activeChat && (
          <AISuggestionsPanel
            canvasContent={content}
            canvasType={canvasType}
            onAddSuggestion={handleAddSuggestion}
            onClose={() => setShowAISuggestions(false)}
            provider={activeChat.provider}
            model={activeChat.model}
          />
        )}
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Snapshots?"
        message="This will permanently delete all canvas history snapshots. This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          clearHistory();
          setShowHistoryMenu(false);
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showDrawingClearConfirm}
        title="Clear All Drawings?"
        message="This will permanently delete all drawing history. This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          clearDrawingHistory();
          setShowHistoryMenu(false);
          setShowDrawingClearConfirm(false);
        }}
        onCancel={() => setShowDrawingClearConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showTemplateConfirm}
        title="Replace Current Content?"
        message="This will replace your current canvas content with the selected template. Your current content will be lost unless you've saved it."
        confirmLabel="Apply Template"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          if (selectedTemplate) {
            applyTemplate(selectedTemplate);
          }
          setShowTemplateConfirm(false);
          setSelectedTemplate(null);
        }}
        onCancel={() => {
          setShowTemplateConfirm(false);
          setSelectedTemplate(null);
        }}
      />
    </div>
  );
};
