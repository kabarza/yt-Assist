import type { Message } from '../types/chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCanvasStore } from '../stores/canvasStore'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Bot, Copy, Check } from 'lucide-react'

interface ChatMessageProps {
  message: Message
}

// Parse canvas-update blocks from text
function parseCanvasUpdates(text: string): { beforeText: string; canvasUpdate: string | null; afterText: string } {
  const canvasUpdateRegex = /<canvas-update>([\s\S]*?)<\/canvas-update>/;
  const match = text.match(canvasUpdateRegex);

  if (match) {
    const beforeText = text.substring(0, match.index);
    const canvasUpdate = match[1].trim();
    const afterText = text.substring((match.index || 0) + match[0].length);
    return { beforeText, canvasUpdate, afterText };
  }

  return { beforeText: text, canvasUpdate: null, afterText: '' };
}

// Custom code block component with copy button
function CodeBlock({ children, ...props }: any) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Extract text content from children
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node?.props?.children) return extractText(node.props.children);
      return '';
    };

    const text = extractText(children);
    navigator.clipboard.writeText(text);
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

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const { setContent } = useCanvasStore()
  const [appliedUpdates, setAppliedUpdates] = useState<Set<number>>(new Set())

  return (
    <div className={`flex gap-3 ${isUser ? '' : '-mx-4 px-4 py-4'}`}>
      {!isUser && <Card className="flex-1 p-0">
        <div className="flex gap-3 p-4">
          {/* Avatar */}
          <div className={`
            flex-shrink-0 size-8 rounded-full flex items-center justify-center
            ${isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}
          `}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">
              {isUser ? 'You' : 'Assistant'}
            </p>
            <div className="space-y-2">
              {message.content.map((part, i) => {
                if (part.type === 'image' && part.imageData) {
                  return (
                    <img
                      key={i}
                      src={part.imageData}
                      alt="User uploaded image"
                      className="max-w-md max-h-64 rounded-lg border border-border"
                    />
                  )
                }
                if (part.type === 'text' && part.text) {
                  const { beforeText, canvasUpdate, afterText } = parseCanvasUpdates(part.text);
                  const hasCanvasUpdate = canvasUpdate !== null;

                  return (
                    <div key={i} className="space-y-3">
                      {beforeText && (
                        <div className="text-foreground text-pretty prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-table:my-2 prose-pre:my-2 text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                            {beforeText}
                          </ReactMarkdown>
                        </div>
                      )}

                      {hasCanvasUpdate && canvasUpdate && (
                        <Card className="border-accent bg-accent/10 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground">Canvas Update</span>
                            <Button
                              variant={appliedUpdates.has(i) ? "secondary" : "default"}
                              size="sm"
                              onClick={() => {
                                setContent(canvasUpdate);
                                setAppliedUpdates(prev => new Set(prev).add(i));
                                // Visual feedback
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
            </div>
          </div>
        </div>
      </Card>}
      {isUser && <>
        {/* Avatar */}
        <div className={`
          flex-shrink-0 size-8 rounded-full flex items-center justify-center
          ${isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}
        `}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">
            {isUser ? 'You' : 'Assistant'}
          </p>
          <div className="space-y-2">
            {message.content.map((part, i) => {
              if (part.type === 'image' && part.imageData) {
                return (
                  <img
                    key={i}
                    src={part.imageData}
                    alt="User uploaded image"
                    className="max-w-md max-h-64 rounded-lg border border-border"
                  />
                )
              }
              if (part.type === 'text' && part.text) {
                return (
                  <div key={i} className="text-foreground text-pretty prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-table:my-2 prose-pre:my-2 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                      {part.text}
                    </ReactMarkdown>
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>
      </>}
    </div>
  )
}
