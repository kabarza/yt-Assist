import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import html2canvas from 'html2canvas'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Lock,
  Move,
  Trash2,
  Type,
  Unlock,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  useActiveCanvasWorkspace,
  useCanvasLabStore,
  useCanvasNode,
} from '@/stores/canvasLabStore'
import type { CanvasAsset, CanvasNodeConfigMap, ComposeItem } from '@/types/canvasLab'
import { cn } from '@/lib/utils'

const BOARD_WIDTH = 1280
const BOARD_HEIGHT = 720

interface DragState {
  mode: 'move' | 'resize'
  itemId: string
  originX: number
  originY: number
  startX: number
  startY: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ComposeBoardItem({
  item,
  asset,
  isSelected,
  scale,
  onSelect,
  onStartMove,
  onStartResize,
}: {
  item: ComposeItem
  asset?: CanvasAsset
  isSelected: boolean
  scale: number
  onSelect: () => void
  onStartMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onStartResize: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <div
      className={cn(
        'absolute overflow-hidden rounded-[14px] border border-transparent',
        isSelected && 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]',
        item.locked && 'cursor-default',
        !item.locked && 'cursor-move',
      )}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex + 1,
        transform: `rotate(${item.rotation}deg)`,
      }}
      onPointerDown={(event) => {
        onSelect()
        if (!item.locked) {
          onStartMove(event)
        }
      }}
    >
      {item.kind === 'image' && asset ? (
        <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" draggable={false} />
      ) : null}
      {item.kind === 'text' ? (
        <div
          className="flex h-full w-full items-center justify-center px-5 text-center"
          style={{
            color: item.style?.color || '#ffffff',
            fontSize: item.style?.fontSize || 42,
            fontWeight: item.style?.fontWeight || 800,
            textAlign: item.style?.align || 'center',
            textShadow: '0 4px 20px rgba(0,0,0,0.45)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.05,
          }}
        >
          {item.text}
        </div>
      ) : null}
      {isSelected && !item.locked ? (
        <button
          type="button"
          className="absolute bottom-2 right-2 h-6 w-6 rounded-full border border-white/60 bg-black/70 text-white"
          onPointerDown={onStartResize}
          style={{ fontSize: 10 / scale }}
          aria-label="Resize layer"
        >
          ↘
        </button>
      ) : null}
    </div>
  )
}

export default function ComposeStage({
  nodeId,
  isOpen,
  onClose,
}: {
  nodeId: string | null
  isOpen: boolean
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const boardRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const workspace = useActiveCanvasWorkspace()
  const node = useCanvasNode(nodeId)
  const assetsById = useCanvasLabStore((state) => state.assetsById)
  const addComposeItemFromArtifact = useCanvasLabStore((state) => state.addComposeItemFromArtifact)
  const addComposeItemFromAsset = useCanvasLabStore((state) => state.addComposeItemFromAsset)
  const updateComposeItem = useCanvasLabStore((state) => state.updateComposeItem)
  const selectComposeItem = useCanvasLabStore((state) => state.selectComposeItem)
  const moveComposeItemLayer = useCanvasLabStore((state) => state.moveComposeItemLayer)
  const duplicateComposeItem = useCanvasLabStore((state) => state.duplicateComposeItem)
  const removeComposeItem = useCanvasLabStore((state) => state.removeComposeItem)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [scale, setScale] = useState(0.34)

  const config = node?.kind === 'compose' ? (node.config as CanvasNodeConfigMap['compose']) : null
  const selectedItem =
    config?.selectedItemId ? config.items.find((item) => item.id === config.selectedItemId) || null : null

  useEffect(() => {
    const element = panelRef.current
    if (!element || !isOpen) return

    const updateScale = () => {
      setScale(Math.min(element.clientWidth / BOARD_WIDTH, 1))
    }

    updateScale()

    const observer = new ResizeObserver(() => {
      updateScale()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [isOpen])

  useEffect(() => {
    if (!dragState || !nodeId) return

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = (event.clientX - dragState.originX) / scale
      const nextY = (event.clientY - dragState.originY) / scale

      if (dragState.mode === 'move') {
        void updateComposeItem(nodeId, dragState.itemId, {
          x: clamp(dragState.startX + nextX, 0, BOARD_WIDTH - 80),
          y: clamp(dragState.startY + nextY, 0, BOARD_HEIGHT - 80),
        })
        return
      }

      void updateComposeItem(nodeId, dragState.itemId, {
        width: clamp(dragState.width + nextX, 120, BOARD_WIDTH),
        height: clamp(dragState.height + nextY, 72, BOARD_HEIGHT),
      })
    }

    const handlePointerUp = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, nodeId, scale, updateComposeItem])

  if (!node || node.kind !== 'compose' || !config || !workspace) {
    return null
  }

  const availableArtifacts = workspace.artifacts.filter((artifact) =>
    ['title_suggestions', 'thumbnail_copy', 'summary', 'generated_image'].includes(artifact.kind),
  )

  const acceptedArtifactItems = availableArtifacts.flatMap((artifact) =>
    artifact.items
      .filter((item) => item.accepted || item.pinned)
      .map((item) => ({ artifact, item })),
  )

  const availableAssets = workspace.artifacts
    .filter((artifact) => artifact.kind === 'asset_reference')
    .flatMap((artifact) =>
      artifact.items
        .filter((item) => item.assetId)
        .map((item) => item.assetId!)
        .map((assetId) => assetsById[assetId])
        .filter((asset): asset is CanvasAsset => Boolean(asset)),
    )

  const exportStage = async () => {
    if (!boardRef.current) return

    const canvas = await html2canvas(boardRef.current, {
      backgroundColor: '#0d0d0f',
      scale: 2,
    })

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.download = `${node.label.toLowerCase().replace(/\s+/g, '-') || 'thumbnail'}.png`
      anchor.href = url
      anchor.click()
      URL.revokeObjectURL(url)
    })
  }

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Compose Stage
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{node.label}</h2>
          <p className="text-xs leading-5 text-muted-foreground">
            Arrange accepted copy, generated images, and brand assets on a fixed 16:9 board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full px-3" onClick={() => void exportStage()}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export
          </Button>
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-h-0 overflow-hidden border-b border-border/70 xl:border-b-0 xl:border-r">
          <div className="flex h-full flex-col gap-4 p-4">
            <div ref={panelRef} className="flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-[1.35rem] border border-border/70 bg-background/70 p-4">
              <div
                ref={boardRef}
                className="relative overflow-hidden rounded-[26px] bg-[#0d0d0f] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
                style={{
                  width: BOARD_WIDTH,
                  height: BOARD_HEIGHT,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                }}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-x-0 top-[10%] h-px bg-white/8" />
                  <div className="absolute inset-x-0 bottom-[10%] h-px bg-white/8" />
                  <div className="absolute inset-y-0 left-[7%] w-px bg-white/8" />
                  <div className="absolute inset-y-0 right-[7%] w-px bg-white/8" />
                </div>

                {config.items
                  .slice()
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((item) => (
                    <ComposeBoardItem
                      key={item.id}
                      item={item}
                      asset={item.assetId ? assetsById[item.assetId] : undefined}
                      isSelected={config.selectedItemId === item.id}
                      scale={scale}
                      onSelect={() => {
                        void selectComposeItem(node.id, item.id)
                      }}
                      onStartMove={(event) => {
                        if (item.locked) return
                        setDragState({
                          mode: 'move',
                          itemId: item.id,
                          originX: event.clientX,
                          originY: event.clientY,
                          startX: item.x,
                          startY: item.y,
                          width: item.width,
                          height: item.height,
                        })
                      }}
                      onStartResize={(event) => {
                        event.stopPropagation()
                        setDragState({
                          mode: 'resize',
                          itemId: item.id,
                          originX: event.clientX,
                          originY: event.clientY,
                          startX: item.x,
                          startY: item.y,
                          width: item.width,
                          height: item.height,
                        })
                      }}
                    />
                  ))}
              </div>
            </div>

            {selectedItem ? (
              <div className="rounded-[1.15rem] border border-border/70 bg-background/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Selected Layer</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {selectedItem.kind === 'text' ? 'Text item' : 'Image item'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => void moveComposeItemLayer(node.id, selectedItem.id, 'down')}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => void moveComposeItemLayer(node.id, selectedItem.id, 'up')}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => void duplicateComposeItem(node.id, selectedItem.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() =>
                        void updateComposeItem(node.id, selectedItem.id, {
                          locked: !selectedItem.locked,
                        })
                      }
                    >
                      {selectedItem.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => void removeComposeItem(node.id, selectedItem.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {selectedItem.kind === 'text' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={selectedItem.text || ''}
                      onChange={(event) =>
                        void updateComposeItem(node.id, selectedItem.id, {
                          text: event.target.value,
                        })
                      }
                      className="rounded-[0.95rem] border-border/65 bg-background/80 md:col-span-2"
                      placeholder="Headline"
                    />
                    <Input
                      type="number"
                      value={selectedItem.style?.fontSize || 42}
                      onChange={(event) =>
                        void updateComposeItem(node.id, selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            fontSize: Number(event.target.value || 42),
                          },
                        })
                      }
                      className="rounded-[0.95rem] border-border/65 bg-background/80"
                      placeholder="Font size"
                    />
                    <Input
                      type="color"
                      value={selectedItem.style?.color || '#ffffff'}
                      onChange={(event) =>
                        void updateComposeItem(node.id, selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            color: event.target.value,
                          },
                        })
                      }
                      className="h-10 rounded-[0.95rem] border-border/65 bg-background/80 p-1.5"
                    />
                    <Select
                      value={selectedItem.style?.align || 'center'}
                      onValueChange={(value) =>
                        void updateComposeItem(node.id, selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            align: value as 'left' | 'center' | 'right',
                          },
                        })
                      }
                    >
                      <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                        <SelectValue placeholder="Alignment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={selectedItem.width}
                        onChange={(event) =>
                          void updateComposeItem(node.id, selectedItem.id, {
                            width: Number(event.target.value || selectedItem.width),
                          })
                        }
                        className="rounded-[0.95rem] border-border/65 bg-background/80"
                        placeholder="Width"
                      />
                      <Input
                        type="number"
                        value={selectedItem.height}
                        onChange={(event) =>
                          void updateComposeItem(node.id, selectedItem.id, {
                            height: Number(event.target.value || selectedItem.height),
                          })
                        }
                        className="rounded-[0.95rem] border-border/65 bg-background/80"
                        placeholder="Height"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1rem] border border-border/70 bg-card">
                      <img
                        src={selectedItem.assetId ? assetsById[selectedItem.assetId]?.url : undefined}
                        alt={selectedItem.assetId ? assetsById[selectedItem.assetId]?.name : 'Selected layer'}
                        className="h-32 w-full rounded-[1rem] object-cover"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Input
                        type="number"
                        value={selectedItem.width}
                        onChange={(event) =>
                          void updateComposeItem(node.id, selectedItem.id, {
                            width: Number(event.target.value || selectedItem.width),
                          })
                        }
                        className="rounded-[0.95rem] border-border/65 bg-background/80"
                        placeholder="Width"
                      />
                      <Input
                        type="number"
                        value={selectedItem.height}
                        onChange={(event) =>
                          void updateComposeItem(node.id, selectedItem.id, {
                            height: Number(event.target.value || selectedItem.height),
                          })
                        }
                        className="rounded-[0.95rem] border-border/65 bg-background/80"
                        placeholder="Height"
                      />
                      <Input
                        type="number"
                        value={selectedItem.rotation}
                        onChange={(event) =>
                          void updateComposeItem(node.id, selectedItem.id, {
                            rotation: Number(event.target.value || selectedItem.rotation),
                          })
                        }
                        className="rounded-[0.95rem] border-border/65 bg-background/80"
                        placeholder="Rotation"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Accepted Copy</h3>
                </div>
                <div className="space-y-2">
                  {acceptedArtifactItems.length > 0 ? (
                    acceptedArtifactItems.map(({ artifact, item }) => (
                      <button
                        key={`${artifact.id}-${item.id}`}
                        type="button"
                        className="w-full rounded-[1rem] border border-border/65 bg-background/70 px-3 py-2 text-left transition-colors hover:border-border"
                        onClick={() => {
                          void addComposeItemFromArtifact(node.id, artifact.id, item.id)
                        }}
                      >
                        <p className="text-sm font-medium text-foreground">{item.text}</p>
                        {item.secondaryText ? (
                          <p className="text-xs leading-5 text-muted-foreground">{item.secondaryText}</p>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="rounded-[1rem] border border-dashed border-border/70 bg-background/60 px-3 py-4 text-xs leading-5 text-muted-foreground">
                      Accept or pin title and thumbnail-copy items first.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Move className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Available Images</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableAssets.length > 0 ? (
                    availableAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className="overflow-hidden rounded-[1rem] border border-border/65 bg-background/70 text-left transition-colors hover:border-border"
                        onClick={() => {
                          void addComposeItemFromAsset(node.id, asset.id)
                        }}
                      >
                        <img src={asset.url} alt={asset.name} className="h-24 w-full object-cover" />
                        <div className="px-2 py-2 text-[11px] text-muted-foreground">{asset.name}</div>
                      </button>
                    ))
                  ) : (
                    <p className="col-span-2 rounded-[1rem] border border-dashed border-border/70 bg-background/60 px-3 py-4 text-xs leading-5 text-muted-foreground">
                      Import brand assets or generate images to place them here.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <DialogContent className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Compose Stage</DialogTitle>
            <DialogDescription>Arrange text and image layers for the thumbnail concept.</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  if (!isOpen) return null

  return <aside className="relative z-20 hidden w-[min(46vw,36rem)] shrink-0 overflow-hidden border-l border-border/70 bg-card md:flex">{content}</aside>
}
