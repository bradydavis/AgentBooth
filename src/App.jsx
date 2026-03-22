import { useState, useEffect, useRef, useCallback } from 'react'

// ── Configuration ──────────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8100/ws/voice'

// ── State colors & labels ──────────────────────────────────────────────
const STATE_CONFIG = {
  idle:       { color: '#3b82f6', glow: '#3b82f680', label: 'Tap to speak' },
  listening:  { color: '#10b981', glow: '#10b98180', label: 'Listening...' },
  processing: { color: '#8b5cf6', glow: '#8b5cf680', label: 'Thinking...' },
  speaking:   { color: '#f59e0b', glow: '#f59e0b80', label: 'Speaking...' },
  error:      { color: '#ef4444', glow: '#ef444480', label: 'Error' },
}

export default function App() {
  const [agentState, setAgentState] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const canvasRef = useRef(null)

  // ── WebSocket connection ──────────────────────────────────────────
  useEffect(() => {
    let ws
    let reconnectTimer

    function connect() {
      ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        setError('')
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'state':
            setAgentState(msg.state)
            break
          case 'transcript':
            setTranscript(msg.text)
            break
          case 'response':
            setResponse(msg.text)
            break
          case 'audio':
            playAudio(msg.data, msg.format)
            break
          case 'error':
            setError(msg.message)
            setAgentState('error')
            setTimeout(() => setAgentState('idle'), 3000)
            break
          case 'pong':
            break
        }
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        setConnected(false)
      }

      wsRef.current = ws
    }

    connect()

    // Keepalive ping
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => {
      clearInterval(pingInterval)
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  // ── Audio playback with analyser for sphere animation ─────────────
  const playAudio = useCallback((base64Data, format) => {
    const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const blob = new Blob([audioBytes], { type: `audio/${format || 'mp3'}` })
    const url = URL.createObjectURL(blob)

    const audio = new Audio(url)
    audio.onended = () => {
      URL.revokeObjectURL(url)
      setAgentState('idle')
    }
    audio.play().catch(err => {
      console.error('Audio play failed:', err)
      setAgentState('idle')
    })
  }, [])

  // ── Recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (agentState !== 'idle' || !connected) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (blob.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send as binary
          blob.arrayBuffer().then(buffer => {
            wsRef.current.send(buffer)
          })
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setAgentState('listening')
      setTranscript('')
      setResponse('')
      setError('')
    } catch (err) {
      console.error('Mic access denied:', err)
      setError('Microphone access denied')
      setAgentState('error')
      setTimeout(() => setAgentState('idle'), 3000)
    }
  }, [agentState, connected])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [])

  // Tap to toggle recording
  const handleSphereClick = useCallback(() => {
    if (agentState === 'idle') {
      startRecording()
    } else if (agentState === 'listening') {
      stopRecording()
    }
  }, [agentState, startRecording, stopRecording])

  // ── Canvas animation ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const size = 300

    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const center = size / 2
    const baseRadius = 90

    let phase = 0

    function draw() {
      ctx.clearRect(0, 0, size, size)

      const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle

      // Get audio amplitude if speaking
      let amplitude = 0
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        amplitude = data.reduce((a, b) => a + b, 0) / data.length / 255
      }

      phase += 0.02

      // Pulse intensity varies by state
      let pulseIntensity = 0
      switch (agentState) {
        case 'idle':
          pulseIntensity = Math.sin(phase) * 0.05
          break
        case 'listening':
          pulseIntensity = Math.sin(phase * 3) * 0.12
          break
        case 'processing':
          pulseIntensity = Math.sin(phase * 5) * 0.08
          break
        case 'speaking':
          pulseIntensity = amplitude * 0.3
          break
      }

      const radius = baseRadius * (1 + pulseIntensity)

      // Outer glow
      const glowRadius = radius * 1.8
      const glowGrad = ctx.createRadialGradient(
        center, center, radius * 0.8,
        center, center, glowRadius
      )
      glowGrad.addColorStop(0, config.glow)
      glowGrad.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(center, center, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = glowGrad
      ctx.fill()

      // Main sphere gradient
      const grad = ctx.createRadialGradient(
        center - radius * 0.3, center - radius * 0.3, radius * 0.1,
        center, center, radius
      )
      grad.addColorStop(0, lighten(config.color, 40))
      grad.addColorStop(0.5, config.color)
      grad.addColorStop(1, darken(config.color, 30))

      ctx.beginPath()
      ctx.arc(center, center, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Specular highlight
      const specGrad = ctx.createRadialGradient(
        center - radius * 0.25, center - radius * 0.3, 0,
        center - radius * 0.25, center - radius * 0.3, radius * 0.5
      )
      specGrad.addColorStop(0, 'rgba(255,255,255,0.4)')
      specGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, Math.PI * 2)
      ctx.fillStyle = specGrad
      ctx.fill()

      // Processing spinner ring
      if (agentState === 'processing') {
        ctx.beginPath()
        const startAngle = phase * 3
        ctx.arc(center, center, radius + 8, startAngle, startAngle + Math.PI * 1.2)
        ctx.strokeStyle = config.color
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [agentState])

  const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle

  return (
    <div style={styles.container}>
      {/* Connection indicator */}
      <div style={styles.statusBar}>
        <div style={{
          ...styles.connectionDot,
          backgroundColor: connected ? '#10b981' : '#ef4444'
        }} />
        <span style={styles.statusText}>
          {connected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>

      {/* Sphere */}
      <div
        style={{
          ...styles.sphereContainer,
          cursor: (agentState === 'idle' || agentState === 'listening') ? 'pointer' : 'default',
        }}
        onClick={handleSphereClick}
      >
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>

      {/* State label */}
      <div style={{ ...styles.stateLabel, color: config.color }}>
        {config.label}
      </div>

      {/* Transcript & Response */}
      <div style={styles.textArea}>
        {transcript && (
          <div style={styles.transcriptBox}>
            <span style={styles.textLabel}>You</span>
            <p style={styles.textContent}>{transcript}</p>
          </div>
        )}
        {response && (
          <div style={styles.responseBox}>
            <span style={styles.textLabel}>Agent</span>
            <p style={styles.textContent}>{response}</p>
          </div>
        )}
        {error && (
          <div style={styles.errorBox}>
            <p style={styles.textContent}>{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Color utils ────────────────────────────────────────────────────────
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function lighten(hex, amount) {
  const [h, s, l] = hexToHSL(hex)
  return `hsl(${h}, ${s}%, ${Math.min(100, l + amount)}%)`
}

function darken(hex, amount) {
  const [h, s, l] = hexToHSL(hex)
  return `hsl(${h}, ${s}%, ${Math.max(0, l - amount)}%)`
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0a0a0f 0%, #111118 50%, #0a0a0f 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: '#e4e4e7',
    overflow: 'hidden',
    padding: '20px',
    userSelect: 'none',
  },
  statusBar: {
    position: 'fixed',
    top: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  statusText: {
    fontSize: 13,
    color: '#71717a',
    fontWeight: 300,
  },
  sphereContainer: {
    position: 'relative',
    width: 300,
    height: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  canvas: {
    display: 'block',
  },
  stateLabel: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: 400,
    letterSpacing: '0.05em',
    transition: 'color 0.5s ease',
  },
  textArea: {
    marginTop: 32,
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  transcriptBox: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: '12px 16px',
    borderLeft: '3px solid #3b82f6',
  },
  responseBox: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: '12px 16px',
    borderLeft: '3px solid #f59e0b',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: '12px 16px',
    borderLeft: '3px solid #ef4444',
  },
  textLabel: {
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#71717a',
    marginBottom: 4,
    display: 'block',
  },
  textContent: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 300,
    color: '#d4d4d8',
  },
}
