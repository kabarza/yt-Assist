import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ToolShellProps {
  className?: string
  children: ReactNode
}

interface ToolHeaderProps {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  actions?: ReactNode
  className?: string
}

interface ToolBodyProps {
  className?: string
  children: ReactNode
}

interface ToolContainerProps {
  className?: string
  children: ReactNode
}

export function ToolShell({ className, children }: ToolShellProps) {
  return <div className={cn('flex h-full flex-col', className)}>{children}</div>
}

export function ToolHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: ToolHeaderProps) {
  return (
    <div className={cn('border-b border-border px-6 py-4', className)}>
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon ? <Icon className="h-6 w-6 text-accent" /> : null}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}

export function ToolBody({ className, children }: ToolBodyProps) {
  return <div className={cn('flex-1 overflow-y-auto p-6', className)}>{children}</div>
}

export function ToolContainer({ className, children }: ToolContainerProps) {
  return <div className={cn('mx-auto w-full max-w-6xl space-y-6', className)}>{children}</div>
}
