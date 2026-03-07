import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Copy, Check, Upload, Download, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { TemplatePreset } from '../../types/template'

interface TemplateShareDialogProps {
  isOpen: boolean
  onClose: () => void
  currentPreset: TemplatePreset | null
  onImport: (preset: TemplatePreset) => void
}

// Encode template to base64 for sharing
function encodeTemplate(preset: TemplatePreset): string {
  const json = JSON.stringify(preset)
  return btoa(encodeURIComponent(json))
}

// Decode template from base64
function decodeTemplate(code: string): TemplatePreset | null {
  try {
    const json = decodeURIComponent(atob(code))
    const preset = JSON.parse(json)

    // Validate structure
    if (!preset.id || !preset.name || !Array.isArray(preset.sections) || !Array.isArray(preset.outputTypes)) {
      return null
    }

    return preset
  } catch {
    return null
  }
}

// Generate shareable URL
function generateShareURL(code: string): string {
  const baseURL = window.location.origin + window.location.pathname
  return `${baseURL}?template=${code}`
}

export default function TemplateShareDialog({
  isOpen,
  onClose,
  currentPreset,
  onImport,
}: TemplateShareDialogProps) {
  const [importCode, setImportCode] = useState('')
  const [importName, setImportName] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedURL, setCopiedURL] = useState(false)

  const shareCode = currentPreset ? encodeTemplate(currentPreset) : ''
  const shareURL = shareCode ? generateShareURL(shareCode) : ''

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareCode)
    setCopiedCode(true)
    toast.success('Share code copied to clipboard')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyURL = () => {
    navigator.clipboard.writeText(shareURL)
    setCopiedURL(true)
    toast.success('Share URL copied to clipboard')
    setTimeout(() => setCopiedURL(false), 2000)
  }

  const handleImport = () => {
    if (!importCode.trim()) {
      toast.error('Please paste a template code')
      return
    }

    const preset = decodeTemplate(importCode.trim())

    if (!preset) {
      toast.error('Invalid template code')
      return
    }

    // Use custom name if provided
    if (importName.trim()) {
      preset.name = importName.trim()
    }

    // Generate new ID and timestamp
    preset.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    preset.createdAt = Date.now()

    onImport(preset)
    toast.success(`Template "${preset.name}" imported successfully`)
    setImportCode('')
    setImportName('')
    onClose()
  }

  const handleExportFile = () => {
    if (!currentPreset) return

    const dataStr = JSON.stringify(currentPreset, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentPreset.name.toLowerCase().replace(/\s+/g, '-')}-template.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Template exported as file')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Template</DialogTitle>
          <DialogDescription>
            Share your template with others or import templates shared with you
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            {currentPreset ? (
              <>
                <div className="space-y-2">
                  <Label>Share Code</Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={shareCode}
                      readOnly
                      className="font-mono text-xs resize-none h-24"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyCode}
                      className="shrink-0"
                    >
                      {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this code with others. They can paste it in the Import tab.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Share URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={shareURL}
                      readOnly
                      className="font-mono text-xs"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyURL}
                      className="shrink-0"
                    >
                      {copiedURL ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this URL for one-click template import.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    onClick={handleExportFile}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download as JSON File
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No template selected</p>
              </div>
            )}
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-code">Template Code</Label>
              <Textarea
                id="import-code"
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="Paste template code here..."
                className="font-mono text-xs min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Paste a template code shared by someone else.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-name">Template Name (Optional)</Label>
              <Input
                id="import-name"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Give it a custom name..."
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the original name.
              </p>
            </div>

            <Button
              onClick={handleImport}
              disabled={!importCode.trim()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Template
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
