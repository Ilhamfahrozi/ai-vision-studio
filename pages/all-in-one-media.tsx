import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Webcam from 'react-webcam'
import styles from '@/styles/AllInOneMedia.module.css'

// Dynamic import to avoid SSR issues
let Hands: any
let FaceMesh: any
let Pose: any
let Camera: any
let drawConnectors: any
let drawLandmarks: any
let HAND_CONNECTIONS: any
let POSE_CONNECTIONS: any

if (typeof window !== 'undefined') {
  import('@mediapipe/hands').then(module => {
    Hands = module.Hands
    HAND_CONNECTIONS = module.HAND_CONNECTIONS
  })
  import('@mediapipe/face_mesh').then(module => {
    FaceMesh = module.FaceMesh
  })
  import('@mediapipe/pose').then(module => {
    Pose = module.Pose
    POSE_CONNECTIONS = module.POSE_CONNECTIONS
  })
  import('@mediapipe/camera_utils').then(module => {
    Camera = module.Camera
  })
  import('@mediapipe/drawing_utils').then(module => {
    drawConnectors = module.drawConnectors
    drawLandmarks = module.drawLandmarks
  })
}

export default function AllInOneMedia() {
  // Left Panel - Camera
  const webcamRef = useRef<Webcam>(null)
  const canvasLeftRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  
  // Right Panel - Media Upload
  const canvasRightRef = useRef<HTMLCanvasElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null)
  const [audioFile, setAudioFile] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Detection states
  const [leftStats, setLeftStats] = useState({ hands: 0, face: false, pose: false, emotion: 'None', gesture: 'None' })
  const [rightStats, setRightStats] = useState({ hands: 0, face: false, pose: false, emotion: 'None', gesture: 'None' })

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

  // Left Panel - Real-time Camera Detection
  useEffect(() => {
    if (!isActive || !selectedDeviceId) return

    let handsInstance: any = null
    let faceMeshInstance: any = null
    let poseInstance: any = null
    let cameraInstance: any = null

    const init = async () => {
      handsInstance = new Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      })
      handsInstance.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      })

      faceMeshInstance = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      })
      faceMeshInstance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      poseInstance = new Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      })
      poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      let handResults: any = null
      let faceResults: any = null
      let poseResults: any = null

      handsInstance.onResults((results: any) => {
        handResults = results
        drawCombinedLeft()
      })

      faceMeshInstance.onResults((results: any) => {
        faceResults = results
        drawCombinedLeft()
      })

      poseInstance.onResults((results: any) => {
        poseResults = results
        drawCombinedLeft()
      })

      function drawCombinedLeft() {
        if (!canvasLeftRef.current || !webcamRef.current?.video) return

        const canvas = canvasLeftRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const video = webcamRef.current.video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)

        let stats = { hands: 0, face: false, pose: false, emotion: 'None', gesture: 'None' }

        // Draw Pose
        if (poseResults?.poseLandmarks) {
          stats.pose = true
          drawConnectors(ctx, poseResults.poseLandmarks, POSE_CONNECTIONS, { color: '#00ff00', lineWidth: 2 })
          drawLandmarks(ctx, poseResults.poseLandmarks, { color: '#ff0000', lineWidth: 1, radius: 3 })
        }

        // Draw Face
        if (faceResults?.multiFaceLandmarks && faceResults.multiFaceLandmarks.length > 0) {
          stats.face = true
          const landmarks = faceResults.multiFaceLandmarks[0]
          const emotion = detectEmotion(landmarks)
          stats.emotion = emotion

          const xs = landmarks.map((l: any) => l.x)
          const ys = landmarks.map((l: any) => l.y)
          const minX = Math.min(...xs) * canvas.width
          const maxX = Math.max(...xs) * canvas.width
          const minY = Math.min(...ys) * canvas.height
          const maxY = Math.max(...ys) * canvas.height

          let color = getEmotionColor(emotion)
          ctx.strokeStyle = color
          ctx.lineWidth = 3
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)

          ctx.fillStyle = color
          ctx.fillRect(minX, minY - 30, 150, 25)
          
          ctx.save()
          ctx.scale(-1, 1)
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 14px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(emotion, -(minX + 75), minY - 10)
          ctx.restore()
        }

        // Draw Hands
        if (handResults?.multiHandLandmarks) {
          stats.hands = handResults.multiHandLandmarks.length
          
          for (const landmarks of handResults.multiHandLandmarks) {
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00ffff', lineWidth: 3 })
            drawLandmarks(ctx, landmarks, { color: '#ff00ff', lineWidth: 2, radius: 4 })

            const gesture = detectGesture(landmarks)
            stats.gesture = gesture

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
            ctx.fillText(gesture, -x, y - 18)
            ctx.restore()
          }
        }

        ctx.restore()
        setLeftStats(stats)
      }

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

  // Right Panel - Process Uploaded Image
  const processUploadedImage = async (img: HTMLImageElement) => {
    if (!canvasRightRef.current) return
    
    setIsProcessing(true)

    const canvas = canvasRightRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img.width
    canvas.height = img.height

    // Draw image
    ctx.drawImage(img, 0, 0)

    // Initialize MediaPipe for static image
    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    })
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    const faceMesh = new FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    })
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    const pose = new Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    })
    pose.setOptions({
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    let stats = { hands: 0, face: false, pose: false, emotion: 'None', gesture: 'None' }

    // Process all detections
    hands.onResults((results: any) => {
      if (results.multiHandLandmarks) {
        stats.hands = results.multiHandLandmarks.length
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00ffff', lineWidth: 3 })
          drawLandmarks(ctx, landmarks, { color: '#ff00ff', lineWidth: 2, radius: 4 })
          stats.gesture = detectGesture(landmarks)
        }
      }
    })

    faceMesh.onResults((results: any) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        stats.face = true
        const landmarks = results.multiFaceLandmarks[0]
        stats.emotion = detectEmotion(landmarks)

        const xs = landmarks.map((l: any) => l.x)
        const ys = landmarks.map((l: any) => l.y)
        const minX = Math.min(...xs) * canvas.width
        const maxX = Math.max(...xs) * canvas.width
        const minY = Math.min(...ys) * canvas.height
        const maxY = Math.max(...ys) * canvas.height

        let color = getEmotionColor(stats.emotion)
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)

        ctx.fillStyle = color
        ctx.fillRect(minX, minY - 30, 150, 25)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(stats.emotion, minX + 75, minY - 10)
      }
      setRightStats(stats)
    })

    pose.onResults((results: any) => {
      if (results.poseLandmarks) {
        stats.pose = true
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00ff00', lineWidth: 2 })
        drawLandmarks(ctx, results.poseLandmarks, { color: '#ff0000', lineWidth: 1, radius: 3 })
      }
      setRightStats(stats)
      setIsProcessing(false)
    })

    await Promise.all([
      hands.send({ image: img }),
      faceMesh.send({ image: img }),
      pose.send({ image: img })
    ])
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        setUploadedImage(img)
        processUploadedImage(img)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setAudioFile(url)
  }

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
    fingers.push(landmarks[4].x < landmarks[3].x)
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

  function getEmotionColor(emotion: string): string {
    switch(emotion) {
      case 'Happy': return '#c5d89d'
      case 'Sad': return '#89986d'
      case 'Angry': return '#fd7979'
      case 'Surprised': return '#ffcdc9'
      case 'Fear': return '#fdacac'
      case 'Disgust': return '#feeac9'
      default: return '#9cab84'
    }
  }

  return (
    <>
      <Head>
        <title>All-in-One Media - AI Vision Studio</title>
        <meta name="description" content="Real-time + Media Upload Detection" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back</Link>
          <h1>All-in-One Media Detection</h1>
        </header>

        <div className={styles.content}>
          {/* LEFT PANEL - Real-time Camera */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>📹 Real-time Camera</h2>
            
            <div className={styles.cameraContainer}>
              {!isActive && (
                <div className={styles.cameraSelection}>
                  <label>Select Camera:</label>
                  <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} className={styles.cameraSelect}>
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
                    <p>Select camera and click Start</p>
                  </div>
                )}
                
                {isActive && (
                  <>
                    <Webcam ref={webcamRef} className={styles.webcam} videoConstraints={{ width: 1280, height: 720, deviceId: selectedDeviceId }} />
                    <canvas ref={canvasLeftRef} className={styles.canvas} />
                  </>
                )}
              </div>

              <div className={styles.controls}>
                {!isActive ? (
                  <button onClick={() => setIsActive(true)} className={styles.btnStart}>▶ Start Camera</button>
                ) : (
                  <button onClick={() => setIsActive(false)} className={styles.btnStop}>■ Stop Camera</button>
                )}
              </div>
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>👋 Hands: {leftStats.hands}</div>
              <div className={styles.stat}>😊 Face: {leftStats.face ? '✓' : '✗'}</div>
              <div className={styles.stat}>🚶 Pose: {leftStats.pose ? '✓' : '✗'}</div>
              <div className={styles.stat}>🎭 Emotion: {leftStats.emotion}</div>
              <div className={styles.stat}>✋ Gesture: {leftStats.gesture}</div>
            </div>
          </div>

          {/* RIGHT PANEL - Media Upload */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>📤 Upload Media</h2>
            
            <div className={styles.uploadContainer}>
              <div className={styles.uploadBox}>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className={styles.fileInput} id="image-upload" />
                <label htmlFor="image-upload" className={styles.uploadLabel}>
                  <span className={styles.uploadIcon}>🖼️</span>
                  <span>Upload Image</span>
                </label>
              </div>

              <div className={styles.uploadBox}>
                <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className={styles.fileInput} id="audio-upload" />
                <label htmlFor="audio-upload" className={styles.uploadLabel}>
                  <span className={styles.uploadIcon}>🎵</span>
                  <span>Upload Audio</span>
                </label>
              </div>
            </div>

            <div className={styles.outputWrapper}>
              {!uploadedImage && (
                <div className={styles.placeholder}>
                  <p>Upload an image to detect</p>
                </div>
              )}
              
              {uploadedImage && (
                <canvas ref={canvasRightRef} className={styles.outputCanvas} />
              )}
              
              {isProcessing && (
                <div className={styles.processing}>Processing...</div>
              )}
            </div>

            {audioFile && (
              <div className={styles.audioPlayer}>
                <audio controls src={audioFile} className={styles.audio}>
                  Your browser does not support audio.
                </audio>
              </div>
            )}

            <div className={styles.stats}>
              <div className={styles.stat}>👋 Hands: {rightStats.hands}</div>
              <div className={styles.stat}>😊 Face: {rightStats.face ? '✓' : '✗'}</div>
              <div className={styles.stat}>🚶 Pose: {rightStats.pose ? '✓' : '✗'}</div>
              <div className={styles.stat}>🎭 Emotion: {rightStats.emotion}</div>
              <div className={styles.stat}>✋ Gesture: {rightStats.gesture}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
