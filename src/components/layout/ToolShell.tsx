import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppShell } from '@/components/layout/AppShellContext'

interface ToolShellProps {
  className?: string
  children: ReactNode
}

interface ToolHeaderProps {
  title: string
  description?: string
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
  actions,
  className,
}: ToolHeaderProps) {
  const { openMobileNavigation } = useAppShell()

  return (
    <div className={cn('border-b border-border/70 px-5 py-3', className)}>
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-[0.85rem] md:hidden"
            onClick={openMobileNavigation}
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-[1.35rem] font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="text-sm leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}

export function ToolBody({ className, children }: ToolBodyProps) {
  return <div className={cn('flex-1 overflow-y-auto p-5', className)}>{children}</div>
}

export function ToolContainer({ className, children }: ToolContainerProps) {
  return <div className={cn('mx-auto w-full max-w-[90rem] space-y-6', className)}>{children}</div>
}
