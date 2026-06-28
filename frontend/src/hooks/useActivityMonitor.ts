import { useEffect, useCallback, useRef } from 'react'

type ViolationHandler = (event: string) => void

export function useActivityMonitor(onViolation: ViolationHandler, active: boolean) {
  const handlerRef = useRef(onViolation)
  handlerRef.current = onViolation

  const report = useCallback((event: string) => {
    handlerRef.current(event)
  }, [])

  useEffect(() => {
    if (!active) return

    // Tab visibility
    const onVisibility = () => {
      if (document.hidden) report('tab_switch')
    }

    // Fullscreen exit — try to re-enter
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        report('fullscreen_exit')
        document.documentElement.requestFullscreen().catch(() => {})
      }
    }

    // Copy / paste
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      report('copy')
    }
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      report('paste')
    }

    // Right click
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      report('right_click')
    }

    // DevTools heuristic — window size delta
    let devtoolsOpen = false
    const devtoolsInterval = setInterval(() => {
      const threshold = 160
      const open =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      if (open && !devtoolsOpen) {
        devtoolsOpen = true
        report('devtools_open')
      }
      if (!open) devtoolsOpen = false
    }, 1500)

    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      clearInterval(devtoolsInterval)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [active, report])
}
