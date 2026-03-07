import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../contexts/ThemeContext'

// Initialize mermaid with default config
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
})

function MermaidComponent({ node, updateAttributes, selected }: NodeViewProps) {
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [code, setCode] = useState(node.attrs.code)
  const diagramRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { effectiveTheme } = useTheme()

  useEffect(() => {
    setCode(node.attrs.code)
  }, [node.attrs.code])

  useEffect(() => {
    if (isEditing || !diagramRef.current || !code.trim()) return

    const renderDiagram = async () => {
      try {
        // Update mermaid theme based on current theme
        mermaid.initialize({
          startOnLoad: false,
          theme: effectiveTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, sans-serif',
        })

        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
        const { svg } = await mermaid.render(id, code)

        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg
          setError(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      }
    }

    renderDiagram()
  }, [code, isEditing, effectiveTheme])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(code.length, code.length)
    }
  }, [isEditing])

  const handleSave = () => {
    updateAttributes({ code })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setCode(node.attrs.code)
    setIsEditing(false)
  }

  return (
    <NodeViewWrapper className="mermaid-wrapper">
      <div
        className={`relative rounded-lg border transition-colors ${
          selected
            ? 'border-accent ring-2 ring-accent/20'
            : 'border-border'
        } ${isEditing ? 'bg-secondary' : 'bg-card'}`}
      >
        {isEditing ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Edit Mermaid Diagram
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs px-2 py-1 rounded bg-secondary hover:bg-accent text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-80 transition-opacity"
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full min-h-[200px] p-3 rounded bg-background border border-border text-sm font-mono text-foreground resize-vertical focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Enter Mermaid diagram code..."
            />
            <p className="text-xs text-muted-foreground">
              <a
                href="https://mermaid.js.org/syntax/flowchart.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Mermaid syntax guide
              </a>
            </p>
          </div>
        ) : (
          <div className="p-4">
            {error ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium">Diagram Error</span>
                </div>
                <p className="text-xs text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-accent text-foreground transition-colors"
                >
                  Edit Code
                </button>
              </div>
            ) : (
              <>
                <div
                  ref={diagramRef}
                  className="mermaid-diagram flex justify-center items-center overflow-x-auto"
                  onClick={() => setIsEditing(true)}
                  style={{ cursor: 'pointer' }}
                />
                {selected && (
                  <div className="mt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-accent text-foreground transition-colors"
                    >
                      Edit Diagram
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (code: string) => ReturnType
    }
  }
}

export const MermaidExtension = Node.create({
  name: 'mermaid',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Start] --> B[End]',
        parseHTML: (element) => element.getAttribute('data-code'),
        renderHTML: (attributes) => {
          return {
            'data-code': attributes.code,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent)
  },

  addCommands() {
    return {
      setMermaid:
        (code: string) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: { code },
          })
        },
    }
  },
})
