const LOCAL_DEV_API_ORIGIN = 'http://localhost:3000'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function buildApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function shouldTryLocalDevApiFallback() {
  if (typeof window === 'undefined') {
    return false
  }

  return LOCAL_HOSTNAMES.has(window.location.hostname) && window.location.origin !== LOCAL_DEV_API_ORIGIN
}

function getApiCandidates(path: string) {
  const apiPath = buildApiPath(path)

  if (!shouldTryLocalDevApiFallback()) {
    return [apiPath]
  }

  return [apiPath, new URL(apiPath, `${LOCAL_DEV_API_ORIGIN}/`).toString()]
}

export async function fetchApi(path: string, init?: RequestInit) {
  const candidates = getApiCandidates(path)
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]

    try {
      const response = await fetch(candidate, init)
      if (response.ok) {
        return response
      }

      lastResponse = response

      const isFinalAttempt = index === candidates.length - 1
      const shouldRetryAgainstDevApi = !isFinalAttempt && response.status === 404

      if (!shouldRetryAgainstDevApi) {
        return response
      }
    } catch (error) {
      lastError = error

      if (index === candidates.length - 1) {
        throw error
      }
    }
  }

  if (lastResponse) {
    return lastResponse
  }

  throw (lastError instanceof Error ? lastError : new Error('API request failed'))
}
