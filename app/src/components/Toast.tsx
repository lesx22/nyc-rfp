import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useStore } from '../store'

/**
 * Small status notice ("Link copied"). The live region is always mounted so screen readers
 * pick up changes; the visible chip fades in and out (<300ms) and clears after 2.2s.
 */
export default function Toast() {
  const toast = useStore((s) => s.toast)
  const reduce = useReducedMotion()
  const [expired, setExpired] = useState(0)
  const shown = toast && toast.n !== expired ? toast : null

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setExpired(toast.n), 2200)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none absolute inset-x-0 top-20 z-50 flex justify-center px-4">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.n}
            initial={{ opacity: 0, y: reduce ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="glass px-3 py-1.5 text-[12px] text-text"
          >
            {shown.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
