import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Webcam from 'react-webcam'
import { Hands, Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS } from '@mediapipe/hands'
import styles from '@/styles/HandTracking.module.css'

export default function HandTracking() {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [detectedGesture, setDetectedGesture] = useState<string>('None')
  const [handsCount, setHandsCount] = useState<number>(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setDevices(videoDevices)
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId)
        }
      } catch (error) {
        console.error('Error getting cameras:', error)
      }
    }
    getCameras()
  }, [])

  useEffect(() => {
    if (!isActive || !selectedDeviceId) return

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      }
    })

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    })

    hands.onResults(onResults)

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video) {
            await hands.send({ image: webcamRef.current.video })
          }
        },
        width: 1280,
        height: 720
      })
      camera.start()
      setIsLoading(false)
    }

    return () => {
      hands.close()
    }
  }, [isActive, selectedDeviceId])

  function onResults(results: Results) {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = results.image.width
    canvas.height = results.image.height

    // Clear canvas
    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw hand landmarks
    if (results.multiHandLandmarks) {
      setHandsCount(results.multiHandLandmarks.length)

      for (const landmarks of results.multiHandLandmarks) {
        // Draw connections (solid white lines)
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: '#ffffff',
          lineWidth: 2
        })

        // Draw landmarks (solid white dots)
        drawLandmarks(ctx, landmarks, {
          color: '#000000',
          fillColor: '#ffffff',
          lineWidth: 1,
          radius: 3
        })
      }

      // Detect gesture
      const gesture = detectGesture(results.multiHandLandmarks[0])
      setDetectedGesture(gesture)
    } else {
      setHandsCount(0)
      setDetectedGesture('None')
    }

    ctx.restore()
  }

  function detectGesture(landmarks: any): string {
    if (!landmarks) return 'None'

    // Simple gesture detection based on finger positions
    const thumbTip = landmarks[4]
    const indexTip = landmarks[8]
    const middleTip = landmarks[12]
    const ringTip = landmarks[16]
    const pinkyTip = landmarks[20]
    
    const indexBase = landmarks[5]
    const middleBase = landmarks[9]
    const ringBase = landmarks[13]
    const pinkyBase = landmarks[17]

    // Count extended fingers
    let extendedFingers = 0
    
    if (indexTip.y < indexBase.y) extendedFingers++
    if (middleTip.y < middleBase.y) extendedFingers++
    if (ringTip.y < ringBase.y) extendedFingers++
    if (pinkyTip.y < pinkyBase.y) extendedFingers++

    // Gesture recognition
    if (extendedFingers === 0) return 'Fist'
    if (extendedFingers === 1) return 'Pointing'
    if (extendedFingers === 2) return 'Peace Sign'
    if (extendedFingers === 3) return 'Three Fingers'
    if (extendedFingers === 4) return 'Open Hand'

    return 'Unknown'
  }

  return (
    <>
      <Head>
        <title>Hand Tracking - Real-time Detection</title>
        <meta name="description" content="Real-time hand tracking using MediaPipe AI" />
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Home
          </Link>
          <h1>Hand Tracking</h1>
        </header>

        {/* Main Content */}
        <div className={styles.content}>
          {/* Camera Container */}
          <div className={styles.cameraContainer}>
            {/* Camera Selection */}
            {!isActive && (
              <div className={styles.cameraSelection}>
                <label htmlFor="camera-select">Select Camera:</label>
                <select 
                  id="camera-select"
                  value={selectedDeviceId} 
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className={styles.cameraSelect}
                >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.videoWrapper}>
              {!isActive && (
                <div className={styles.placeholder}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <p>Select a camera and click "Start Tracking"</p>
                </div>
              )}
              
              {isActive && (
                <>
                  <Webcam
                    ref={webcamRef}
                    className={styles.webcam}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      width: 1280,
                      height: 720,
                      deviceId: selectedDeviceId
                    }}
                  />
                  <canvas ref={canvasRef} className={styles.canvas} />
                </>
              )}
            </div>

            {/* Controls */}
            <div className={styles.controls}>
              {!isActive ? (
                <button onClick={() => setIsActive(true)} className={styles.btnStart}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Tracking
                </button>
              ) : (
                <button onClick={() => setIsActive(false)} className={styles.btnStop}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                  Stop Tracking
                </button>
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className={styles.infoPanel}>
            <div className={styles.infoCard}>
              <h3>Status</h3>
              <div className={styles.statusIndicator}>
                <div className={isActive ? styles.statusActive : styles.statusInactive} />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className={styles.infoCard}>
              <h3>Hands Detected</h3>
              <div className={styles.statValue}>{handsCount}</div>
            </div>

            <div className={styles.infoCard}>
              <h3>Detected Gesture</h3>
              <div className={styles.gestureValue}>{detectedGesture}</div>
            </div>

            <div className={styles.infoCard}>
              <h3>Instructions</h3>
              <ul className={styles.instructions}>
                <li>Allow camera access when prompted</li>
                <li>Position your hand in front of the camera</li>
                <li>Try different gestures (fist, peace, open hand)</li>
                <li>Use 2 hands for multi-hand tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
