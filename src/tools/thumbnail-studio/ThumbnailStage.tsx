import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text as KonvaText, Transformer } from 'react-konva'
import type Konva from 'konva'
import type {
  ThumbnailAsset,
  ThumbnailBackgroundLayer,
  ThumbnailDocument,
  ThumbnailImageLayer,
  ThumbnailLayer,
  ThumbnailTextLayer,
  ThumbnailToolMode,
} from '@/types/thumbnailEditor'

export interface ThumbnailStageRef {
  exportDataUrl: (options?: { mimeType?: string; quality?: number }) => string | null
}

interface ThumbnailStageProps {
  document: ThumbnailDocument
  assetsById: Record<string, ThumbnailAsset>
  toolMode: ThumbnailToolMode
  editingTextLayerId: string | null
  editingTextValue: string
  onEditingTextChange: (value: string) => void
  onEditingTextCommit: () => void
  onEditingTextCancel: () => void
  onRequestTextEdit: (layerId: string) => void
  onSelectLayer: (layerId: string | null) => void
  onUpdateLayer: (layerId: string, updater: (layer: ThumbnailLayer) => ThumbnailLayer) => void
  onRequestOutpaint: (
    layerId: string,
    outpaint: { top: number; right: number; bottom: number; left: number },
  ) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function useImageElement(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }

    const nextImage = new window.Image()
    nextImage.decoding = 'async'
    nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      setImage(nextImage)
    }
    nextImage.src = src

    return () => {
      nextImage.onload = null
    }
  }, [src])

  return image
}

function ImageLayerNode({
  layer,
  asset,
  selected,
  draggable,
  board,
  onSelect,
  onDragEnd,
  registerNode,
  onDoubleClick,
}: {
  layer: ThumbnailBackgroundLayer | ThumbnailImageLayer
  asset?: ThumbnailAsset
  selected: boolean
  draggable: boolean
  board: ThumbnailDocument['board']
  onSelect: () => void
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void
  registerNode: (node: Konva.Group | null) => void
  onDoubleClick?: () => void
}) {
  const image = useImageElement(asset?.url)

  return (
    <Group
      ref={registerNode}
      x={layer.x}
      y={layer.y}
      draggable={draggable}
      opacity={layer.opacity}
      visible={!layer.hidden}
      onClick={(event) => {
        event.cancelBubble = true
        onSelect()
      }}
      onTap={(event) => {
        event.cancelBubble = true
        onSelect()
      }}
      onDblClick={onDoubleClick}
      onDragEnd={onDragEnd}
      dragBoundFunc={(position) => ({
        x: clamp(position.x, 0, Math.max(0, board.width - layer.width)),
        y: clamp(position.y, 0, Math.max(0, board.height - layer.height)),
      })}
      clipX={0}
      clipY={0}
      clipWidth={layer.width}
      clipHeight={layer.height}
    >
      <Rect
        width={layer.width}
        height={layer.height}
        fill={selected ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'}
        stroke={selected ? 'rgba(255,245,231,0.42)' : 'rgba(255,255,255,0.06)'}
        strokeWidth={selected ? 2 : 1}
        cornerRadius={layer.kind === 'background' ? 0 : 14}
      />
      {image ? (
        <KonvaImage
          image={image}
          x={layer.contentOffsetX}
          y={layer.contentOffsetY}
          width={layer.contentWidth}
          height={layer.contentHeight}
          listening={false}
        />
      ) : null}
    </Group>
  )
}

function TextLayerNode({
  layer,
  draggable,
  board,
  registerNode,
  onSelect,
  onDragEnd,
  onDoubleClick,
}: {
  layer: ThumbnailTextLayer
  draggable: boolean
  board: ThumbnailDocument['board']
  registerNode: (node: Konva.Text | null) => void
  onSelect: () => void
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void
  onDoubleClick: () => void
}) {
  return (
    <KonvaText
      ref={registerNode}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      text={layer.text}
      fontFamily={layer.style.fontFamily}
      fontSize={layer.style.fontSize}
      fontStyle={layer.style.fontWeight >= 700 ? 'bold' : 'normal'}
      fill={layer.style.color}
      align={layer.style.align}
      letterSpacing={layer.style.letterSpacing}
      lineHeight={layer.style.lineHeight}
      stroke={layer.style.strokeColor}
      strokeWidth={layer.style.strokeWidth}
      shadowColor={layer.style.shadowColor}
      shadowBlur={layer.style.shadowBlur}
      opacity={layer.opacity}
      visible={!layer.hidden}
      padding={6}
      wrap="word"
      draggable={draggable}
      onClick={(event) => {
        event.cancelBubble = true
        onSelect()
      }}
      onTap={(event) => {
        event.cancelBubble = true
        onSelect()
      }}
      onDblClick={(event) => {
        event.cancelBubble = true
        onDoubleClick()
      }}
      onDragEnd={onDragEnd}
      dragBoundFunc={(position) => ({
        x: clamp(position.x, 0, Math.max(0, board.width - layer.width)),
        y: clamp(position.y, 0, Math.max(0, board.height - layer.height)),
      })}
      shadowOffsetX={0}
      shadowOffsetY={8}
      perfectDrawEnabled={false}
      fillAfterStrokeEnabled
      listening
    />
  )
}

export const ThumbnailStage = forwardRef<ThumbnailStageRef, ThumbnailStageProps>(function ThumbnailStage(
  {
    document,
    assetsById,
    toolMode,
    editingTextLayerId,
    editingTextValue,
    onEditingTextChange,
    onEditingTextCommit,
    onEditingTextCancel,
    onRequestTextEdit,
    onSelectLayer,
    onUpdateLayer,
    onRequestOutpaint,
  },
  ref,
) {
  const shellRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({})
  const [scale, setScale] = useState(0.6)
  const selectedLayer = useMemo(
    () => document.layers.find((layer) => layer.id === document.selectedLayerId) || null,
    [document.layers, document.selectedLayerId],
  )
  const editingLayer =
    editingTextLayerId
      ? document.layers.find((layer): layer is ThumbnailTextLayer => layer.id === editingTextLayerId && layer.kind === 'text') || null
      : null

  useImperativeHandle(ref, () => ({
    exportDataUrl: (options) => {
      const stage = stageRef.current
      const transformer = transformerRef.current
      if (!stage) return null

      const wasVisible = transformer?.visible() ?? false
      const previousWidth = stage.width()
      const previousHeight = stage.height()
      const previousScaleX = stage.scaleX()
      const previousScaleY = stage.scaleY()
      if (transformer) {
        transformer.visible(false)
        transformer.getLayer()?.batchDraw()
      }

      stage.width(document.board.width)
      stage.height(document.board.height)
      stage.scale({ x: 1, y: 1 })
      stage.batchDraw()

      const dataUrl = stage.toDataURL({
        mimeType: options?.mimeType || 'image/png',
        quality: options?.quality,
        pixelRatio: 1,
      })

      stage.width(previousWidth)
      stage.height(previousHeight)
      stage.scale({ x: previousScaleX, y: previousScaleY })
      stage.batchDraw()

      if (transformer) {
        transformer.visible(wasVisible)
        transformer.getLayer()?.batchDraw()
      }

      return dataUrl
    },
  }), [document.board.height, document.board.width])

  useEffect(() => {
    const element = shellRef.current
    if (!element) return

    const updateScale = () => {
      const nextScale = Math.min(
        element.clientWidth / document.board.width,
        element.clientHeight / document.board.height,
        1,
      )
      setScale(nextScale > 0 ? nextScale : 0.1)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    return () => observer.disconnect()
  }, [document.board.height, document.board.width])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return

    if (
      !selectedLayer ||
      selectedLayer.kind === 'background' ||
      selectedLayer.hidden ||
      selectedLayer.locked ||
      toolMode !== 'transform'
    ) {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }

    const node = nodeRefs.current[selectedLayer.id]
    if (!node) return
    transformer.nodes([node])
    transformer.getLayer()?.batchDraw()
  }, [selectedLayer, toolMode])

  const handleImageTransformEnd = (
    layer: ThumbnailImageLayer,
    event: Konva.KonvaEventObject<Event>,
  ) => {
    const node = nodeRefs.current[layer.id]
    if (!node) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const nextX = clamp(node.x(), 0, Math.max(0, document.board.width - 80))
    const nextY = clamp(node.y(), 0, Math.max(0, document.board.height - 80))
    const nextWidth = clamp(layer.width * scaleX, 80, document.board.width)
    const nextHeight = clamp(layer.height * scaleY, 80, document.board.height)

    node.scaleX(1)
    node.scaleY(1)

    const left = Math.max(0, layer.x - nextX)
    const top = Math.max(0, layer.y - nextY)
    const right = Math.max(0, nextX + nextWidth - (layer.x + layer.width))
    const bottom = Math.max(0, nextY + nextHeight - (layer.y + layer.height))
    const nativeEvent = event.evt as MouseEvent
    const hasOutpaint =
      (nativeEvent.metaKey || nativeEvent.ctrlKey) &&
      (left > 0 || right > 0 || top > 0 || bottom > 0)

    onUpdateLayer(layer.id, (currentLayer) => {
      if (currentLayer.kind !== 'image' && currentLayer.kind !== 'background') {
        return currentLayer
      }

      return {
        ...currentLayer,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        contentOffsetX: hasOutpaint ? left : 0,
        contentOffsetY: hasOutpaint ? top : 0,
        contentWidth: hasOutpaint ? layer.width : nextWidth,
        contentHeight: hasOutpaint ? layer.height : nextHeight,
      }
    })

    if (hasOutpaint) {
      onRequestOutpaint(layer.id, { top, right, bottom, left })
    }
  }

  const handleTextTransformEnd = (layer: ThumbnailTextLayer) => {
    const node = nodeRefs.current[layer.id]
    if (!node) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const nextFontSize = clamp(layer.style.fontSize * ((scaleX + scaleY) / 2), 18, 240)
    const nextWidth = clamp(layer.width * scaleX, 120, document.board.width)
    const nextHeight = clamp(layer.height * scaleY, 40, document.board.height)
    const nextX = clamp(node.x(), 0, Math.max(0, document.board.width - 60))
    const nextY = clamp(node.y(), 0, Math.max(0, document.board.height - 40))

    node.scaleX(1)
    node.scaleY(1)

    onUpdateLayer(layer.id, (currentLayer) => {
      if (currentLayer.kind !== 'text') {
        return currentLayer
      }

      return {
        ...currentLayer,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        style: {
          ...currentLayer.style,
          fontSize: nextFontSize,
        },
      }
    })
  }

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,177,90,0.12),_rgba(12,10,15,0)_35%),linear-gradient(180deg,rgba(14,12,17,0.98),rgba(7,6,9,1))]">
      <div ref={shellRef} className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-5">
        <div
          className="relative overflow-hidden rounded-[1.4rem] border border-white/12 shadow-[0_22px_80px_rgba(0,0,0,0.48)]"
          style={{
            width: document.board.width * scale,
            height: document.board.height * scale,
          }}
        >
            <Stage
              ref={stageRef}
              width={document.board.width * scale}
              height={document.board.height * scale}
              scaleX={scale}
              scaleY={scale}
              style={{
                backgroundColor: document.board.backgroundColor,
              }}
              onMouseDown={(event) => {
                if (event.target === event.target.getStage()) {
                  onSelectLayer(null)
                }
              }}
              onTouchStart={(event) => {
                if (event.target === event.target.getStage()) {
                  onSelectLayer(null)
                }
              }}
            >
              <Layer>
                <Rect width={document.board.width} height={document.board.height} fill={document.board.backgroundColor} />

                {document.layers.map((layer) => {
                  if (layer.kind === 'text') {
                    return (
                      <TextLayerNode
                        key={layer.id}
                        layer={layer}
                        draggable={!layer.locked && toolMode === 'move'}
                        board={document.board}
                        registerNode={(node) => {
                          nodeRefs.current[layer.id] = node
                        }}
                        onSelect={() => onSelectLayer(layer.id)}
                        onDoubleClick={() => onRequestTextEdit(layer.id)}
                        onDragEnd={(event) => {
                          const nextX = clamp(event.target.x(), 0, Math.max(0, document.board.width - layer.width))
                          const nextY = clamp(event.target.y(), 0, Math.max(0, document.board.height - layer.height))
                          onUpdateLayer(layer.id, (currentLayer) => ({
                            ...currentLayer,
                            x: nextX,
                            y: nextY,
                          }))
                        }}
                      />
                    )
                  }

                  return (
                    <ImageLayerNode
                      key={layer.id}
                      layer={layer}
                      asset={layer.assetId ? assetsById[layer.assetId] : undefined}
                      selected={layer.id === document.selectedLayerId}
                      draggable={!layer.locked && toolMode === 'move' && layer.kind !== 'background'}
                      board={document.board}
                      registerNode={(node) => {
                        nodeRefs.current[layer.id] = node
                      }}
                      onSelect={() => onSelectLayer(layer.id)}
                      onDoubleClick={undefined}
                      onDragEnd={(event) => {
                        if (layer.kind === 'background') return
                        const nextX = clamp(event.target.x(), 0, Math.max(0, document.board.width - layer.width))
                        const nextY = clamp(event.target.y(), 0, Math.max(0, document.board.height - layer.height))
                        onUpdateLayer(layer.id, (currentLayer) => {
                          if (currentLayer.kind !== 'image') {
                            return currentLayer
                          }

                          return {
                            ...currentLayer,
                            x: nextX,
                            y: nextY,
                          }
                        })
                      }}
                    />
                  )
                })}
              </Layer>

              <Layer listening={false}>
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={false}
                  flipEnabled={false}
                  keepRatio={false}
                  anchorCornerRadius={10}
                  anchorSize={14}
                  borderStroke="rgba(255,245,231,0.9)"
                  borderStrokeWidth={1.5}
                  anchorStroke="rgba(18,15,21,1)"
                  anchorFill="rgba(255,177,90,1)"
                  enabledAnchors={[
                    'top-left',
                    'top-center',
                    'top-right',
                    'middle-left',
                    'middle-right',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right',
                  ]}
                  boundBoxFunc={(_, nextBox) => ({
                    ...nextBox,
                    width: Math.max(80, nextBox.width),
                    height: Math.max(40, nextBox.height),
                  })}
                  onTransformEnd={(event) => {
                    if (!selectedLayer) return
                    if (selectedLayer.kind === 'text') {
                      handleTextTransformEnd(selectedLayer)
                      return
                    }

                    if (selectedLayer.kind === 'image') {
                      handleImageTransformEnd(selectedLayer, event as unknown as Konva.KonvaEventObject<Event>)
                    }
                  }}
                />
              </Layer>
            </Stage>

          {editingLayer ? (
            <textarea
              autoFocus
              value={editingTextValue}
              onChange={(event) => onEditingTextChange(event.target.value)}
              onBlur={onEditingTextCommit}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onEditingTextCancel()
                }

                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  onEditingTextCommit()
                }
              }}
              className="absolute resize-none rounded-[0.9rem] border border-white/35 bg-black/55 px-3 py-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] outline-none"
              style={{
                left: editingLayer.x * scale,
                top: editingLayer.y * scale,
                width: editingLayer.width * scale,
                height: Math.max(editingLayer.height * scale, 48),
                fontFamily: editingLayer.style.fontFamily,
                fontSize: editingLayer.style.fontSize * scale,
                fontWeight: editingLayer.style.fontWeight,
                lineHeight: editingLayer.style.lineHeight,
                letterSpacing: `${editingLayer.style.letterSpacing * scale}px`,
                textAlign: editingLayer.style.align,
                color: editingLayer.style.color,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
})
