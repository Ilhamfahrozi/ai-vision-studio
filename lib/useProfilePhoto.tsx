import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useProfilePhoto(userId: string | undefined) {
  const [photoURL, setPhotoURL] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPhotoURL('');
      setLoading(false);
      return;
    }

    const loadPhoto = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'userProfiles', userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().photoURL) {
          setPhotoURL(docSnap.data().photoURL);
        } else {
          setPhotoURL('');
        }
      } catch (error) {
        console.error('Error loading profile photo:', error);
        setPhotoURL('');
      } finally {
        setLoading(false);
      }
    };

    loadPhoto();
  }, [userId]);

  return { photoURL, loading };
}
