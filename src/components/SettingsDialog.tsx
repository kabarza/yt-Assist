import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useTheme, type Theme } from '../contexts/ThemeContext'
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
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, updateSettings, resetSettings } = useSettingsStore()
  const { theme, setTheme } = useTheme()

  // Local state for form inputs
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '')
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicApiKey || '')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [defaultProvider, setDefaultProvider] = useState<Provider>(settings.defaultProvider)
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel)

  // Sync local state with store when dialog opens
  useEffect(() => {
    if (isOpen) {
      setOpenaiKey(settings.openaiApiKey || '')
      setAnthropicKey(settings.anthropicApiKey || '')
      setDefaultProvider(settings.defaultProvider)
      setDefaultModel(settings.defaultModel)
    }
  }, [isOpen, settings])

  // Update model when provider changes
  useEffect(() => {
    if (defaultProvider) {
      setDefaultModel(MODELS[defaultProvider][0].id)
    }
  }, [defaultProvider])

  const handleSave = () => {
    updateSettings({
      openaiApiKey: openaiKey || undefined,
      anthropicApiKey: anthropicKey || undefined,
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
    { keys: formatShortcut('mod+b'), description: 'Toggle sidebar' },
    { keys: formatShortcut('mod+k'), description: 'Focus search' },
    { keys: formatShortcut('/'), description: 'Focus input' },
    { keys: formatShortcut('mod+1'), description: 'Switch to Packaging' },
    { keys: formatShortcut('mod+2'), description: 'Switch to Chat' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your app preferences and configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="api-keys" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai-key"
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
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
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored locally and only forwarded when this app makes an Anthropic request.
              </p>
            </div>
          </TabsContent>

          {/* Defaults Tab */}
          <TabsContent value="defaults" className="space-y-4 pt-4">
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
          <TabsContent value="theme" className="space-y-4 pt-4">
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
          <TabsContent value="shortcuts" className="space-y-4 pt-4">
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
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <APISettings />
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  )
}
