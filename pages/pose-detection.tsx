import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Webcam from 'react-webcam'
import { Pose, Results } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { POSE_CONNECTIONS } from '@mediapipe/pose'
import styles from '@/styles/PoseDetection.module.css'

export default function PoseDetection() {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [poseDetected, setPoseDetected] = useState(false)
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

    const pose = new Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      }
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    pose.onResults(onResults)

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video) {
            await pose.send({ image: webcamRef.current.video })
          }
        },
        width: 1280,
        height: 720
      })
      camera.start()
    }

    return () => {
      pose.close()
    }
  }, [isActive, selectedDeviceId])

  function onResults(results: Results) {
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

    if (results.poseLandmarks) {
      setPoseDetected(true)

      // Draw pose connections (skeleton)
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#00ff00',
        lineWidth: 4
      })

      // Draw landmarks (joints)
      drawLandmarks(ctx, results.poseLandmarks, {
        color: '#ff0000',
        lineWidth: 2,
        radius: 6
      })

      // Draw status label
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(20, 20, 150, 40)
      
      // Reset scale for text (unflip text)
      ctx.save()
      ctx.scale(-1, 1)
      
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('POSE DETECTED', -95, 47)
      
      ctx.restore()
    } else {
      setPoseDetected(false)
    }

    ctx.restore()
  }

  return (
    <>
      <Head>
        <title>Pose Detection - AI Vision Studio</title>
        <meta name="description" content="Real-time body pose detection with 33 landmarks" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back</Link>
          <h1>Pose Detection</h1>
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
              <div className={poseDetected ? styles.statusActive : styles.statusInactive}>
                {poseDetected ? '● Active' : '○ Inactive'}
              </div>
            </div>

            <div className={styles.infoCard}>
              <h3>Landmarks</h3>
              <p className={styles.landmarkCount}>33 points per pose</p>
            </div>

            <div className={styles.infoCard}>
              <h3>Body Parts Detected</h3>
              <ul className={styles.bodyPartsList}>
                <li>🟢 Face (nose, eyes, ears, mouth)</li>
                <li>🟢 Upper Body (shoulders, elbows, wrists)</li>
                <li>🟢 Core (hips)</li>
                <li>🟢 Lower Body (knees, ankles, feet)</li>
              </ul>
            </div>

            <div className={styles.infoCard}>
              <h3>Info</h3>
              <ul className={styles.infoList}>
                <li>33 pose landmarks</li>
                <li>Real-time tracking</li>
                <li>Full body detection</li>
                <li>High accuracy</li>
              </ul>
            </div>

            <div className={styles.infoCard}>
              <h3>Tips</h3>
              <ul className={styles.tipsList}>
                <li>Berdiri di depan kamera</li>
                <li>Pastikan seluruh tubuh terlihat</li>
                <li>Gunakan pencahayaan yang baik</li>
                <li>Hindari background yang ramai</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
