import type { Message } from '../types/chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCanvasStore } from '../stores/canvasStore'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Globe } from 'lucide-react'

// Parse canvas-update blocks from text
function parseCanvasUpdates(text: string): { beforeText: string; canvasUpdate: string | null; afterText: string } {
  const canvasUpdateRegex = /<canvas-update>([\s\S]*?)<\/canvas-update>/;
  const match = text.match(canvasUpdateRegex);

  if (match) {
    return {
      beforeText: text.substring(0, match.index),
      canvasUpdate: match[1].trim(),
      afterText: text.substring((match.index || 0) + match[0].length),
    };
  }

  return { beforeText: text, canvasUpdate: null, afterText: '' };
}

// Code block with copy button
function CodeBlock({ children, ...props }: any) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node?.props?.children) return extractText(node.props.children);
      return '';
    };

    navigator.clipboard.writeText(extractText(children));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre {...props}>{children}</pre>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const { setContent } = useCanvasStore()
  const [appliedUpdates, setAppliedUpdates] = useState<Set<number>>(new Set())

  // ── User message: right-aligned content-width bubble ──────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] space-y-2">
          {message.content.map((part, i) => {
            if (part.type === 'image' && part.imageData) {
              return (
                <div key={i} className="flex justify-end">
                  <img
                    src={part.imageData}
                    alt="User uploaded image"
                    className="max-w-xs max-h-48 rounded-lg border border-border"
                  />
                </div>
              )
            }
            if (part.type === 'text' && part.text) {
              return (
                <div
                  key={i}
                  className="inline-block px-4 py-2.5 rounded-2xl bg-muted text-foreground text-sm"
                >
                  {part.text}
                </div>
              )
            }
            return null
          })}
        </div>
      </div>
    )
  }

  // ── Assistant message: left-aligned, no bubble ────────────────────────────
  return (
    <div className="space-y-3">
      {message.content.map((part, i) => {
        if (part.type === 'image' && part.imageData) {
          return (
            <img
              key={i}
              src={part.imageData}
              alt="Assistant generated image"
              className="max-w-md max-h-64 rounded-lg border border-border"
            />
          )
        }
        if (part.type === 'text' && part.text) {
          const { beforeText, canvasUpdate, afterText } = parseCanvasUpdates(part.text);

          return (
            <div key={i} className="space-y-3">
              {beforeText && (
                <div className="text-foreground text-pretty prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-table:my-2 prose-pre:my-2 text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                    {beforeText}
                  </ReactMarkdown>
                </div>
              )}

              {canvasUpdate && (
                <Card className="border-accent bg-accent/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Canvas Update</span>
                    <Button
                      variant={appliedUpdates.has(i) ? "secondary" : "default"}
                      size="sm"
                      onClick={() => {
                        setContent(canvasUpdate);
                        setAppliedUpdates(prev => new Set(prev).add(i));
                        setTimeout(() => {
                          setAppliedUpdates(prev => {
                            const next = new Set(prev);
                            next.delete(i);
                            return next;
                          });
                        }, 2000);
                      }}
                      aria-label="Apply canvas update to editor"
                    >
                      {appliedUpdates.has(i) ? 'Applied!' : 'Apply to Canvas'}
                    </Button>
                  </div>
                  <Card className="bg-muted/50 p-3">
                    <div className="text-foreground prose prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {canvasUpdate}
                      </ReactMarkdown>
                    </div>
                  </Card>
                </Card>
              )}

              {afterText && (
                <div className="text-foreground text-pretty prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-table:my-2 prose-pre:my-2 text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                    {afterText}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )
        }
        return null
      })}

      {/* Citations */}
      {message.citations?.length ? (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Sources</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {message.citations.map((citation, i) => (
              <a
                key={i}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-foreground/70 font-mono">[{i + 1}]</span>
                <span className="truncate max-w-[160px]">{citation.title}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
