import { useState, useEffect } from 'react'

const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
const HEALTH_CHECK_TIMEOUT = 5000 // 5 seconds

/**
 * Hook to track online/offline status
 * Uses both navigator.onLine and periodic API health checks
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastChecked, setLastChecked] = useState<number>(Date.now())

  useEffect(() => {
    // Handle browser online/offline events
    const handleOnline = () => {
      setIsOnline(true)
      setLastChecked(Date.now())
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastChecked(Date.now())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic health check to detect API issues
    const healthCheck = async () => {
      // Only check if browser reports online
      if (!navigator.onLine) {
        setIsOnline(false)
        return
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

        // Try to reach the chat API with a HEAD request (lighter than GET)
        // This checks if the API server is reachable
        const response = await fetch('/api/chat/openai', {
          method: 'HEAD',
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Even 405 (Method Not Allowed) means the server is reachable
        if (response.status < 500) {
          setIsOnline(true)
        } else {
          setIsOnline(false)
        }
        setLastChecked(Date.now())
      } catch (error) {
        // Network error or timeout - truly offline
        setIsOnline(false)
        setLastChecked(Date.now())
      }
    }

    // Initial health check
    healthCheck()

    // Periodic health checks
    const intervalId = setInterval(healthCheck, HEALTH_CHECK_INTERVAL)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [])

  return { isOnline, lastChecked }
}
