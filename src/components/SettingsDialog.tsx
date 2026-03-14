import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useTheme, type Theme } from '../contexts/ThemeContext'
import { TOOL_REGISTRY } from '@/navigation/tools'
import { MODELS, type Provider } from '../types/chat'
import { formatShortcut } from '../utils/keyboard'
import APISettings from './APISettings'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  triggerOrigin?: {
    left: number
    top: number
    width: number
    height: number
  } | null
}

export default function SettingsDialog({ isOpen, onClose, triggerOrigin = null }: SettingsDialogProps) {
  const { settings, updateSettings, resetSettings } = useSettingsStore()
  const { theme, setTheme } = useTheme()
  const dialogContentRef = useRef<HTMLDivElement | null>(null)

  // Local state for form inputs
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '')
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicApiKey || '')
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '')
  const [supadataKey, setSupadataKey] = useState(settings.supadataApiKey || '')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showSupadataKey, setShowSupadataKey] = useState(false)
  const [defaultProvider, setDefaultProvider] = useState<Provider>(settings.defaultProvider)
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel)

  // Sync local state with store when dialog opens
  useEffect(() => {
    if (isOpen) {
      setOpenaiKey(settings.openaiApiKey || '')
      setAnthropicKey(settings.anthropicApiKey || '')
      setGeminiKey(settings.geminiApiKey || '')
      setSupadataKey(settings.supadataApiKey || '')
      setDefaultProvider(settings.defaultProvider)
      setDefaultModel(settings.defaultModel)
    }
  }, [isOpen, settings])

  // Update model when provider changes
  useEffect(() => {
    if (defaultProvider && !MODELS[defaultProvider].some((model) => model.id === defaultModel)) {
      setDefaultModel(MODELS[defaultProvider][0].id)
    }
  }, [defaultModel, defaultProvider])

  useLayoutEffect(() => {
    const dialogNode = dialogContentRef.current
    if (!dialogNode || !isOpen) return

    if (!triggerOrigin) {
      dialogNode.style.removeProperty('transform-origin')
      return
    }

    const rect = dialogNode.getBoundingClientRect()
    const originX = triggerOrigin.left + (triggerOrigin.width / 2) - rect.left
    const originY = triggerOrigin.top + (triggerOrigin.height / 2) - rect.top

    dialogNode.style.transformOrigin = `${originX}px ${originY}px`
  }, [isOpen, triggerOrigin])

  const handleSave = () => {
    updateSettings({
      openaiApiKey: openaiKey || undefined,
      anthropicApiKey: anthropicKey || undefined,
      geminiApiKey: geminiKey || undefined,
      supadataApiKey: supadataKey || undefined,
      defaultProvider,
      defaultModel,
    })
    toast.success('Settings saved')
    onClose()
  }

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetSettings()
      setTheme('dark')
      toast.success('Settings reset to defaults')
      onClose()
    }
  }

  const keyboardShortcuts = [
    { keys: formatShortcut('mod+n'), description: 'New chat' },
    { keys: formatShortcut('mod+b'), description: 'Toggle context panel' },
    { keys: formatShortcut('mod+k'), description: 'Focus chat search' },
    { keys: formatShortcut('/'), description: 'Focus input' },
    ...TOOL_REGISTRY.map((tool) => ({
      keys: formatShortcut(tool.shortcut),
      description: `Switch to ${tool.label}`,
    })),
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={dialogContentRef}
        className="top-4 h-[min(48rem,calc(100dvh-2rem))] w-[calc(100vw-1.5rem)] max-w-[56rem] translate-y-0 gap-0 overflow-hidden p-0 origin-bottom-left sm:top-10 sm:h-[min(48rem,calc(100dvh-5rem))] sm:max-h-[calc(100dvh-5rem)]"
      >
        <Tabs defaultValue="api-keys" className="grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)_auto]">
          <DialogHeader className="px-6 pb-0 pt-6 pr-14">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your app preferences and configuration
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-0 pt-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="defaults">Defaults</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
          </div>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="mt-0 min-h-0 space-y-4 overflow-y-auto px-6 pb-6 pt-5">
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai-key"
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-9 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="size-9 rounded-lg"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored locally and only forwarded when this app makes an OpenAI request.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anthropic-key">Anthropic API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="anthropic-key"
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="h-9 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="size-9 rounded-lg"
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored locally and only forwarded when this app makes an Anthropic request.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="gemini-key"
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="h-9 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="size-9 rounded-lg"
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored locally and forwarded only for Gemini image generation requests.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supadata-key">Supadata API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="supadata-key"
                  type={showSupadataKey ? 'text' : 'password'}
                  value={supadataKey}
                  onChange={(e) => setSupadataKey(e.target.value)}
                  placeholder="sd-..."
                  className="h-9 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSupadataKey(!showSupadataKey)}
                  className="size-9 rounded-lg"
                >
                  {showSupadataKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored locally and forwarded only for transcript import requests.
              </p>
            </div>
          </TabsContent>

          {/* Defaults Tab */}
          <TabsContent value="defaults" className="mt-0 min-h-0 space-y-4 overflow-y-auto px-6 pb-6 pt-5">
            <div className="space-y-2">
              <Label htmlFor="default-provider">Default Provider</Label>
              <Select value={defaultProvider} onValueChange={(value) => setDefaultProvider(value as Provider)}>
                <SelectTrigger id="default-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Provider to use when creating new chats
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-model">Default Model</Label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger id="default-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS[defaultProvider].map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Model to use when creating new chats
              </p>
            </div>
          </TabsContent>

          {/* Theme Tab */}
          <TabsContent value="theme" className="mt-0 min-h-0 space-y-4 overflow-y-auto px-6 pb-6 pt-5">
            <div className="space-y-2">
              <Label htmlFor="theme-select">Appearance</Label>
              <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                <SelectTrigger id="theme-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color theme
              </p>
            </div>
          </TabsContent>

          {/* Keyboard Shortcuts Tab */}
          <TabsContent value="shortcuts" className="mt-0 min-h-0 space-y-4 overflow-y-auto px-6 pb-6 pt-5">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Global keyboard shortcuts for quick navigation
              </p>
              <div className="space-y-2">
                {keyboardShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md border border-border"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="mt-0 min-h-0 overflow-y-auto px-6 pb-6 pt-5">
            <APISettings />
          </TabsContent>

          {/* Footer Actions */}
          <div className="flex shrink-0 items-center justify-between border-t px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
