import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Webcam from 'react-webcam'
import styles from '@/styles/YourFree.module.css'
import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore'

// Dynamic import to avoid SSR issues
let Hands: any
let FaceMesh: any
let Camera: any
let drawConnectors: any
let drawLandmarks: any
let HAND_CONNECTIONS: any

if (typeof window !== 'undefined') {
  import('@mediapipe/hands').then(module => {
    Hands = module.Hands
    HAND_CONNECTIONS = module.HAND_CONNECTIONS
  })
  import('@mediapipe/face_mesh').then(module => {
    FaceMesh = module.FaceMesh
  })
  import('@mediapipe/camera_utils').then(module => {
    Camera = module.Camera
  })
  import('@mediapipe/drawing_utils').then(module => {
    drawConnectors = module.drawConnectors
    drawLandmarks = module.drawLandmarks
  })
}

interface YourFreeProps {
  onBack: () => void
}

interface CustomTrigger {
  id: string
  userId: string
  name: string
  imageBase64: string
  audioBase64: string
  facePattern: string
  handPattern: string
  createdAt: Date
}

export default function YourFree({ onBack }: YourFreeProps) {
  const { user } = useAuth()
  const webcamRef = useRef<Webcam>(null)
  const canvasLeftRef = useRef<HTMLCanvasElement>(null)
  const canvasRightRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  
  const [isActive, setIsActive] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  
  const [currentEmotion, setCurrentEmotion] = useState<string>('None')
  const [currentGesture, setCurrentGesture] = useState<string>('None')
  const [outputImage, setOutputImage] = useState<string | null>(null)
  const [outputAudio, setOutputAudio] = useState<string | null>(null)
  
  // Upload states
  const [uploadedImage, setUploadedImage] = useState<string>('')
  const [uploadedAudio, setUploadedAudio] = useState<string>('')
  const [triggerFace, setTriggerFace] = useState<string>('Happy')
  const [triggerHand, setTriggerHand] = useState<string>('None')
  const [triggerName, setTriggerName] = useState<string>('')
  
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  
  // User's custom triggers from Firestore
  const [customTriggers, setCustomTriggers] = useState<CustomTrigger[]>([])

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
  
  // Load user's custom triggers
  useEffect(() => {
    if (user) {
      loadCustomTriggers()
    }
  }, [user])
  
  const loadCustomTriggers = async () => {
    if (!user) return
    
    try {
      const q = query(
        collection(db, 'customTriggers'),
        where('userId', '==', user.uid)
      )
      const snapshot = await getDocs(q)
      const triggers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as CustomTrigger[]
      
      setCustomTriggers(triggers)
      console.log('✅ Loaded custom triggers:', triggers.length)
    } catch (err) {
      console.error('Error loading triggers:', err)
    }
  }

  // Detect emotion from face
  function detectEmotion(landmarks: any[]): string {
    if (!landmarks || landmarks.length < 468) return 'Neutral'
    
    const leftEyeUpper = landmarks[159]
    const leftEyeLower = landmarks[145]
    const rightEyeUpper = landmarks[386]
    const rightEyeLower = landmarks[374]
    
    const leftMouthCorner = landmarks[61]
    const rightMouthCorner = landmarks[291]
    const upperLip = landmarks[13]
    const lowerLip = landmarks[14]
    
    const leftEyeHeight = Math.abs(leftEyeUpper.y - leftEyeLower.y)
    const rightEyeHeight = Math.abs(rightEyeUpper.y - rightEyeLower.y)
    const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2
    
    const mouthWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x)
    const mouthHeight = Math.abs(upperLip.y - lowerLip.y)
    
    const mouthLeftCurve = leftMouthCorner.y - upperLip.y
    const mouthRightCurve = rightMouthCorner.y - upperLip.y
    const smileIntensity = (mouthLeftCurve + mouthRightCurve) / 2
    
    // Emotion detection logic
    if (avgEyeHeight > 0.03 && mouthHeight > 0.05) {
      return 'Surprised'
    }
    
    if (smileIntensity < -0.02) {
      return 'Happy'
    }
    
    if (smileIntensity > 0.015 && mouthHeight < 0.02) {
      return 'Sad'
    }
    
    if (smileIntensity > 0.01 && avgEyeHeight < 0.015) {
      return 'Angry'
    }
    
    if (avgEyeHeight > 0.025) {
      return 'Fear'
    }
    
    return 'Neutral'
  }

  // Detect hand gesture
  function detectGesture(landmarks: any): string {
    if (!landmarks || landmarks.length !== 21) return 'None'
    
    const fingers = {
      thumb: landmarks[4].y < landmarks[3].y,
      index: landmarks[8].y < landmarks[6].y,
      middle: landmarks[12].y < landmarks[10].y,
      ring: landmarks[16].y < landmarks[14].y,
      pinky: landmarks[20].y < landmarks[18].y
    }
    
    const extendedCount = Object.values(fingers).filter(Boolean).length
    
    if (extendedCount === 0) return 'Fist'
    if (fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) return 'Thumbs Up'
    if (!fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) return 'Peace'
    if (!fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) return 'Pointing'
    if (extendedCount === 5) return 'Open Hand'
    if (fingers.thumb && fingers.index && fingers.pinky && !fingers.middle && !fingers.ring) return 'Three'
    
    return 'None'
  }

  // Check for matching trigger
  const checkTrigger = (emotion: string, gesture: string) => {
    const match = customTriggers.find(
      t => t.facePattern === emotion && t.handPattern === gesture
    )
    
    if (match) {
      console.log('🎯 Trigger matched:', match.name)
      setOutputImage(match.imageBase64)
      setOutputAudio(match.audioBase64)
      
      // Play audio
      if (audioRef.current && match.audioBase64) {
        audioRef.current.src = match.audioBase64
        audioRef.current.play().catch(err => console.log('Audio play error:', err))
      }
    } else {
      setOutputImage(null)
      setOutputAudio(null)
    }
  }

  // MediaPipe setup
  useEffect(() => {
    if (!isActive) return

    let handsInstance: any
    let faceMeshInstance: any

    const onFaceResults = (results: any) => {
      const canvasLeft = canvasLeftRef.current
      if (!canvasLeft) return
      
      const ctx = canvasLeft.getContext('2d')
      if (!ctx) return

      canvasLeft.width = results.image.width
      canvasLeft.height = results.image.height

      ctx.save()
      ctx.clearRect(0, 0, canvasLeft.width, canvasLeft.height)
      ctx.drawImage(results.image, 0, 0, canvasLeft.width, canvasLeft.height)

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0]
        const emotion = detectEmotion(landmarks)
        setCurrentEmotion(emotion)
        
        // Draw face landmarks
        if (drawConnectors && drawLandmarks) {
          drawConnectors(ctx, landmarks, (window as any).FACEMESH_TESSELATION, { color: '#00ff00', lineWidth: 0.5 })
        }
        
        // Draw emotion label
        ctx.font = 'bold 24px Arial'
        ctx.fillStyle = '#00ff00'
        ctx.fillText(`Face: ${emotion}`, 10, 30)
      }

      ctx.restore()
    }

    const onHandsResults = (results: any) => {
      const canvasRight = canvasRightRef.current
      if (!canvasRight) return
      
      const ctx = canvasRight.getContext('2d')
      if (!ctx) return

      canvasRight.width = results.image.width
      canvasRight.height = results.image.height

      ctx.save()
      ctx.clearRect(0, 0, canvasRight.width, canvasRight.height)
      ctx.drawImage(results.image, 0, 0, canvasRight.width, canvasRight.height)

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0]
        const gesture = detectGesture(landmarks)
        setCurrentGesture(gesture)
        
        // Draw hand landmarks
        if (drawConnectors && drawLandmarks && HAND_CONNECTIONS) {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#0088ff', lineWidth: 2 })
          drawLandmarks(ctx, landmarks, { color: '#ff0000', lineWidth: 1, radius: 3 })
        }
        
        // Draw gesture label
        ctx.font = 'bold 24px Arial'
        ctx.fillStyle = '#0088ff'
        ctx.fillText(`Hand: ${gesture}`, 10, 30)
      } else {
        setCurrentGesture('None')
      }

      ctx.restore()
    }

    const initMediaPipe = async () => {
      if (typeof window === 'undefined') return

      // Face Mesh
      faceMeshInstance = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      })
      faceMeshInstance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
      faceMeshInstance.onResults(onFaceResults)

      // Hands
      handsInstance = new Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      })
      handsInstance.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
      handsInstance.onResults(onHandsResults)

      if (webcamRef.current && webcamRef.current.video) {
        const cameraFace = new Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (webcamRef.current && webcamRef.current.video) {
              await faceMeshInstance.send({ image: webcamRef.current.video })
              await handsInstance.send({ image: webcamRef.current.video })
            }
          },
          width: 640,
          height: 480
        })
        cameraFace.start()
      }
    }

    initMediaPipe()

    return () => {
      if (handsInstance) handsInstance.close()
      if (faceMeshInstance) faceMeshInstance.close()
    }
  }, [isActive, selectedDeviceId])
  
  // Check trigger when emotion or gesture changes
  useEffect(() => {
    if (currentEmotion !== 'None' && currentGesture !== 'None') {
      checkTrigger(currentEmotion, currentGesture)
    }
  }, [currentEmotion, currentGesture, customTriggers])

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedImage(reader.result as string)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  // Handle audio upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Audio must be less than 5MB')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedAudio(reader.result as string)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  // Save trigger
  const handleSaveTrigger = async () => {
    if (!user) {
      setError('You must be logged in')
      return
    }
    
    if (!triggerName || !uploadedImage || !uploadedAudio) {
      setError('Please fill all fields and upload both image and audio')
      return
    }
    
    try {
      await addDoc(collection(db, 'customTriggers'), {
        userId: user.uid,
        name: triggerName,
        imageBase64: uploadedImage,
        audioBase64: uploadedAudio,
        facePattern: triggerFace,
        handPattern: triggerHand,
        createdAt: new Date()
      })
      
      setMessage('✅ Trigger saved successfully!')
      setTriggerName('')
      setUploadedImage('')
      setUploadedAudio('')
      setTriggerFace('Happy')
      setTriggerHand('None')
      
      await loadCustomTriggers()
      
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error saving trigger:', err)
      setError(`Failed to save: ${err.message}`)
    }
  }

  return (
    <>
      <Head>
        <title>Your Free - AI Vision Studio</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backButton}>← Back to Selection</button>
          <h1>Your Free - Custom Triggers</h1>
        </div>

        <div className={styles.content}>
          {/* LEFT PANEL - Camera Input */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>CAMERA INPUT</h2>
            
            <div className={styles.cameraContainer}>
              <div className={styles.cameraSelection}>
                <label>Pilih Kamera:</label>
                <select 
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

              {isActive && (
                <div className={styles.webcamWrapper}>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    videoConstraints={{ deviceId: selectedDeviceId }}
                    className={styles.webcam}
                    mirrored={true}
                  />
                  <canvas ref={canvasLeftRef} className={styles.canvas} />
                  <canvas ref={canvasRightRef} className={styles.canvas} />
                </div>
              )}

              {!isActive && (
                <div className={styles.placeholder}>
                  <p>KLIK START UNTUK MEMULAI DETEKSI</p>
                </div>
              )}
            </div>

            <div className={styles.controls}>
              {!isActive ? (
                <button onClick={() => setIsActive(true)} className={styles.btnStart}>
                  START
                </button>
              ) : (
                <button onClick={() => setIsActive(false)} className={styles.btnStop}>
                  STOP
                </button>
              )}
            </div>

            <div className={styles.stats}>
              <div className={styles.statBox}>
                <strong>Face Expression:</strong>
                <p>{currentEmotion}</p>
              </div>
              <div className={styles.statBox}>
                <strong>Hand Gesture:</strong>
                <p>{currentGesture}</p>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Output Display */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>OUTPUT DISPLAY</h2>
            
            <div className={styles.outputContainer}>
              {outputImage && outputAudio ? (
                <>
                  <img src={outputImage} alt="Output" className={styles.outputImage} />
                  <audio ref={audioRef} src={outputAudio} style={{ display: 'none' }} />
                </>
              ) : (
                <div className={styles.outputPlaceholder}>
                  <p>KOMBINASI EKSPRESI + GESTURE AKAN MUNCUL DI SINI</p>
                </div>
              )}
            </div>

            <div className={styles.infoContainer}>
              {outputImage && (
                <div className={styles.infoBox}>
                  <strong>Output:</strong>
                  <p>GAMBAR & AUDIO AKTIF</p>
                </div>
              )}
              {!outputImage && currentEmotion !== 'None' && currentGesture !== 'None' && (
                <div className={styles.infoBox}>
                  <strong>Status:</strong>
                  <p>TIDAK ADA TRIGGER UNTUK KOMBINASI INI</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* UPLOAD SECTION - Below the panels */}
        <div className={styles.uploadPanel}>
          <h2>📤 Upload Custom Trigger</h2>
          
          {message && <div className={styles.successMessage}>{message}</div>}
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <div className={styles.uploadGrid}>
            <div className={styles.uploadBox}>
              <label>Trigger Name:</label>
              <input
                type="text"
                value={triggerName}
                onChange={(e) => setTriggerName(e.target.value)}
                placeholder="E.g., Happy Dance"
                className={styles.uploadInput}
              />
            </div>

            <div className={styles.uploadBox}>
              <label>Upload Image:</label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button onClick={() => imageInputRef.current?.click()} className={styles.uploadBtn}>
                {uploadedImage ? '✅ Image Uploaded' : '📁 Choose Image'}
              </button>
            </div>

            <div className={styles.uploadBox}>
              <label>Upload Audio:</label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                style={{ display: 'none' }}
              />
              <button onClick={() => audioInputRef.current?.click()} className={styles.uploadBtn}>
                {uploadedAudio ? '✅ Audio Uploaded' : '🎵 Choose Audio'}
              </button>
            </div>

            <div className={styles.uploadBox}>
              <label>Face Pattern:</label>
              <select value={triggerFace} onChange={(e) => setTriggerFace(e.target.value)} className={styles.uploadSelect}>
                <option value="Happy">😊 Happy</option>
                <option value="Sad">😢 Sad</option>
                <option value="Angry">😠 Angry</option>
                <option value="Surprised">😲 Surprised</option>
                <option value="Fear">😨 Fear</option>
                <option value="Neutral">😐 Neutral</option>
              </select>
            </div>

            <div className={styles.uploadBox}>
              <label>Hand Gesture:</label>
              <select value={triggerHand} onChange={(e) => setTriggerHand(e.target.value)} className={styles.uploadSelect}>
                <option value="None">✋ None</option>
                <option value="Thumbs Up">👍 Thumbs Up</option>
                <option value="Peace">✌️ Peace</option>
                <option value="Fist">✊ Fist</option>
                <option value="Open Hand">🖐️ Open Hand</option>
                <option value="Pointing">👆 Pointing</option>
                <option value="Three">🤟 Three</option>
              </select>
            </div>

            <div className={styles.uploadBox}>
              <button onClick={handleSaveTrigger} className={styles.saveTriggerBtn}>
                💾 SAVE TRIGGER
              </button>
            </div>
          </div>
          
          <div className={styles.triggerInfo}>
            <p>💡 <strong>Info:</strong> Loaded {customTriggers.length} custom trigger(s)</p>
          </div>
        </div>
      </div>
    </>
  )
}
