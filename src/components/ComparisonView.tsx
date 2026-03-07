import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, Check, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Provider } from '../types/chat'
import { MODELS } from '../types/chat'

export interface ComparisonResponse {
  provider: Provider
  model: string
  response: string
  isStreaming: boolean
  error?: string
}

interface ComparisonViewProps {
  responses: ComparisonResponse[]
  onPromote?: (provider: Provider, model: string, response: string) => void
  onClose?: () => void
}

function ModelBadge({ provider, model }: { provider: Provider; model: string }) {
  const modelInfo = MODELS[provider].find(m => m.id === model)
  const providerColor = provider === 'anthropic' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${providerColor}`}>
        {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
      </span>
      <span className="text-sm font-medium text-foreground">
        {modelInfo?.name || model}
      </span>
    </div>
  )
}

function ResponsePanel({ response, onPromote }: {
  response: ComparisonResponse
  onPromote?: (provider: Provider, model: string, text: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(response.response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePromote = () => {
    onPromote?.(response.provider, response.model, response.response)
  }

  return (
    <Card className="flex min-w-0 flex-1 flex-col overflow-hidden border-border/70 bg-card/90">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3">
        <ModelBadge provider={response.provider} model={response.model} />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2.5"
            title="Copy response"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {onPromote && response.response && !response.isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePromote}
              className="h-8 gap-1.5 px-2.5"
              title="Use this response"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Use
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {response.error ? (
          <div className="text-sm text-red-500">
            Error: {response.error}
          </div>
        ) : response.response ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none text-pretty text-sm text-foreground prose-headings:my-4 prose-li:my-0 prose-ol:my-3 prose-p:my-2 prose-pre:my-4 prose-table:my-4 prose-ul:my-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response.response}
            </ReactMarkdown>
          </div>
        ) : response.isStreaming ? (
          <div className="text-sm text-muted-foreground animate-pulse">
            Generating response...
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No response yet
          </div>
        )}
      </div>
    </Card>
  )
}

export default function ComparisonView({ responses, onPromote, onClose }: ComparisonViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Model Comparison</h2>
          <p className="text-xs text-muted-foreground">
            Comparing {responses.length} model{responses.length !== 1 ? 's' : ''}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Response panels in columns */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto">
          <div className="flex h-full min-w-max gap-4 p-5">
            {responses.map((response, index) => (
              <div key={index} className="w-[500px] h-full">
                <ResponsePanel response={response} onPromote={onPromote} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
