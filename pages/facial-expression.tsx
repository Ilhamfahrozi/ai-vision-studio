import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Webcam from 'react-webcam'
import { FaceMesh, Results } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'
import * as faceapi from 'face-api.js'
import styles from '@/styles/FacialExpression.module.css'

export default function FacialExpression() {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  
  // MULTI-FACE: Array untuk menyimpan data semua orang (max 5)
  interface PersonData {
    emotion: string
    confidence: number
    age: number | null
    gender: string
    genderConfidence: number
    color: string // Warna bounding box
  }
  
  const [people, setPeople] = useState<PersonData[]>([])
  const [emotionHistory, setEmotionHistory] = useState<string[]>([])
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  
  // Age & Gender Detection states
  const [faceApiLoaded, setFaceApiLoaded] = useState(false)
  const [nextDetectionIn, setNextDetectionIn] = useState<number>(0)
  
  // Timestamp untuk tracking kapan terakhir detect age/gender
  const lastDetectionTimeRef = useRef<number>(0)
  const detectionAttemptCountRef = useRef<number>(0)
  
  // PENTING: Refs untuk multi-face data (array of PersonData)
  const peopleRef = useRef<PersonData[]>([])
  
  // Color palette untuk setiap orang (max 5)
  const COLORS = ['#00ff00', '#0088ff', '#ff0000', '#ffff00', '#ff00ff'] // Green, Blue, Red, Yellow, Purple
  const DETECTION_COOLDOWN = 60000 // 60 detik (1 MENIT)

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

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      // Use jsdelivr CDN as alternative (more reliable)
      const MODEL_URL = '/models' // Try local first
      const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
      
      try {
        console.log('Loading face-api models...')
        
        // Try loading from CDN
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.ageGenderNet.loadFromUri(CDN_URL)
        ])
        
        console.log('✅ Face-api models loaded successfully from CDN')
        setFaceApiLoaded(true)
        
        // Trigger immediate detection after models load
        console.log('🚀 Models loaded! Age/gender detection will start now...')
      } catch (error) {
        console.error('❌ Error loading face-api models:', error)
        console.log('⚠️ Age/gender detection disabled - models failed to load')
        alert('Failed to load AI models. Age/gender detection will not work.')
      }
    }
    loadModels()
  }, [])

  // Update countdown timer setiap detik (MULTI-FACE version)
  useEffect(() => {
    if (!isActive || people.length === 0 || people[0].age === null) return
    
    const interval = setInterval(() => {
      const currentTime = Date.now()
      const timeSinceLastDetection = currentTime - lastDetectionTimeRef.current
      const timeRemaining = DETECTION_COOLDOWN - timeSinceLastDetection
      
      if (timeRemaining > 0) {
        setNextDetectionIn(Math.ceil(timeRemaining / 1000))
      } else {
        setNextDetectionIn(0)
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isActive, people])

  useEffect(() => {
    if (!isActive || !selectedDeviceId) return

    const faceMesh = new FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      }
    })

    faceMesh.setOptions({
      maxNumFaces: 5, // MULTI-FACE: Support up to 5 people!
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

  function detectEmotion(landmarks: any): { emotion: string; confidence: number } {
    if (!landmarks || landmarks.length < 468) {
      return { emotion: 'Neutral', confidence: 0 }
    }

    // MediaPipe Face Mesh landmark indices (standardized)
    const leftEyeUpper = landmarks[159]
    const leftEyeLower = landmarks[145]
    const rightEyeUpper = landmarks[386]
    const rightEyeLower = landmarks[374]
    
    const leftEyebrowInner = landmarks[107]
    const rightEyebrowInner = landmarks[336]
    const leftEyebrowOuter = landmarks[70]
    const rightEyebrowOuter = landmarks[300]
    
    const leftMouthCorner = landmarks[61]
    const rightMouthCorner = landmarks[291]
    const upperLip = landmarks[13]
    const lowerLip = landmarks[14]
    const mouthTop = landmarks[0]
    const mouthBottom = landmarks[17]
    
    const noseTip = landmarks[1]
    const noseBridge = landmarks[6]

    // EAR (Eye Aspect Ratio) - standard metric
    const earLeft = Math.abs(leftEyeUpper.y - leftEyeLower.y) / Math.abs(landmarks[33].x - landmarks[133].x)
    const earRight = Math.abs(rightEyeUpper.y - rightEyeLower.y) / Math.abs(landmarks[362].x - landmarks[263].x)
    const avgEAR = (earLeft + earRight) / 2

    // MAR (Mouth Aspect Ratio) - standard metric
    const mouthHeight = Math.abs(upperLip.y - lowerLip.y)
    const mouthWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x)
    const MAR = mouthHeight / (mouthWidth + 0.001)

    // Mouth curvature - smile vs frown detection
    const upperLipCenter = upperLip.y
    const mouthCornerAvgY = (leftMouthCorner.y + rightMouthCorner.y) / 2
    const smileRatio = upperLipCenter - mouthCornerAvgY // positive = smile, negative = frown

    // Eyebrow raise ratio
    const leftBrowRaise = leftEyeUpper.y - leftEyebrowInner.y
    const rightBrowRaise = rightEyeUpper.y - rightEyebrowInner.y
    const avgBrowRaise = (leftBrowRaise + rightBrowRaise) / 2

    // Eyebrow furrow (inner brows coming together for anger)
    const browDistance = Math.abs(leftEyebrowInner.x - rightEyebrowInner.x)

    // Tongue detection for disgust (lower lip pushed down significantly)
    const tongueTip = landmarks[13]  // inner bottom lip
    const chinPoint = landmarks[152] // chin
    const tongueOut = Math.abs(tongueTip.y - lowerLip.y) // distance between inner lip and outer lip

    // EMOTION DETECTION - Intuitive and accurate
    let detectedEmotion = 'Neutral'
    let conf = 50

    // SURPRISED: Wide eyes + wide open mouth + raised eyebrows (check first for strong reaction)
    if (avgEAR > 0.22 && MAR > 0.45 && avgBrowRaise > 0.025) {
      detectedEmotion = 'Surprised'
      conf = 90
    }
    // FEAR: Very wide eyes + raised brows + moderately open mouth
    else if (avgEAR > 0.24 && avgBrowRaise > 0.028 && MAR > 0.25 && MAR < 0.55) {
      detectedEmotion = 'Fear'
      conf = 85
    }
    // ANGRY: Mata melotot (EAR besar) + mulut kecil/tertutup
    else if (avgEAR > 0.20 && MAR < 0.25 && smileRatio < 0.005) {
      detectedEmotion = 'Angry'
      conf = 88
    }
    // SAD: Mata merem/tertutup (EAR kecil) - cukup merem aja
    else if (avgEAR < 0.17) {
      detectedEmotion = 'Sad'
      conf = Math.min(90, 70 + (0.20 - avgEAR) * 400)
    }
    // HAPPY: Smile (corners up) + eyes normal or crescent
    else if (smileRatio > 0.007 && MAR < 0.4) {
      detectedEmotion = 'Happy'
      conf = Math.min(95, 65 + smileRatio * 2500)
    }
    // DISGUST: Lidah menjulur keluar (mulut terbuka + jarak bibir besar)
    else if (MAR > 0.3 && tongueOut > 0.01) {
      detectedEmotion = 'Disgust'
      conf = 85
    }
    // NEUTRAL: No strong features
    else {
      detectedEmotion = 'Neutral'
      conf = 65
    }

    return { emotion: detectedEmotion, confidence: conf }
  }

  // Async function untuk detect age/gender MULTI-FACE (non-blocking)
  async function detectAgeGender() {
    detectionAttemptCountRef.current++
    
    // Kalau sudah pernah detect, pakai cooldown untuk update
    const hasAnyDetection = peopleRef.current.length > 0 && peopleRef.current[0].age !== null
    if (hasAnyDetection) {
      const currentTime = Date.now()
      const timeSinceLastDetection = currentTime - lastDetectionTimeRef.current
      if (timeSinceLastDetection < DETECTION_COOLDOWN) {
        return // Skip jika belum waktunya update (FREEZE!)
      }
      console.log('⏰ 1 menit sudah lewat! Re-detecting age/gender...')
    }
    
    if (!faceApiLoaded) {
      if (detectionAttemptCountRef.current === 1) {
        console.log('⏳ Waiting for face-api models to load...')
      }
      return
    }
    
    if (!webcamRef.current || !webcamRef.current.video) {
      if (detectionAttemptCountRef.current === 1) {
        console.log('⏳ Waiting for webcam video...')
      }
      return
    }
    
    const video = webcamRef.current.video
    
    if (video.readyState !== 4) {
      if (detectionAttemptCountRef.current % 30 === 0) {
        console.log(`⏳ Video not ready yet (readyState: ${video.readyState})`)
      }
      return
    }
    
    try {
      if (detectionAttemptCountRef.current % 30 === 1 && !hasAnyDetection) {
        console.log(`🔍 Running MULTI-FACE age/gender detection... (attempt #${detectionAttemptCountRef.current})`)
      }
      
      const currentTime = Date.now()
      
      // MULTI-FACE: detectAllFaces instead of detectSingleFace (max 5 people)
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 128,
          scoreThreshold: 0.4
        }))
        .withAgeAndGender()
      
      if (detections && detections.length > 0) {
        // Update peopleRef with age/gender for each person (max 5)
        const maxPeople = Math.min(detections.length, 5)
        const updatedPeople = peopleRef.current.slice(0, maxPeople)
        
        for (let i = 0; i < maxPeople; i++) {
          if (!updatedPeople[i]) {
            updatedPeople[i] = {
              emotion: 'Neutral',
              confidence: 0,
              age: null,
              gender: 'Unknown',
              genderConfidence: 0,
              color: COLORS[i]
            }
          }
          
          updatedPeople[i].age = Math.round(detections[i].age)
          updatedPeople[i].gender = detections[i].gender
          updatedPeople[i].genderConfidence = Math.round(detections[i].genderProbability * 100)
        }
        
        peopleRef.current = updatedPeople
        setPeople([...updatedPeople])
        lastDetectionTimeRef.current = currentTime
        
        console.log(`✅ Detected ${maxPeople} people with age/gender`)
      }
    } catch (error) {
      console.error('❌ Age/Gender detection error:', error)
    }
  }

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

    // MULTI-FACE: Loop through all detected faces (max 5)
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const maxFaces = Math.min(results.multiFaceLandmarks.length, 5)
      const updatedPeople: PersonData[] = []
      
      // Trigger age/gender detection asynchronously (once per frame, handles all faces)
      detectAgeGender()
      
      for (let i = 0; i < maxFaces; i++) {
        const landmarks = results.multiFaceLandmarks[i]
        
        // Detect emotion for this person
        const { emotion: detectedEmotion, confidence: conf } = detectEmotion(landmarks)
        
        // Get existing person data or create new
        let personData = peopleRef.current[i] || {
          emotion: 'Neutral',
          confidence: 0,
          age: null,
          gender: 'Unknown',
          genderConfidence: 0,
          color: COLORS[i]
        }
        
        // Update emotion (real-time)
        personData.emotion = detectedEmotion
        personData.confidence = conf
        
        updatedPeople.push(personData)
        
        // Update history for first person only (to avoid spam)
        if (i === 0) {
          setEmotionHistory(prev => {
            const newHistory = [detectedEmotion, ...prev].slice(0, 10)
            return newHistory
          })
        }

        // Get bounding box
        const xs = landmarks.map(l => l.x)
        const ys = landmarks.map(l => l.y)
        
        const minX = Math.min(...xs) * canvas.width
        const maxX = Math.max(...xs) * canvas.width
        const minY = Math.min(...ys) * canvas.height
        const maxY = Math.max(...ys) * canvas.height
        
        const width = maxX - minX
        const height = maxY - minY
        
        // Use person's assigned color
        const boxColor = personData.color
        
        // ===== STYLISH BOUNDING BOX =====
        // Main box: Thin, rounded, dengan glow effect
        ctx.strokeStyle = boxColor
        ctx.lineWidth = 3 // Lebih tipis, lebih elegan
        ctx.shadowColor = boxColor
        ctx.shadowBlur = 10 // Glow effect
        
        // Draw rounded rectangle (manual karena canvas ga punya roundRect di semua browser)
        const padding = 15
        const x = minX - padding
        const y = minY - padding
        const w = width + padding * 2
        const h = height + padding * 2
        const radius = 15
        
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + w - radius, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
        ctx.lineTo(x + w, y + h - radius)
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
        ctx.lineTo(x + radius, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.stroke()
        
        // Reset shadow
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        
        // ===== COMPACT INFO CARD DI ATAS KEPALA =====
        // Reset scale untuk text (unflip)
        ctx.save()
        ctx.scale(-1, 1)
        
        const centerX = -(minX + width / 2)
        const cardY = minY - padding - 10 // 10px gap dari box
        
        // Hitung ukuran card based on content
        const hasAge = personData.age !== null
        const cardHeight = hasAge ? 75 : 50
        const cardWidth = 220
        
        // Draw card background (semi-transparent dengan border)
        const cardX = centerX - cardWidth / 2
        const cardRadius = 10
        
        // Background semi-transparent
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
        ctx.beginPath()
        ctx.moveTo(cardX + cardRadius, cardY - cardHeight)
        ctx.lineTo(cardX + cardWidth - cardRadius, cardY - cardHeight)
        ctx.quadraticCurveTo(cardX + cardWidth, cardY - cardHeight, cardX + cardWidth, cardY - cardHeight + cardRadius)
        ctx.lineTo(cardX + cardWidth, cardY - cardRadius)
        ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth - cardRadius, cardY)
        ctx.lineTo(cardX + cardRadius, cardY)
        ctx.quadraticCurveTo(cardX, cardY, cardX, cardY - cardRadius)
        ctx.lineTo(cardX, cardY - cardHeight + cardRadius)
        ctx.quadraticCurveTo(cardX, cardY - cardHeight, cardX + cardRadius, cardY - cardHeight)
        ctx.closePath()
        ctx.fill()
        
        // Border dengan warna person
        ctx.strokeStyle = boxColor
        ctx.lineWidth = 2
        ctx.stroke()
        
        // ===== TEXT CONTENT =====
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 3
        
        // Emotion (bold & big)
        ctx.font = 'bold 20px Arial'
        ctx.fillText(detectedEmotion, centerX, cardY - cardHeight + 24)
        
        // Confidence (smaller)
        ctx.font = '14px Arial'
        ctx.fillStyle = '#aaaaaa'
        ctx.fillText(`${conf}%`, centerX, cardY - cardHeight + 42)
        
        // Age & Gender (if available)
        if (hasAge) {
          ctx.font = 'bold 16px Arial'
          ctx.fillStyle = boxColor // Pakai warna person
          ctx.fillText(`${personData.age}yo • ${personData.gender} (${personData.genderConfidence}%)`, centerX, cardY - cardHeight + 64)
        }
        
        ctx.restore()
      }
      
      // Update peopleRef and state
      peopleRef.current = updatedPeople
      setPeople([...updatedPeople])
    } else {
      // No faces detected
      peopleRef.current = []
      setPeople([])
    }

    ctx.restore()
  }

  return (
    <>
      <Head>
        <title>Facial Expression Recognition - AI Vision Studio</title>
        <meta name="description" content="Real-time emotion detection AI" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back</Link>
          <h1>Facial Expression Recognition</h1>
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
            {/* MULTI-FACE: Show all detected people */}
            {people.length === 0 ? (
              <div className={styles.infoCard}>
                <h3>No Face Detected</h3>
                <p style={{ textAlign: 'center', padding: '1rem', color: '#9cab84' }}>
                  Position your face in the center
                </p>
              </div>
            ) : (
              <>
                <div className={styles.infoCard}>
                  <h3>👥 Detected People: {people.length}</h3>
                </div>
                
                {/* Scrollable list of people */}
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {people.map((person, index) => (
                    <div 
                      key={index} 
                      className={styles.emotionCard}
                      style={{ 
                        borderLeft: `5px solid ${person.color}`,
                        marginBottom: '1rem'
                      }}
                    >
                      <h3 style={{ color: person.color }}>
                        Person {index + 1}
                      </h3>
                      
                      {/* Emotion */}
                      <div className={styles.emotionDisplay}>{person.emotion}</div>
                      <div className={styles.confidenceBar}>
                        <div 
                          className={styles.confidenceFill} 
                          style={{ width: `${person.confidence}%`, backgroundColor: person.color }}
                        />
                      </div>
                      <p className={styles.confidenceText}>{person.confidence}% Confidence</p>
                      
                      {/* Age & Gender */}
                      {person.age !== null ? (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          padding: '0.5rem',
                          background: 'rgba(0,0,0,0.1)',
                          borderRadius: '5px',
                          textAlign: 'center'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>
                            {person.age}yo • {person.gender} ({person.genderConfidence}%)
                          </p>
                        </div>
                      ) : (
                        <p style={{ 
                          marginTop: '0.5rem',
                          textAlign: 'center', 
                          fontSize: '0.85rem', 
                          color: '#999' 
                        }}>
                          Detecting age & gender...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Timer for next update */}
                {people.length > 0 && people[0].age !== null && nextDetectionIn > 0 && (
                  <div className={styles.infoCard}>
                    <p style={{ 
                      textAlign: 'center',
                      fontSize: '0.9rem',
                      color: '#89986d',
                      fontWeight: 'bold',
                      margin: 0
                    }}>
                      ⏰ Age/Gender update in {nextDetectionIn}s
                    </p>
                  </div>
                )}
              </>
            )}

            <div className={styles.infoCard}>
              <h3>Emotions Detected</h3>
              <ul className={styles.emotionsList}>
                <li>Happy</li>
                <li>Sad</li>
                <li>Angry</li>
                <li>Surprised</li>
                <li>Fear</li>
                <li>Disgust</li>
                <li>Neutral</li>
              </ul>
            </div>

            <div className={styles.infoCard}>
              <h3>Recent History</h3>
              <div className={styles.history}>
                {emotionHistory.length === 0 ? (
                  <p className={styles.noHistory}>No data yet</p>
                ) : (
                  emotionHistory.slice(0, 5).map((emo, idx) => (
                    <div key={idx} className={styles.historyItem}>
                      {emo}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={styles.infoCard}>
              <h3>Tips</h3>
              <ul className={styles.tipsList}>
                <li>Posisikan wajah di tengah</li>
                <li>Gunakan pencahayaan yang baik</li>
                <li>Buat ekspresi yang jelas</li>
                <li>Support hingga 5 orang sekaligus! 🎉</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
