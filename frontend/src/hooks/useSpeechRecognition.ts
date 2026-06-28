import { useRef, useState, useCallback } from 'react'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptRef = useRef('')
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null)

  const start = useCallback(() => {
    const SR = getSpeechRecognitionCtor()
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    transcriptRef.current = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      transcriptRef.current = text
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch {
      // already started
    }
  }, [])

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recognition = recognitionRef.current
      if (!recognition) {
        resolve(transcriptRef.current.trim())
        return
      }

      recognition.onend = () => {
        resolve(transcriptRef.current.trim())
      }

      try {
        recognition.stop()
      } catch {
        resolve(transcriptRef.current.trim())
      }
      recognitionRef.current = null
    })
  }, [])

  return { supported, start, stop }
}
