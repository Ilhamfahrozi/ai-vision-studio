// Database service for storing detection results
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';

// Collection names
const COLLECTIONS = {
  DETECTIONS: 'detections',
  STATISTICS: 'statistics'
};

// Interface for detection data
export interface DetectionData {
  type: 'face' | 'expression' | 'gesture' | 'pose' | 'hand';
  result: string; // e.g., "happy", "sad", "pointing", etc.
  confidence?: number;
  userId?: string; // Add user ID for tracking
  timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
  metadata?: {
    detectionCount?: number;
    [key: string]: any;
  };
}

// Save detection result to Firestore
export const saveDetection = async (data: Omit<DetectionData, 'timestamp'>) => {
  try {
    const detectionData: DetectionData = {
      ...data,
      timestamp: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, COLLECTIONS.DETECTIONS), detectionData);
    console.log('Detection saved with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving detection:', error);
    return { success: false, error };
  }
};

// Get recent detections
export const getRecentDetections = async (limitCount: number = 10, userId?: string) => {
  try {
    let q = query(
      collection(db, COLLECTIONS.DETECTIONS),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    // If userId provided, filter by user
    if (userId) {
      q = query(
        collection(db, COLLECTIONS.DETECTIONS),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const detections = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter by userId in client side if needed (Firestore limitation without composite index)
    const filteredDetections = userId 
      ? detections.filter((d: any) => d.userId === userId)
      : detections;
    
    return { success: true, data: filteredDetections };
  } catch (error) {
    console.error('Error fetching detections:', error);
    return { success: false, error };
  }
};

// Update statistics
export const updateStatistics = async (type: string, result: string) => {
  try {
    const statsData = {
      type,
      result,
      count: 1,
      lastUpdated: serverTimestamp()
    };
    
    await addDoc(collection(db, COLLECTIONS.STATISTICS), statsData);
    return { success: true };
  } catch (error) {
    console.error('Error updating statistics:', error);
    return { success: false, error };
  }
};
