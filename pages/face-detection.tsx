import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Webcam from 'react-webcam'
import styles from '@/styles/FaceDetection.module.css'

// Dynamic import to avoid SSR issues
let FaceMesh: any
let Camera: any

if (typeof window !== 'undefined') {
  import('@mediapipe/face_mesh').then(module => {
    FaceMesh = module.FaceMesh
  })
  import('@mediapipe/camera_utils').then(module => {
    Camera = module.Camera
  })
}

export default function FaceDetection() {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [facesDetected, setFacesDetected] = useState(0)
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

    const faceMesh = new FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      }
    })

    faceMesh.setOptions({
      maxNumFaces: 2,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    faceMesh.onResults(onResults)

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video) {
            await faceMesh.send({ image: webcamRef.current.video })
          }
        },
        width: 1280,
        height: 720
      })
      camera.start()
    }

    return () => {
      faceMesh.close()
    }
  }, [isActive, selectedDeviceId])

  function onResults(results: any) {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = results.image.width
    canvas.height = results.image.height

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Mirror the canvas to match webcam
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)

    if (results.multiFaceLandmarks) {
      setFacesDetected(results.multiFaceLandmarks.length)

      for (const landmarks of results.multiFaceLandmarks) {
        // Get bounding box coordinates
        const xs = landmarks.map((l: any) => l.x)
        const ys = landmarks.map((l: any) => l.y)
        
        const minX = Math.min(...xs) * canvas.width
        const maxX = Math.max(...xs) * canvas.width
        const minY = Math.min(...ys) * canvas.height
        const maxY = Math.max(...ys) * canvas.height
        
        const width = maxX - minX
        const height = maxY - minY
        
        // Draw bounding box (thick border)
        ctx.strokeStyle = '#9cab84'
        ctx.lineWidth = 4
        ctx.strokeRect(minX, minY, width, height)
        
        // Draw corner markers (aesthetic)
        const cornerSize = 20
        ctx.strokeStyle = '#fd7979'
        ctx.lineWidth = 6
        
        // Top-left corner
        ctx.beginPath()
        ctx.moveTo(minX, minY + cornerSize)
        ctx.lineTo(minX, minY)
        ctx.lineTo(minX + cornerSize, minY)
        ctx.stroke()
        
        // Top-right corner
        ctx.beginPath()
        ctx.moveTo(maxX - cornerSize, minY)
        ctx.lineTo(maxX, minY)
        ctx.lineTo(maxX, minY + cornerSize)
        ctx.stroke()
        
        // Bottom-left corner
        ctx.beginPath()
        ctx.moveTo(minX, maxY - cornerSize)
        ctx.lineTo(minX, maxY)
        ctx.lineTo(minX + cornerSize, maxY)
        ctx.stroke()
        
        // Bottom-right corner
        ctx.beginPath()
        ctx.moveTo(maxX - cornerSize, maxY)
        ctx.lineTo(maxX, maxY)
        ctx.lineTo(maxX, maxY - cornerSize)
        ctx.stroke()
        
        // Draw label background
        ctx.fillStyle = '#9cab84'
        ctx.fillRect(minX, minY - 35, 120, 30)
        
        // Reset scale for text (unflip text)
        ctx.save()
        ctx.scale(-1, 1)
        
        // Draw label text (coordinates need to be negative because of scale)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 16px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('FACE DETECTED', -(minX + 60), minY - 12)
        
        ctx.restore()
      }
    } else {
      setFacesDetected(0)
    }

    ctx.restore()
  }

  return (
    <>
      <Head>
        <title>Face Detection - AI Vision Studio</title>
        <meta name="description" content="Real-time face detection with 468 landmarks" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back</Link>
          <h1>Face Detection</h1>
        </header>

        <div className={styles.content}>
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
                  <p>Select a camera and click "Start Detection"</p>
                </div>
              )}
              
              {isActive && (
                <>
                  <Webcam
                    ref={webcamRef}
                    className={styles.webcam}
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

            <div className={styles.controls}>
              {!isActive ? (
                <button onClick={() => setIsActive(true)} className={styles.btnStart}>
                  ▶ Start Detection
                </button>
              ) : (
                <button onClick={() => setIsActive(false)} className={styles.btnStop}>
                  ■ Stop Detection
                </button>
              )}
            </div>
          </div>

          <div className={styles.infoPanel}>
            <div className={styles.infoCard}>
              <h3>Status</h3>
              <div className={styles.status}>
                <div className={isActive ? styles.activeIndicator : styles.inactiveIndicator} />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className={styles.infoCard}>
              <h3>Faces Detected</h3>
              <div className={styles.statValue}>{facesDetected}</div>
            </div>

            <div className={styles.infoCard}>
              <h3>Landmarks</h3>
              <div className={styles.statValue}>468</div>
              <p className={styles.small}>points per face</p>
            </div>

            <div className={styles.infoCard}>
              <h3>Info</h3>
              <ul className={styles.infoList}>
                <li>468 facial landmarks</li>
                <li>Deteksi hingga 2 wajah</li>
                <li>Real-time processing</li>
                <li>Akurasi tinggi</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
