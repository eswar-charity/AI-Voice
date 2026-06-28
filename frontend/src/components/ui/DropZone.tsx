import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react'
import { Upload, FileText } from 'lucide-react'

interface DropZoneProps {
  onFile: (file: File) => void
  accept?: string
  loading?: boolean
}

export default function DropZone({ onFile, accept = 'application/pdf', loading = false }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)

  const handle = useCallback(
    (file: File | null | undefined) => {
      if (!file) return
      onFile(file)
    },
    [onFile]
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handle(e.dataTransfer.files[0])
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => setDragging(false)

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handle(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`relative flex flex-col items-center justify-center gap-3 w-full h-40 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-line hover:border-primary/50 hover:bg-elevated'
      } ${loading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input type="file" accept={accept} onChange={onChange} className="sr-only" />

      {loading ? (
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {dragging ? (
              <FileText size={20} className="text-primary" />
            ) : (
              <Upload size={20} className="text-primary" />
            )}
          </div>
          <div className="text-center">
            <p className="text-ink text-sm font-medium">
              {dragging ? 'Drop to upload' : 'Drop PDF here or click to browse'}
            </p>
            <p className="text-fog text-xs mt-0.5">PDF only · max 10 MB</p>
          </div>
        </>
      )}
    </label>
  )
}
