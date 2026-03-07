import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineQueue } from '../stores/offlineQueueStore'
import { WifiOff, Wifi, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function OfflineIndicator() {
  const { isOnline } = useOnlineStatus()
  const { queue, isProcessing } = useOfflineQueue()

  const pendingCount = queue.filter(m => m.status === 'pending').length
  const failedCount = queue.filter(m => m.status === 'failed').length

  // Don't show indicator when online and no pending messages
  if (isOnline && pendingCount === 0 && failedCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2 text-sm transition-all',
        !isOnline
          ? 'bg-destructive text-destructive-foreground'
          : isProcessing
          ? 'bg-yellow-500/90 text-yellow-950'
          : 'bg-green-500/90 text-green-950'
      )}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="font-medium">You're offline</span>
            {pendingCount > 0 && (
              <span className="text-xs opacity-90">
                • {pendingCount} message{pendingCount > 1 ? 's' : ''} queued
              </span>
            )}
          </>
        ) : isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-medium">Sending queued messages...</span>
            {pendingCount > 0 && (
              <span className="text-xs opacity-90">
                {pendingCount} remaining
              </span>
            )}
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span className="font-medium">Back online</span>
            {failedCount > 0 && (
              <span className="text-xs opacity-90">
                • {failedCount} failed
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
