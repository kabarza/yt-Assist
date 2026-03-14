import { toast } from 'sonner'

interface TaskCompletionToastOptions {
  routePrefix: string
  title: string
  description?: string
}

function shouldShowTaskCompletionToast(routePrefix: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return true
  }

  return document.hidden || !window.location.pathname.startsWith(routePrefix)
}

export function showBackgroundTaskCompletionToast({
  routePrefix,
  title,
  description,
}: TaskCompletionToastOptions) {
  if (!shouldShowTaskCompletionToast(routePrefix)) {
    return
  }

  toast.success(title, description ? { description } : undefined)
}
