import { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import Webcam from 'react-webcam'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import styles from '@/styles/YourFree.module.css'
import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore'

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
  
  // Image crop states
  const [selectedImageForCrop, setSelectedImageForCrop] = useState<string>('')
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10
  })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)
  
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isMediaPipeLoading, setIsMediaPipeLoading] = useState<boolean>(false)
  
  // User's custom triggers from Firestore
  const [customTriggers, setCustomTriggers] = useState<CustomTrigger[]>([])
  
  // Camera stream ref for cleanup
  const cameraStreamRef = useRef<MediaStream | null>(null)

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
    if (!user) {
      console.log('⚠️ Cannot load triggers: No user logged in')
      return
    }
    
    try {
      console.log('🔍 Loading triggers for user:', user.uid)
      const q = query(
        collection(db, 'customTriggers'),
        where('userId', '==', user.uid)
      )
      const snapshot = await getDocs(q)
      
      // Load each trigger with its chunks from subcollection
      const triggers = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data()
        
        // Load chunks from subcollection
        const chunksRef = collection(db, 'customTriggers', doc.id, 'chunks')
        const chunksSnapshot = await getDocs(chunksRef)
        
        // Separate image and audio chunks
        const imageChunks: { index: number, data: string }[] = []
        const audioChunks: { index: number, data: string }[] = []
        
        chunksSnapshot.docs.forEach(chunkDoc => {
          const chunkData = chunkDoc.data()
          if (chunkData.type === 'image') {
            imageChunks.push({ index: chunkData.index, data: chunkData.data })
          } else if (chunkData.type === 'audio') {
            audioChunks.push({ index: chunkData.index, data: chunkData.data })
          }
        })
        
        // Sort by index and reconstruct
        imageChunks.sort((a, b) => a.index - b.index)
        audioChunks.sort((a, b) => a.index - b.index)
        
        const imageBase64 = imageChunks.map(c => c.data).join('')
        const audioBase64 = audioChunks.map(c => c.data).join('')
        
        console.log(`📦 Loaded trigger "${data.name}":`, {
          imageChunks: imageChunks.length,
          audioChunks: audioChunks.length,
          imageSize: imageBase64.length,
          audioSize: audioBase64.length,
          imagePreview: imageBase64.substring(0, 50) + '...',
          audioPreview: audioBase64.substring(0, 50) + '...'
        })
        
        return {
          id: doc.id,
          userId: data.userId,
          name: data.name,
          imageBase64,
          audioBase64,
          facePattern: data.facePattern,
          handPattern: data.handPattern,
          createdAt: data.createdAt?.toDate() || new Date()
        }
      })) as CustomTrigger[]
      
      setCustomTriggers(triggers)
      console.log('✅ Loaded custom triggers:', triggers.length)
      triggers.forEach(t => {
        console.log(`  - ${t.name}: Face=${t.facePattern}, Hand=${t.handPattern}, Image=${t.imageBase64?.length || 0}b, Audio=${t.audioBase64?.length || 0}b`)
      })
    } catch (err) {
      console.error('❌ Error loading triggers:', err)
    }
  }

  // Chunk base64 string into 200KB parts (TOTAL document must be under 1MB)
  const chunkBase64 = (base64: string, prefix: string): Record<string, any> => {
    const CHUNK_SIZE = 200 * 1024 // 200KB per chunk (safe for multiple chunks in one document)
    const chunks: Record<string, string> = {}
    
    if (!base64) return {}
    
    const totalChunks = Math.ceil(base64.length / CHUNK_SIZE)
    console.log(`📦 Chunking ${prefix}:`, {
      totalSize: base64.length,
      chunkSize: CHUNK_SIZE,
      totalChunks
    })
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, base64.length)
      chunks[`${prefix}Chunk${i}`] = base64.slice(start, end)
    }
    
    chunks[`${prefix}ChunkCount`] = totalChunks.toString()
    return chunks
  }

  // Reconstruct base64 from chunks
  const reconstructBase64 = (data: any, prefix: string): string => {
    const chunkCount = parseInt(data[`${prefix}ChunkCount`] || '0')
    if (chunkCount === 0) return ''
    
    let reconstructed = ''
    for (let i = 0; i < chunkCount; i++) {
      reconstructed += data[`${prefix}Chunk${i}`] || ''
    }
    
    return reconstructed
  }

  // Compress image to reasonable size - more aggressive compression
  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        // Max dimension 400px for smaller file size (was 800px)
        const maxDimension = 400
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width
          width = maxDimension
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height
          height = maxDimension
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        
        ctx.drawImage(img, 0, 0, width, height)
        
        // Use JPEG with 0.6 quality for smaller size (was 0.8)
        const result = canvas.toDataURL('image/jpeg', 0.6)
        
        console.log('📸 Image compressed:', {
          originalSize: base64.length,
          compressedSize: result.length,
          reduction: ((1 - result.length / base64.length) * 100).toFixed(1) + '%'
        })
        
        resolve(result)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = base64
    })
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
      console.log('📸 Image size:', match.imageBase64?.length || 0, 'bytes')
      console.log('🎵 Audio size:', match.audioBase64?.length || 0, 'bytes')
      
      setOutputImage(match.imageBase64)
      setOutputAudio(match.audioBase64)
      
      // Play audio
      if (audioRef.current && match.audioBase64) {
        console.log('🔊 Playing audio...')
        audioRef.current.src = match.audioBase64
        audioRef.current.play()
          .then(() => console.log('✅ Audio playing!'))
          .catch(err => console.error('❌ Audio play error:', err))
      } else {
        console.warn('⚠️ No audio ref or audioBase64:', {
          hasRef: !!audioRef.current,
          hasAudio: !!match.audioBase64
        })
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
      
      // Flip canvas horizontally to match normal view (non-mirror)
      ctx.translate(canvasLeft.width, 0)
      ctx.scale(-1, 1)
      
      ctx.drawImage(results.image, 0, 0, canvasLeft.width, canvasLeft.height)

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0]
        const emotion = detectEmotion(landmarks)
        setCurrentEmotion(emotion)
        
        // Draw face landmarks (already flipped by scale)
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
      
      // Flip canvas horizontally to match normal view (non-mirror)
      ctx.translate(canvasRight.width, 0)
      ctx.scale(-1, 1)
      
      ctx.drawImage(results.image, 0, 0, canvasRight.width, canvasRight.height)

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0]
        const gesture = detectGesture(landmarks)
        setCurrentGesture(gesture)
        
        // Draw hand landmarks (already flipped by scale)
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
      if (!isActive) return

      try {
        console.log('🔧 Initializing MediaPipe...')
        setIsMediaPipeLoading(true)
        
        // Wait for webcam to be ready
        if (!webcamRef.current || !webcamRef.current.video) {
          console.warn('⚠️ Webcam not ready, retrying...')
          setTimeout(initMediaPipe, 500)
          return
        }

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

        // Wait a bit for WASM to load
        await new Promise(resolve => setTimeout(resolve, 100))

        if (webcamRef.current && webcamRef.current.video && isActive) {
          const cameraFace = new Camera(webcamRef.current.video, {
            onFrame: async () => {
              if (webcamRef.current && webcamRef.current.video && faceMeshInstance && handsInstance) {
                try {
                  await faceMeshInstance.send({ image: webcamRef.current.video })
                  await handsInstance.send({ image: webcamRef.current.video })
                } catch (err) {
                  console.error('❌ MediaPipe send error:', err)
                }
              }
            },
            width: 640,
            height: 480
          })
          cameraFace.start()
          console.log('✅ MediaPipe initialized!')
          setIsMediaPipeLoading(false)
        }
      } catch (err) {
        console.error('❌ MediaPipe initialization error:', err)
        setError('❌ Failed to initialize AI models. Please refresh the page.')
        setIsMediaPipeLoading(false)
      }
    }

    // Delay initialization slightly to ensure DOM is ready
    const initTimer = setTimeout(initMediaPipe, 300)

    return () => {
      clearTimeout(initTimer)
      if (handsInstance) handsInstance.close()
      if (faceMeshInstance) faceMeshInstance.close()
      // Release camera stream
      releaseCamera()
    }
  }, [isActive, selectedDeviceId])
  
  // Release camera stream
  const releaseCamera = () => {
    if (cameraStreamRef.current) {
      console.log('🔌 Releasing camera stream...')
      cameraStreamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('✅ Track stopped:', track.kind)
      })
      cameraStreamRef.current = null
    }
    
    // Also stop webcam ref if exists
    if (webcamRef.current && webcamRef.current.stream) {
      webcamRef.current.stream.getTracks().forEach(track => {
        track.stop()
      })
    }
  }
  
  // Handle stop button - release camera
  const handleStop = () => {
    releaseCamera()
    setIsActive(false)
    setCurrentEmotion('None')
    setCurrentGesture('None')
  }
  
  // Handle start button - force release first
  const handleStart = async () => {
    console.log('🎬 Starting camera...')
    setError('') // Clear previous errors
    
    // Force release any existing streams first
    releaseCamera()
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100))
    
    setIsActive(true)
  }
  
  // Check trigger when emotion or gesture changes
  useEffect(() => {
    if (currentEmotion !== 'None' && currentGesture !== 'None') {
      checkTrigger(currentEmotion, currentGesture)
    }
  }, [currentEmotion, currentGesture, customTriggers])

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    console.log('📸 Image file selected:', file.name, file.size, 'bytes')
    
    if (!file.type.startsWith('image/')) {
      setError('❌ Please select an image file (jpg, png, gif, etc.)')
      console.error('❌ Invalid file type:', file.type)
      return
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('❌ Image must be less than 10MB')
      console.error('❌ File too large:', file.size, 'bytes')
      return
    }
    
    const reader = new FileReader()
    reader.onloadstart = () => {
      setMessage('📸 Loading image for cropping...')
    }
    reader.onloadend = async () => {
      try {
        // Show image in crop modal instead of compressing immediately
        setSelectedImageForCrop(reader.result as string)
        setMessage('✂️ Crop your image!')
        setError('')
      } catch (err) {
        setError('❌ Failed to load image')
        console.error('❌ Compression error:', err)
      }
    }
    reader.onerror = () => {
      setError('❌ Failed to read image file')
      console.error('❌ FileReader error')
    }
    reader.readAsDataURL(file)
  }
  
  // Handle crop confirm
  const handleCropConfirm = async () => {
    if (!imgRef.current || !completedCrop) {
      setError('❌ Please adjust crop area first')
      return
    }
    
    try {
      setMessage('✂️ Cropping and compressing image...')
      
      // Create canvas to crop image
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height
      
      canvas.width = completedCrop.width
      canvas.height = completedCrop.height
      
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      )
      
      // Convert to base64 and compress
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9)
      const compressed = await compressImage(croppedBase64)
      
      setUploadedImage(compressed)
      setSelectedImageForCrop('')
      setMessage('✅ Image cropped and ready!')
      setError('')
      setTimeout(() => setMessage(''), 2000)
      
      console.log('✅ Image cropped, size:', compressed.length, 'bytes')
    } catch (err) {
      setError('❌ Failed to crop image')
      console.error('❌ Crop error:', err)
    }
  }
  
  const handleCropCancel = () => {
    setSelectedImageForCrop('')
    setMessage('')
    setError('')
  }

  // Handle audio upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    console.log('🎵 Audio file selected:', file.name, file.size, 'bytes')
    
    if (!file.type.startsWith('audio/')) {
      setError('❌ Please select an audio file (mp3, wav, etc.)')
      console.error('❌ Invalid file type:', file.type)
      return
    }
    
    // Allow up to 5MB - will be chunked automatically
    if (file.size > 5 * 1024 * 1024) {
      setError('❌ Audio must be less than 5MB')
      console.error('❌ File too large:', file.size, 'bytes')
      return
    }
    
    const reader = new FileReader()
    reader.onloadstart = () => {
      setMessage('🎵 Loading audio...')
    }
    reader.onloadend = () => {
      const result = reader.result as string
      setUploadedAudio(result)
      setMessage('✅ Audio uploaded! (Will be chunked automatically)')
      setError('')
      console.log('✅ Audio loaded, size:', result.length, 'bytes')
      setTimeout(() => setMessage(''), 2000)
    }
    reader.onerror = () => {
      setError('❌ Failed to read audio file')
      console.error('❌ FileReader error')
    }
    reader.readAsDataURL(file)
  }

  // Save trigger
  const handleSaveTrigger = async () => {
    console.log('🔄 handleSaveTrigger called')
    console.log('User:', user ? user.uid : 'NO USER')
    console.log('Trigger Name:', triggerName)
    console.log('Has Image:', !!uploadedImage)
    console.log('Has Audio:', !!uploadedAudio)
    console.log('Face Pattern:', triggerFace)
    console.log('Hand Pattern:', triggerHand)
    
    if (!user) {
      setError('❌ You must be logged in')
      console.error('❌ No user logged in')
      return
    }
    
    if (!triggerName.trim()) {
      setError('❌ Please enter a trigger name')
      console.error('❌ No trigger name')
      return
    }
    
    if (!uploadedImage) {
      setError('❌ Please upload an image')
      console.error('❌ No image uploaded')
      return
    }
    
    if (!uploadedAudio) {
      setError('❌ Please upload audio')
      console.error('❌ No audio uploaded')
      return
    }
    
    setIsSaving(true)
    setMessage('💾 Saving trigger...')
    setError('')
    
    try {
      console.log('💾 Attempting to save to Firestore with subcollection chunks...')
      
      // Save main document with metadata only (NO chunks in main doc)
      const mainDocData = {
        userId: user.uid,
        name: triggerName,
        facePattern: triggerFace,
        handPattern: triggerHand,
        createdAt: new Date(),
        imageChunkCount: Math.ceil(uploadedImage.length / (200 * 1024)),
        audioChunkCount: Math.ceil(uploadedAudio.length / (200 * 1024))
      }
      
      console.log('� Saving main document:', mainDocData)
      const docRef = await addDoc(collection(db, 'customTriggers'), mainDocData)
      console.log('✅ Main document saved with ID:', docRef.id)
      setMessage('✅ Main document saved! Now saving chunks...')
      
      // Save image chunks to subcollection
      const imageChunks = chunkBase64(uploadedImage, 'image')
      const imageChunkCount = parseInt(imageChunks.imageChunkCount || '0')
      console.log(`📦 Saving ${imageChunkCount} image chunks to subcollection...`)
      setMessage(`📦 Saving image (${imageChunkCount} chunks)...`)
      
      for (let i = 0; i < imageChunkCount; i++) {
        const chunkData = {
          type: 'image',
          index: i,
          data: imageChunks[`imageChunk${i}`],
          createdAt: new Date()
        }
        await addDoc(collection(db, 'customTriggers', docRef.id, 'chunks'), chunkData)
        if (i % 2 === 0 || i === imageChunkCount - 1) {
          setMessage(`📦 Image chunk ${i + 1}/${imageChunkCount}...`)
        }
      }
      console.log('✅ Image chunks saved')
      setMessage('✅ Image saved! Saving audio...')
      
      // Save audio chunks to subcollection
      const audioChunks = chunkBase64(uploadedAudio, 'audio')
      const audioChunkCount = parseInt(audioChunks.audioChunkCount || '0')
      console.log(`📦 Saving ${audioChunkCount} audio chunks to subcollection...`)
      setMessage(`📦 Saving audio (${audioChunkCount} chunks)...`)
      
      for (let i = 0; i < audioChunkCount; i++) {
        const chunkData = {
          type: 'audio',
          index: i,
          data: audioChunks[`audioChunk${i}`],
          createdAt: new Date()
        }
        await addDoc(collection(db, 'customTriggers', docRef.id, 'chunks'), chunkData)
        if (i % 2 === 0 || i === audioChunkCount - 1) {
          setMessage(`📦 Audio chunk ${i + 1}/${audioChunkCount}...`)
        }
      }
      console.log('✅ Audio chunks saved')
      setMessage('🔄 Reloading triggers...')
      
      console.log('✅ All data saved successfully!')
      setMessage('✅ Trigger saved successfully!')
      setError('')
      
      // Reset form
      setTriggerName('')
      setUploadedImage('')
      setUploadedAudio('')
      setTriggerFace('Happy')
      setTriggerHand('None')
      
      // Reset file inputs
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (audioInputRef.current) audioInputRef.current.value = ''
      
      // Reload triggers
      console.log('🔄 Reloading triggers...')
      await loadCustomTriggers()
      
      setMessage('✅ Trigger saved successfully!')
      setTimeout(() => setMessage(''), 5000)
    } catch (err: any) {
      console.error('❌ Error saving trigger:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)
      setError(`❌ Failed to save: ${err.message}`)
      setMessage('')
    } finally {
      setIsSaving(false)
    }
  }
  
  // Delete trigger
  const handleDeleteTrigger = async (triggerId: string) => {
    if (!user) return
    
    if (!confirm('Yakin mau hapus trigger ini?')) return
    
    try {
      console.log('🗑️ Deleting trigger:', triggerId)
      
      // Delete chunks subcollection first
      const chunksRef = collection(db, 'customTriggers', triggerId, 'chunks')
      const chunksSnapshot = await getDocs(chunksRef)
      
      console.log(`🗑️ Deleting ${chunksSnapshot.docs.length} chunks...`)
      for (const chunkDoc of chunksSnapshot.docs) {
        await deleteDoc(doc(db, 'customTriggers', triggerId, 'chunks', chunkDoc.id))
      }
      
      // Delete main document
      await deleteDoc(doc(db, 'customTriggers', triggerId))
      
      console.log('✅ Trigger deleted!')
      setMessage('✅ Trigger berhasil dihapus!')
      
      // Reload triggers
      await loadCustomTriggers()
      
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('❌ Error deleting trigger:', err)
      setError(`❌ Failed to delete: ${err.message}`)
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
                  {isMediaPipeLoading && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      padding: '20px',
                      borderRadius: '10px',
                      zIndex: 10,
                      textAlign: 'center'
                    }}>
                      <p style={{ fontSize: '18px', fontWeight: 'bold' }}>🔧 Loading AI Models...</p>
                      <p style={{ fontSize: '14px', marginTop: '5px' }}>Please wait a moment</p>
                    </div>
                  )}
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    videoConstraints={{ deviceId: selectedDeviceId }}
                    className={styles.webcam}
                    mirrored={false}
                    onUserMediaError={(error) => {
                      console.error('❌ Camera error:', error)
                      const errorMsg = typeof error === 'string' ? error : (error.message || 'Unknown error')
                      setError(`❌ Camera error: ${errorMsg}. Please check if another app is using the camera.`)
                      // Force release and stop
                      releaseCamera()
                      setIsActive(false)
                      setIsMediaPipeLoading(false)
                    }}
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
                <button onClick={handleStart} className={styles.btnStart}>
                  START
                </button>
              ) : (
                <button onClick={handleStop} className={styles.btnStop}>
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
          {error && (
            <div className={styles.errorMessage}>
              {error}
              {error.includes('Camera error') && (
                <div style={{ marginTop: '10px', fontSize: '14px', opacity: 0.9 }}>
                  <strong>💡 Troubleshooting:</strong>
                  <ul style={{ textAlign: 'left', marginTop: '5px' }}>
                    <li>Tutup aplikasi lain yang menggunakan kamera (Zoom, Teams, dll)</li>
                    <li>Klik tombol "🔌 Force Release Camera" di bawah</li>
                    <li>Refresh halaman ini (F5)</li>
                    <li>Coba pilih kamera yang berbeda dari dropdown</li>
                    <li>Pastikan browser punya akses ke kamera (Settings → Privacy)</li>
                  </ul>
                  <button 
                    onClick={() => {
                      releaseCamera()
                      setError('')
                      setMessage('✅ Camera released! Try starting again.')
                      setTimeout(() => setMessage(''), 3000)
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      background: '#fdacac',
                      border: '2px solid #000',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🔌 Force Release Camera
                  </button>
                </div>
              )}
            </div>
          )}
          
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
              {uploadedImage && (
                <div className={styles.previewBox}>
                  <img src={uploadedImage} alt="Preview" className={styles.previewImage} />
                </div>
              )}
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
              {uploadedAudio && (
                <div className={styles.previewBox}>
                  <audio controls src={uploadedAudio} className={styles.previewAudio} />
                </div>
              )}
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
              <button 
                onClick={handleSaveTrigger} 
                className={styles.saveTriggerBtn}
                disabled={isSaving}
                style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? '⏳ SAVING...' : '💾 SAVE TRIGGER'}
              </button>
            </div>
          </div>
          
          <div className={styles.triggerInfo}>
            <h3>� My Custom Triggers ({customTriggers.length})</h3>
            {customTriggers.length === 0 ? (
              <p>Belum ada trigger. Upload trigger pertama kamu!</p>
            ) : (
              <div className={styles.triggersList}>
                {customTriggers.map((trigger) => (
                  <div key={trigger.id} className={styles.triggerItem}>
                    <div className={styles.triggerDetails}>
                      <strong>{trigger.name}</strong>
                      <p>Face: {trigger.facePattern} | Hand: {trigger.handPattern}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteTrigger(trigger.id)}
                      className={styles.deleteBtn}
                      title="Hapus trigger"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Image Crop Modal */}
      {selectedImageForCrop && (
        <div className={styles.cropModal}>
          <div className={styles.cropModalContent}>
            <h3>✂️ Crop Your Image</h3>
            <div className={styles.cropContainer}>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
              >
                <img
                  ref={imgRef}
                  src={selectedImageForCrop}
                  alt="Crop preview"
                  style={{ maxWidth: '100%', maxHeight: '60vh' }}
                />
              </ReactCrop>
            </div>
            <div className={styles.cropActions}>
              <button onClick={handleCropConfirm} className={styles.cropConfirmBtn}>
                ✅ Use This Crop
              </button>
              <button onClick={handleCropCancel} className={styles.cropCancelBtn}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
