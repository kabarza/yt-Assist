export const PACKAGING_VIEWS = [
  'inputs',
  'output',
  'competitor',
  'analytics',
  'batch',
  'template',
] as const

export type PackagingView = typeof PACKAGING_VIEWS[number]

export const SCRIPT_VIEWS = ['input', 'output'] as const

export type ScriptView = typeof SCRIPT_VIEWS[number]

export function parsePackagingView(value: string | null | undefined): PackagingView {
  if (value && PACKAGING_VIEWS.includes(value as PackagingView)) {
    return value as PackagingView
  }

  return 'inputs'
}

export function parseScriptView(value: string | null | undefined): ScriptView {
  if (value && SCRIPT_VIEWS.includes(value as ScriptView)) {
    return value as ScriptView
  }

  return 'input'
}

export function updateViewSearchParams(
  current: URLSearchParams,
  nextView: string,
  defaultView: string,
) {
  const next = new URLSearchParams(current)

  if (nextView === defaultView) {
    next.delete('view')
  } else {
    next.set('view', nextView)
  }

  return next
}
