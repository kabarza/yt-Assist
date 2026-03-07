import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Download, Type, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ThumbnailPreviewProps {
  thumbnailText?: string
}

type TextPosition = 'top' | 'center' | 'bottom'
type BackgroundType = 'gradient-red' | 'gradient-blue' | 'gradient-purple' | 'gradient-orange' | 'solid-dark' | 'solid-light'

interface TextStyle {
  fontSize: number
  textColor: string
  strokeColor: string
  strokeWidth: number
  fontWeight: string
}

const BACKGROUND_STYLES: Record<BackgroundType, string> = {
  'gradient-red': 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
  'gradient-blue': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'gradient-purple': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'gradient-orange': 'linear-gradient(135deg, #FDC830 0%, #F37335 100%)',
  'solid-dark': '#1a1a1a',
  'solid-light': '#f5f5f5',
}

const PRESET_STYLES = [
  { name: 'Bold Yellow', fontSize: 80, textColor: '#FFEB3B', strokeColor: '#000000', strokeWidth: 8, fontWeight: '900' },
  { name: 'White Clean', fontSize: 70, textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, fontWeight: '800' },
  { name: 'Red Impact', fontSize: 85, textColor: '#FF0000', strokeColor: '#FFFFFF', strokeWidth: 7, fontWeight: '900' },
  { name: 'Neon Green', fontSize: 75, textColor: '#00FF00', strokeColor: '#000000', strokeWidth: 10, fontWeight: '900' },
]

export default function ThumbnailPreview({ thumbnailText = '' }: ThumbnailPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [text, setText] = useState(thumbnailText)
  const [position, setPosition] = useState<TextPosition>('center')
  const [background, setBackground] = useState<BackgroundType>('gradient-red')
  const [style, setStyle] = useState<TextStyle>(PRESET_STYLES[0])

  // Update text when prop changes
  useEffect(() => {
    if (thumbnailText) {
      setText(thumbnailText)
    }
  }, [thumbnailText])

  // Render canvas whenever settings change
  useEffect(() => {
    renderThumbnail()
  }, [text, position, background, style])

  const renderThumbnail = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to YouTube thumbnail dimensions
    canvas.width = 1280
    canvas.height = 720

    // Draw background
    if (background.startsWith('gradient')) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)

      // Parse gradient colors (simplified)
      if (background === 'gradient-red') {
        gradient.addColorStop(0, '#FF416C')
        gradient.addColorStop(1, '#FF4B2B')
      } else if (background === 'gradient-blue') {
        gradient.addColorStop(0, '#667eea')
        gradient.addColorStop(1, '#764ba2')
      } else if (background === 'gradient-purple') {
        gradient.addColorStop(0, '#a8edea')
        gradient.addColorStop(1, '#fed6e3')
      } else if (background === 'gradient-orange') {
        gradient.addColorStop(0, '#FDC830')
        gradient.addColorStop(1, '#F37335')
      }

      ctx.fillStyle = gradient
    } else {
      ctx.fillStyle = BACKGROUND_STYLES[background]
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Prepare text
    if (!text.trim()) return

    const lines = wrapText(ctx, text, canvas.width - 100, style.fontSize)

    // Set text style
    ctx.font = `${style.fontWeight} ${style.fontSize}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Calculate vertical position
    const lineHeight = style.fontSize * 1.2
    const totalHeight = lines.length * lineHeight
    let startY: number

    if (position === 'top') {
      startY = 150
    } else if (position === 'bottom') {
      startY = canvas.height - 150 - totalHeight + lineHeight
    } else {
      // center
      startY = (canvas.height - totalHeight) / 2 + lineHeight / 2
    }

    // Draw each line
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight

      // Draw stroke (outline)
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = style.strokeWidth
      ctx.lineJoin = 'round'
      ctx.strokeText(line, canvas.width / 2, y)

      // Draw fill text
      ctx.fillStyle = style.textColor
      ctx.fillText(line, canvas.width / 2, y)
    })
  }

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] => {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    ctx.font = `${style.fontWeight} ${fontSize}px Arial, sans-serif`

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  const downloadThumbnail = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      link.download = `thumbnail-preview-${date}.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Thumbnail preview downloaded')
    })
  }

  const applyPreset = (preset: TextStyle) => {
    setStyle(preset)
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Type className="h-5 w-5" />
            Thumbnail Text Preview
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize how your thumbnail text will look with different styles
          </p>
        </div>
        <Button onClick={downloadThumbnail} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {/* Canvas Preview */}
      <div className="bg-muted rounded-lg p-4">
        <canvas
          ref={canvasRef}
          className="w-full h-auto border border-border rounded"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
        />
      </div>

      {/* Text Input */}
      <div>
        <Label htmlFor="thumbnail-text">Thumbnail Text</Label>
        <Input
          id="thumbnail-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your thumbnail text..."
          className="mt-1.5"
        />
      </div>

      {/* Style Presets */}
      <div>
        <Label>Style Presets</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {PRESET_STYLES.map((preset, index) => (
            <Button
              key={index}
              onClick={() => applyPreset(preset)}
              variant={style === preset ? "default" : "outline"}
              size="sm"
              className="text-xs"
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Position */}
        <div>
          <Label>Text Position</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(['top', 'center', 'bottom'] as TextPosition[]).map((pos) => (
              <Button
                key={pos}
                onClick={() => setPosition(pos)}
                variant={position === pos ? "default" : "outline"}
                size="sm"
                className="capitalize"
              >
                {pos}
              </Button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div>
          <Label>Background</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {Object.keys(BACKGROUND_STYLES).map((bg) => (
              <button
                key={bg}
                onClick={() => setBackground(bg as BackgroundType)}
                className={cn(
                  "h-10 rounded border-2 transition-all",
                  background === bg ? "border-primary" : "border-border hover:border-muted-foreground"
                )}
                style={{ background: BACKGROUND_STYLES[bg as BackgroundType] }}
                aria-label={`Select ${bg} background`}
              />
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <Label htmlFor="font-size">Font Size: {style.fontSize}px</Label>
          <input
            id="font-size"
            type="range"
            min="40"
            max="120"
            value={style.fontSize}
            onChange={(e) => setStyle({ ...style, fontSize: parseInt(e.target.value) })}
            className="w-full mt-2"
          />
        </div>

        {/* Stroke Width */}
        <div>
          <Label htmlFor="stroke-width">Outline: {style.strokeWidth}px</Label>
          <input
            id="stroke-width"
            type="range"
            min="0"
            max="15"
            value={style.strokeWidth}
            onChange={(e) => setStyle({ ...style, strokeWidth: parseInt(e.target.value) })}
            className="w-full mt-2"
          />
        </div>

        {/* Text Color */}
        <div>
          <Label htmlFor="text-color" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Text Color
          </Label>
          <div className="flex gap-2 mt-2">
            <input
              id="text-color"
              type="color"
              value={style.textColor}
              onChange={(e) => setStyle({ ...style, textColor: e.target.value })}
              className="h-10 w-20 rounded border border-border cursor-pointer"
            />
            <Input
              value={style.textColor}
              onChange={(e) => setStyle({ ...style, textColor: e.target.value })}
              placeholder="#FFFFFF"
              className="flex-1"
            />
          </div>
        </div>

        {/* Stroke Color */}
        <div>
          <Label htmlFor="stroke-color" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Outline Color
          </Label>
          <div className="flex gap-2 mt-2">
            <input
              id="stroke-color"
              type="color"
              value={style.strokeColor}
              onChange={(e) => setStyle({ ...style, strokeColor: e.target.value })}
              className="h-10 w-20 rounded border border-border cursor-pointer"
            />
            <Input
              value={style.strokeColor}
              onChange={(e) => setStyle({ ...style, strokeColor: e.target.value })}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="p-3 bg-muted rounded-lg">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Pro tip:</span> YouTube thumbnails work best with bold, high-contrast text. Use large font sizes (70-90px), strong outlines for readability, and limit text to 2-3 words for maximum impact.
        </p>
      </div>
    </Card>
  )
}
