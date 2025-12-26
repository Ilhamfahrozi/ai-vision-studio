import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import styles from '@/styles/YourFree.module.css'
import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore'

interface CustomTrigger {
  id?: string
  userId: string
  name: string
  imageBase64: string
  audioBase64: string
  facePattern: string
  handPattern: string
  createdAt: Date
}

interface YourFreeProps {
  onBack: () => void
}

const FACE_PATTERNS = [
  { value: 'Happy', label: '😊 Happy' },
  { value: 'Sad', label: '😢 Sad' },
  { value: 'Angry', label: '😠 Angry' },
  { value: 'Surprised', label: '😲 Surprised' },
  { value: 'Fear', label: '😨 Fear' },
  { value: 'Disgust', label: '🤢 Disgust' },
  { value: 'Neutral', label: '😐 Neutral' },
]

const HAND_PATTERNS = [
  { value: 'None', label: '✋ No Gesture' },
  { value: 'Thumbs Up', label: '👍 Thumbs Up' },
  { value: 'Peace', label: '✌️ Peace' },
  { value: 'Fist', label: '✊ Fist' },
  { value: 'Open Hand', label: '🖐️ Open Hand' },
  { value: 'Pointing', label: '👆 Pointing' },
  { value: 'Three', label: '🤟 Three Fingers' },
]

export default function YourFree({ onBack }: YourFreeProps) {
  const { user } = useAuth()
  const [triggers, setTriggers] = useState<CustomTrigger[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [imageBase64, setImageBase64] = useState('')
  const [audioBase64, setAudioBase64] = useState('')
  const [facePattern, setFacePattern] = useState('Happy')
  const [handPattern, setHandPattern] = useState('None')
  const [imagePreview, setImagePreview] = useState('')
  const [audioPreview, setAudioPreview] = useState('')
  
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      fetchTriggers()
    }
  }, [user])

  const fetchTriggers = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const q = query(collection(db, 'customTriggers'), where('userId', '==', user.uid))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as CustomTrigger[]
      
      setTriggers(data)
    } catch (err) {
      console.error('Error fetching triggers:', err)
      setError('Failed to load your custom triggers')
    } finally {
      setLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const base64 = reader.result as string
      setImageBase64(base64)
      setImagePreview(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (MP3, WAV, etc.)')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Audio must be less than 5MB')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setAudioBase64(base64)
      setAudioPreview(base64)
    }
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setName('')
    setImageBase64('')
    setAudioBase64('')
    setFacePattern('Happy')
    setHandPattern('None')
    setImagePreview('')
    setAudioPreview('')
    setEditingId(null)
    setShowForm(false)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError('You must be logged in')
      return
    }
    
    if (!name || !imageBase64 || !audioBase64) {
      setError('Please fill all fields and upload both image and audio')
      return
    }
    
    try {
      const triggerData = {
        userId: user.uid,
        name,
        imageBase64,
        audioBase64,
        facePattern,
        handPattern,
        createdAt: new Date()
      }
      
      if (editingId) {
        // Update existing
        await updateDoc(doc(db, 'customTriggers', editingId), triggerData)
        setMessage('✅ Custom trigger updated successfully!')
      } else {
        // Create new
        await addDoc(collection(db, 'customTriggers'), triggerData)
        setMessage('✅ Custom trigger created successfully!')
      }
      
      await fetchTriggers()
      resetForm()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error('Error saving trigger:', err)
      setError('Failed to save custom trigger')
    }
  }

  const handleEdit = (trigger: CustomTrigger) => {
    setEditingId(trigger.id || null)
    setName(trigger.name)
    setImageBase64(trigger.imageBase64)
    setAudioBase64(trigger.audioBase64)
    setFacePattern(trigger.facePattern)
    setHandPattern(trigger.handPattern)
    setImagePreview(trigger.imageBase64)
    setAudioPreview(trigger.audioBase64)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom trigger?')) return
    
    try {
      await deleteDoc(doc(db, 'customTriggers', id))
      setMessage('✅ Custom trigger deleted')
      await fetchTriggers()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error('Error deleting trigger:', err)
      setError('Failed to delete custom trigger')
    }
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <p>Please log in to access Your Free mode</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Your Free - AI Vision Studio</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <button onClick={onBack} className={styles.backButton}>← Back to Selection</button>
          <h1>Your Free - Custom Triggers</h1>
        </header>

        <div className={styles.content}>
          {message && <div className={styles.success}>{message}</div>}
          {error && <div className={styles.error}>{error}</div>}

          {!showForm && (
            <div className={styles.topBar}>
              <button onClick={() => setShowForm(true)} className={styles.createButton}>
                + Create New Trigger
              </button>
            </div>
          )}

          {showForm && (
            <div className={styles.formContainer}>
              <h2>{editingId ? 'Edit' : 'Create'} Custom Trigger</h2>
              
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label>Trigger Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Happy Dance"
                    required
                  />
                </div>

                <div className={styles.uploadSection}>
                  <div className={styles.uploadGroup}>
                    <label>Upload Image (JPG, PNG)</label>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className={styles.uploadButton}
                    >
                      {imagePreview ? 'Change Image' : 'Choose Image'}
                    </button>
                    {imagePreview && (
                      <div className={styles.preview}>
                        <img src={imagePreview} alt="Preview" />
                      </div>
                    )}
                  </div>

                  <div className={styles.uploadGroup}>
                    <label>Upload Audio (MP3, WAV)</label>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioChange}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      className={styles.uploadButton}
                    >
                      {audioPreview ? 'Change Audio' : 'Choose Audio'}
                    </button>
                    {audioPreview && (
                      <div className={styles.audioPreview}>
                        <audio controls src={audioPreview} />
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.patternSection}>
                  <div className={styles.inputGroup}>
                    <label>Face Pattern Trigger</label>
                    <select value={facePattern} onChange={(e) => setFacePattern(e.target.value)}>
                      {FACE_PATTERNS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Hand Gesture Trigger</label>
                    <select value={handPattern} onChange={(e) => setHandPattern(e.target.value)}>
                      {HAND_PATTERNS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formButtons}>
                  <button type="submit" className={styles.saveButton}>
                    {editingId ? 'Update' : 'Create'} Trigger
                  </button>
                  <button type="button" onClick={resetForm} className={styles.cancelButton}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className={styles.triggersList}>
            <h2>Your Custom Triggers ({triggers.length})</h2>
            
            {loading ? (
              <p className={styles.loading}>Loading...</p>
            ) : triggers.length === 0 ? (
              <div className={styles.empty}>
                <p>No custom triggers yet. Create your first one!</p>
              </div>
            ) : (
              <div className={styles.triggersGrid}>
                {triggers.map(trigger => (
                  <div key={trigger.id} className={styles.triggerCard}>
                    <div className={styles.triggerImage}>
                      <img src={trigger.imageBase64} alt={trigger.name} />
                    </div>
                    <div className={styles.triggerInfo}>
                      <h3>{trigger.name}</h3>
                      <div className={styles.triggerPattern}>
                        <span className={styles.patternBadge}>
                          {FACE_PATTERNS.find(p => p.value === trigger.facePattern)?.label || trigger.facePattern}
                        </span>
                        {trigger.handPattern !== 'None' && (
                          <span className={styles.patternBadge}>
                            {HAND_PATTERNS.find(p => p.value === trigger.handPattern)?.label || trigger.handPattern}
                          </span>
                        )}
                      </div>
                      <div className={styles.triggerAudio}>
                        <audio controls src={trigger.audioBase64} />
                      </div>
                    </div>
                    <div className={styles.triggerActions}>
                      <button onClick={() => handleEdit(trigger)} className={styles.editButton}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(trigger.id!)} className={styles.deleteButton}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
