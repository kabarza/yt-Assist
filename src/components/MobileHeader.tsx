import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileHeaderProps {
  onMenuClick: () => void
  title?: string
}

export default function MobileHeader({ onMenuClick, title = 'YT-Assist' }: MobileHeaderProps) {
  return (
    <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="size-10 rounded-lg"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
      <div className="w-10" />
    </div>
  )
}
