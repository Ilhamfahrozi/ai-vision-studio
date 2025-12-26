import { db } from './firebase'
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore'

export interface GestureTrackingData {
  userId: string
  faceExpression: string
  handGesture: string
  timestamp: Date
}

export interface PersonalityAnalysis {
  mostCommonFace: string
  mostCommonHand: string
  facePersonality: string
  handPersonality: string
  totalTracked: number
  faceStats: Record<string, number>
  handStats: Record<string, number>
}

// Personality labels based on most common gestures
const FACE_PERSONALITIES: Record<string, string> = {
  'Happy': 'Optimis & Ceria',
  'Sad': 'Sensitif & Emosional',
  'Angry': 'Pemarah & Tegas',
  'Surprised': 'Spontan & Ekspresif',
  'Fear': 'Waspada & Hati-hati',
  'Disgust': 'Kritis & Selektif',
  'Neutral': 'Tenang & Stabil',
}

const HAND_PERSONALITIES: Record<string, string> = {
  'Thumbs Up': 'Positif & Supportif',
  'Peace': 'Damai & Friendly',
  'Fist': 'Petinju & Kuat',
  'Open Hand': 'Terbuka & Ramah',
  'Pointing': 'Tegas & Direktif',
  'Three': 'Kreatif & Unik',
  'None': 'Natural & Simple',
}

// Save gesture tracking data
export const saveGestureTracking = async (data: GestureTrackingData) => {
  try {
    await addDoc(collection(db, 'gestureTracking'), {
      ...data,
      timestamp: new Date()
    })
    console.log('✅ Gesture tracking saved')
  } catch (error) {
    console.error('❌ Error saving gesture tracking:', error)
    throw error
  }
}

// Get personality analysis for user
export const getPersonalityAnalysis = async (userId: string): Promise<PersonalityAnalysis | null> => {
  try {
    const q = query(
      collection(db, 'gestureTracking'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(1000) // Analyze last 1000 records
    )
    
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return null
    }
    
    const faceStats: Record<string, number> = {}
    const handStats: Record<string, number> = {}
    
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      
      // Count face expressions
      if (data.faceExpression && data.faceExpression !== 'None') {
        faceStats[data.faceExpression] = (faceStats[data.faceExpression] || 0) + 1
      }
      
      // Count hand gestures
      if (data.handGesture && data.handGesture !== 'None') {
        handStats[data.handGesture] = (handStats[data.handGesture] || 0) + 1
      }
    })
    
    // Find most common
    const mostCommonFace = Object.entries(faceStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral'
    const mostCommonHand = Object.entries(handStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'
    
    return {
      mostCommonFace,
      mostCommonHand,
      facePersonality: FACE_PERSONALITIES[mostCommonFace] || 'Unknown',
      handPersonality: HAND_PERSONALITIES[mostCommonHand] || 'Unknown',
      totalTracked: snapshot.size,
      faceStats,
      handStats
    }
  } catch (error) {
    console.error('❌ Error getting personality analysis:', error)
    throw error
  }
}

// Get recent tracking data
export const getRecentTracking = async (userId: string, limitCount: number = 100) => {
  try {
    const q = query(
      collection(db, 'gestureTracking'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    }))
  } catch (error) {
    console.error('❌ Error getting recent tracking:', error)
    throw error
  }
}
