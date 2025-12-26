import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Webcam from 'react-webcam'
import { Hands } from '@mediapipe/hands'
import { FaceMesh } from '@mediapipe/face_mesh'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS } from '@mediapipe/hands'
import { POSE_CONNECTIONS } from '@mediapipe/pose'
import styles from '@/styles/AllInOne.module.css'

export default function AllInOne() {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  
  // Detection states
  const [handsDetected, setHandsDetected] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [emotion, setEmotion] = useState<string>('Neutral')
  const [poseDetected, setPoseDetected] = useState(false)
  const [gesture, setGesture] = useState<string>('None')

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

    let handsInstance: Hands | null = null
    let faceMeshInstance: FaceMesh | null = null
    let poseInstance: Pose | null = null
    let cameraInstance: Camera | null = null

    const init = async () => {
      // Initialize Hands
      handsInstance = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      })
      handsInstance.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      })

      // Initialize Face Mesh
      faceMeshInstance = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      })
      faceMeshInstance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      // Initialize Pose
      poseInstance = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      })
      poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      // Combined results handler
      let handResults: any = null
      let faceResults: any = null
      let poseResults: any = null

      handsInstance.onResults((results) => {
        handResults = results
        drawCombined()
      })

      faceMeshInstance.onResults((results) => {
        faceResults = results
        drawCombined()
      })

      poseInstance.onResults((results) => {
        poseResults = results
        drawCombined()
      })

      function drawCombined() {
        if (!canvasRef.current || !webcamRef.current?.video) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const video = webcamRef.current.video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)

        // Draw Pose (skeleton)
        if (poseResults?.poseLandmarks) {
          setPoseDetected(true)
          drawConnectors(ctx, poseResults.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00ff00',
            lineWidth: 2
          })
          drawLandmarks(ctx, poseResults.poseLandmarks, {
            color: '#ff0000',
            lineWidth: 1,
            radius: 3
          })
        } else {
          setPoseDetected(false)
        }

        // Draw Face (bounding box + expression)
        if (faceResults?.multiFaceLandmarks && faceResults.multiFaceLandmarks.length > 0) {
          setFaceDetected(true)
          const landmarks = faceResults.multiFaceLandmarks[0]
          
          // Detect emotion
          const detectedEmotion = detectEmotion(landmarks)
          setEmotion(detectedEmotion)

          // Draw face box
          const xs = landmarks.map((l: any) => l.x)
          const ys = landmarks.map((l: any) => l.y)
          const minX = Math.min(...xs) * canvas.width
          const maxX = Math.max(...xs) * canvas.width
          const minY = Math.min(...ys) * canvas.height
          const maxY = Math.max(...ys) * canvas.height

          // Color based on emotion
          let color = '#9cab84'
          if (detectedEmotion === 'Happy') color = '#c5d89d'
          else if (detectedEmotion === 'Sad') color = '#89986d'
          else if (detectedEmotion === 'Angry') color = '#fd7979'
          else if (detectedEmotion === 'Surprised') color = '#ffcdc9'

          ctx.strokeStyle = color
          ctx.lineWidth = 3
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)

          // Label
          ctx.fillStyle = color
          ctx.fillRect(minX, minY - 30, 150, 25)
          
          ctx.save()
          ctx.scale(-1, 1)
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 14px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(detectedEmotion, -(minX + 75), minY - 10)
          ctx.restore()
        } else {
          setFaceDetected(false)
          setEmotion('None')
        }

        // Draw Hands (landmarks + gesture)
        if (handResults?.multiHandLandmarks) {
          setHandsDetected(handResults.multiHandLandmarks.length)
          
          for (const landmarks of handResults.multiHandLandmarks) {
            // Draw hand skeleton
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
              color: '#00ffff',
              lineWidth: 3
            })
            drawLandmarks(ctx, landmarks, {
              color: '#ff00ff',
              lineWidth: 2,
              radius: 4
            })

            // Detect gesture
            const detectedGesture = detectGesture(landmarks)
            setGesture(detectedGesture)

            // Draw gesture label
            const wrist = landmarks[0]
            const x = wrist.x * canvas.width
            const y = wrist.y * canvas.height

            ctx.fillStyle = '#00ffff'
            ctx.fillRect(x - 50, y - 40, 100, 30)
            
            ctx.save()
            ctx.scale(-1, 1)
            ctx.fillStyle = '#000000'
            ctx.font = 'bold 14px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(detectedGesture, -x, y - 18)
            ctx.restore()
          }
        } else {
          setHandsDetected(0)
          setGesture('None')
        }

        ctx.restore()
      }

      // Start camera
      if (webcamRef.current && webcamRef.current.video) {
        cameraInstance = new Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (webcamRef.current && webcamRef.current.video) {
              const video = webcamRef.current.video
              await Promise.all([
                handsInstance!.send({ image: video }),
                faceMeshInstance!.send({ image: video }),
                poseInstance!.send({ image: video })
              ])
            }
          },
          width: 1280,
          height: 720
        })
        cameraInstance.start()
      }
    }

    init()

    return () => {
      handsInstance?.close()
      faceMeshInstance?.close()
      poseInstance?.close()
      cameraInstance?.stop()
    }
  }, [isActive, selectedDeviceId])

  function detectEmotion(landmarks: any): string {
    if (!landmarks || landmarks.length < 468) return 'Neutral'

    const leftEyeUpper = landmarks[159]
    const leftEyeLower = landmarks[145]
    const rightEyeUpper = landmarks[386]
    const rightEyeLower = landmarks[374]
    const leftEyebrowInner = landmarks[107]
    const rightEyebrowInner = landmarks[336]
    const leftMouthCorner = landmarks[61]
    const rightMouthCorner = landmarks[291]
    const upperLip = landmarks[13]
    const lowerLip = landmarks[14]

    // EAR & MAR calculation
    const earLeft = Math.abs(leftEyeUpper.y - leftEyeLower.y) / Math.abs(landmarks[33].x - landmarks[133].x)
    const earRight = Math.abs(rightEyeUpper.y - rightEyeLower.y) / Math.abs(landmarks[362].x - landmarks[263].x)
    const avgEAR = (earLeft + earRight) / 2

    const mouthHeight = Math.abs(upperLip.y - lowerLip.y)
    const mouthWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x)
    const MAR = mouthHeight / (mouthWidth + 0.001)

    const smileRatio = upperLip.y - (leftMouthCorner.y + rightMouthCorner.y) / 2
    const avgBrowRaise = ((leftEyeUpper.y - leftEyebrowInner.y) + (rightEyeUpper.y - rightEyebrowInner.y)) / 2
    const browDistance = Math.abs(leftEyebrowInner.x - rightEyebrowInner.x)

    // Tongue detection
    const tongueTip = landmarks[13]
    const tongueOut = Math.abs(tongueTip.y - lowerLip.y)

    // Emotion detection - Intuitive logic
    if (avgEAR > 0.22 && MAR > 0.45 && avgBrowRaise > 0.025) return 'Surprised'
    else if (avgEAR > 0.24 && avgBrowRaise > 0.028 && MAR > 0.25 && MAR < 0.55) return 'Fear'
    else if (avgEAR > 0.20 && MAR < 0.25 && smileRatio < 0.005) return 'Angry'
    else if (avgEAR < 0.17) return 'Sad'
    else if (smileRatio > 0.007 && MAR < 0.4) return 'Happy'
    else if (MAR > 0.3 && tongueOut > 0.01) return 'Disgust'
    else return 'Neutral'
  }

  function detectGesture(landmarks: any): string {
    const fingers = []
    
    // Thumb
    fingers.push(landmarks[4].x < landmarks[3].x)
    // Other fingers
    for (let i = 0; i < 4; i++) {
      fingers.push(landmarks[8 + i * 4].y < landmarks[6 + i * 4].y)
    }

    const count = fingers.filter(Boolean).length

    if (count === 0) return 'Fist'
    else if (count === 2 && fingers[1] && fingers[2]) return 'Peace'
    else if (count === 1 && fingers[1]) return 'Pointing'
    else if (count === 3) return 'Three'
    else if (count === 5) return 'Open Hand'
    else return 'Gesture'
  }

  return (
    <>
      <Head>
        <title>All-in-One Detection - AI Vision Studio</title>
        <meta name="description" content="Real-time Hand + Face + Expression + Pose detection" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back</Link>
          <h1>All-in-One Detection</h1>
        </header>

        <div className={styles.content}>
          <div className={styles.cameraContainer}>
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
                  ▶ Start All Detection
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
              <h3>👋 Hands</h3>
              <div className={styles.statValue}>{handsDetected}</div>
              <div className={styles.gesture}>Gesture: {gesture}</div>
            </div>

            <div className={styles.infoCard}>
              <h3>😊 Face</h3>
              <div className={styles.statValue}>{faceDetected ? '✓' : '✗'}</div>
              <div className={styles.emotion}>Emotion: {emotion}</div>
            </div>

            <div className={styles.infoCard}>
              <h3>🚶 Pose</h3>
              <div className={styles.statValue}>{poseDetected ? '✓' : '✗'}</div>
              <div className={styles.info}>Full Body Tracking</div>
            </div>

            <div className={styles.infoCard}>
              <h3>ℹ️ Features</h3>
              <ul className={styles.featureList}>
                <li>Hand tracking (21 landmarks)</li>
                <li>Face detection (468 landmarks)</li>
                <li>Emotion recognition (6 emotions)</li>
                <li>Pose detection (33 landmarks)</li>
                <li>Gesture recognition (5 gestures)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
