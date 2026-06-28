import { useRef, useState, useCallback } from 'react'

export function useMediaRecorder(onAudioReady: (base64: string) => void) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startTimeRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      chunksRef.current = []
      startTimeRef.current = Date.now()

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const type = mimeType || recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        streamRef.current?.getTracks().forEach((t) => t.stop())

        if (blob.size < 500) {
          setError('Recording too short — hold the button longer while speaking')
          return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          const b64 = result?.split(',')[1]
          if (b64) onAudioReady(b64)
        }
        reader.readAsDataURL(blob)
      }

      recorder.start(250)
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Microphone access denied. Please allow microphone access.')
    }
  }, [onAudioReady])

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      setRecording(false)
    }
  }, [])

  return { recording, error, start, stop }
}
