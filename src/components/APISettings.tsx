import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAPIConfigStore } from '../stores/apiConfigStore'
import type { Provider } from '../types/chat'
import { requestChatText } from '../utils/apiClient'
import { CheckCircle2, XCircle, Loader2, Server } from 'lucide-react'
import { toast } from 'sonner'

interface ProviderConfig {
  id: 'openai' | 'anthropic' | 'azure' | 'custom'
  name: string
  description: string
  defaultUrl: string
  requiresApiKey?: boolean
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Custom OpenAI API endpoint',
    defaultUrl: 'https://api.openai.com/v1',
    requiresApiKey: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Custom Anthropic API endpoint',
    defaultUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: false,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'Azure OpenAI Service endpoint',
    defaultUrl: 'https://YOUR_RESOURCE.openai.azure.com',
    requiresApiKey: true,
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Local models (LM Studio, Ollama) or custom servers',
    defaultUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
  },
]

function EndpointConfigSection({ provider }: { provider: ProviderConfig }) {
  const { openai, anthropic, azure, custom, setConfig, resetConfig } = useAPIConfigStore()
  const config = provider.id === 'openai' ? openai :
                 provider.id === 'anthropic' ? anthropic :
                 provider.id === 'azure' ? azure : custom

  const [baseUrl, setBaseUrl] = useState(config.baseUrl || provider.defaultUrl)
  const [apiKey, setApiKey] = useState(config.apiKey || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleSave = () => {
    setConfig(provider.id, {
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim() || undefined,
      enabled: true,
    })
    toast.success(`${provider.name} endpoint configured`)
  }

  const handleReset = () => {
    resetConfig(provider.id)
    setBaseUrl(provider.defaultUrl)
    setApiKey('')
    setTestResult(null)
    toast.success(`${provider.name} endpoint reset to default`)
  }

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      toast.error('Please enter a base URL')
      return
    }

    if (provider.id === 'azure') {
      toast.error('Azure validation is not implemented yet')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const targetProvider: Provider =
        provider.id === 'anthropic'
          ? 'anthropic'
          : provider.id === 'custom'
          ? custom.provider
          : 'openai'

      await requestChatText({
        provider: targetProvider,
        model: targetProvider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4.1-nano',
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: 'Reply with OK.' }],
        }],
        endpointOverride: {
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim() || undefined,
        },
        signal: AbortSignal.timeout(5000),
      })

      setTestResult('success')
      toast.success('Connection successful')
    } catch (error) {
      setTestResult('error')
      toast.error('Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Server className="h-4 w-4" />
            {provider.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${provider.id}-enabled`} className="text-xs text-muted-foreground">
            Enabled
          </Label>
          <Switch
            id={`${provider.id}-enabled`}
            checked={config.enabled}
            onCheckedChange={(enabled) => setConfig(provider.id, { enabled })}
          />
        </div>
      </div>

      {config.enabled && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`${provider.id}-url`} className="text-xs text-muted-foreground">
              Base URL
            </Label>
            <Input
              id={`${provider.id}-url`}
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider.defaultUrl}
              className="mt-1.5"
            />
          </div>

          {provider.requiresApiKey && (
            <div>
              <Label htmlFor={`${provider.id}-key`} className="text-xs text-muted-foreground">
                API Key (optional override)
              </Label>
              <Input
                id={`${provider.id}-key`}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave empty to use default"
                className="mt-1.5"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing || !baseUrl.trim()}
              className="gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            {testResult === 'success' && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </div>
            )}

            {testResult === 'error' && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                Failed
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!baseUrl.trim()}
            >
              Save Configuration
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
            >
              Reset to Default
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function APISettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">API Endpoints</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure custom API endpoints for local models or enterprise deployments
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => (
          <EndpointConfigSection key={provider.id} provider={provider} />
        ))}
      </div>

      <div className="p-4 border border-border rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Note:</strong> Custom endpoints must be OpenAI-compatible.
          Popular options include LM Studio, Ollama (with OpenAI compatibility), and Azure OpenAI.
          Saved keys stay local to this app and are only forwarded when this client makes an AI request.
        </p>
      </div>
    </div>
  )
}
