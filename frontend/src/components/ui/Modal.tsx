import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-base/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${width} bg-surface border border-line rounded-2xl shadow-2xl animate-fade-up`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display font-semibold text-ink text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-fog hover:text-mist transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
