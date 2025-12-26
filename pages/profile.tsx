import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { useProfilePhoto } from '@/lib/useProfilePhoto';
import { updateProfile, updatePassword } from 'firebase/auth';
import { getPersonalityAnalysis, PersonalityAnalysis } from '@/lib/gestureTracking';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, query, where, orderBy, limit as queryLimit, getDocs } from 'firebase/firestore';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import styles from '@/styles/Profile.module.css';

interface Detection {
  id: string;
  type: string;
  result: string;
  confidence: number;
  timestamp: any;
  metadata?: any;
}

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { photoURL: profilePhoto, loading: photoLoading } = useProfilePhoto(user?.uid);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    expressions: {} as Record<string, number>
  });
  
  // Personality analysis from gesture tracking
  const [personality, setPersonality] = useState<PersonalityAnalysis | null>(null);
  const [personalityLoading, setPersonalityLoading] = useState(true);
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateError, setUpdateError] = useState('');
  
  // Photo upload and crop states
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Photo viewer modal (WhatsApp style)
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(1); // 1 = 100%, 2 = 200%, etc
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 }); // Pan position
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!user) {
      // User will see AuthModal automatically from _app.tsx
      // No need to redirect - just wait for authentication
      return;
    }

    fetchDetections();
    fetchPersonalityAnalysis();
  }, [user]);
  
  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
    }
  }, [user]);

  const fetchDetections = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      // Query Firestore directly (client-side with auth context)
      const detectionsRef = collection(db, 'detections');
      const q = query(
        detectionsRef,
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        queryLimit(50)
      );
      
      const querySnapshot = await getDocs(q);
      const data: Detection[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Detection));
      
      setDetections(data);
      calculateStats(data);
    } catch (error) {
      console.error('Error fetching detections:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPersonalityAnalysis = async () => {
    if (!user) return;
    
    try {
      setPersonalityLoading(true);
      const analysis = await getPersonalityAnalysis(user.uid);
      setPersonality(analysis);
    } catch (error) {
      console.error('Error fetching personality analysis:', error);
    } finally {
      setPersonalityLoading(false);
    }
  };

  const calculateStats = (data: Detection[]) => {
    const expressions: Record<string, number> = {};
    
    data.forEach(d => {
      if (d.type === 'expression') {
        expressions[d.result] = (expressions[d.result] || 0) + 1;
      }
    });

    setStats({
      total: data.length,
      expressions
    });
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setUpdateError('');
    setUpdateMessage('');
    
    try {
      await updateProfile(user, {
        displayName: editName
      });
      setUpdateMessage('✅ Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to update profile');
    }
  };
  
  const handleChangePassword = async () => {
    if (!user) return;
    
    setUpdateError('');
    setUpdateMessage('');
    
    if (newPassword.length < 6) {
      setUpdateError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setUpdateError('Passwords do not match');
      return;
    }
    
    try {
      await updatePassword(user, newPassword);
      setUpdateMessage('✅ Password changed successfully!');
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to change password. Try logging out and in again.');
    }
  };
  
  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setUpdateError('❌ Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setUpdateError('❌ Image must be less than 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setIsUploadingPhoto(true);
      setUpdateError('');
    };
    reader.readAsDataURL(file);
  };
  
  // Create cropped image
  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Make it square
    const size = Math.min(crop.width * scaleX, crop.height * scaleY);
    canvas.width = 300;
    canvas.height = 300;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      size,
      size,
      0,
      0,
      300,
      300
    );
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve('');
          return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
      }, 'image/jpeg', 0.9);
    });
  };
  
  // Save cropped photo
  const handleSavePhoto = async () => {
    if (!user || !imgRef.current || !completedCrop) return;
    
    setUpdateError('');
    setUpdateMessage('');
    
    try {
      console.log('🖼️ Cropping image...');
      const croppedImage = await getCroppedImg(imgRef.current, completedCrop);
      
      console.log('💾 Saving to Firestore...');
      // Save ONLY to Firestore (base64), NOT to Firebase Auth (has URL length limit)
      await setDoc(doc(db, 'userProfiles', user.uid), {
        photoURL: croppedImage,
        updatedAt: new Date()
      }, { merge: true });
      
      console.log('✅ Photo saved to Firestore');
      // Photo will be automatically reloaded by useProfilePhoto hook
      setUpdateMessage('✅ Profile photo updated successfully!');
      setIsUploadingPhoto(false);
      setSelectedImage('');
      
      // Force page reload to refresh photo from hook
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('❌ Error updating photo:', error);
      setUpdateError(error.message || 'Failed to update photo');
    }
  };
  
  // Cancel photo upload
  const handleCancelPhoto = () => {
    setIsUploadingPhoto(false);
    setSelectedImage('');
    setCompletedCrop(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };
  
  // Photo viewer zoom controls
  const handlePhotoWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setPhotoZoom(prev => Math.max(0.5, Math.min(5, prev + delta))); // Min 50%, Max 500%
  };
  
  const handlePhotoMouseDown = (e: React.MouseEvent) => {
    if (photoZoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - photoPan.x, y: e.clientY - photoPan.y });
    }
  };
  
  const handlePhotoMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPhotoPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };
  
  const handlePhotoMouseUp = () => {
    setIsDragging(false);
  };
  
  const resetPhotoView = () => {
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
  };
  
  const closePhotoModal = () => {
    setIsViewingPhoto(false);
    resetPhotoView();
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Profile - AI Vision Studio</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back to Home</Link>
          <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
        </header>

        <div className={styles.content}>
          {/* User Info Card */}
          <div className={styles.userCard}>
            <div className={styles.avatar}>
              {profilePhoto ? (
                <img 
                  src={profilePhoto} 
                  alt={user.displayName || 'User'} 
                  onClick={() => setIsViewingPhoto(true)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full size"
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              
              {/* Change Photo Button */}
              {!isUploadingPhoto && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={styles.changePhotoBtn}
                  title="Change profile photo"
                >
                  📷
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
            </div>
            
            {!isEditing && !isChangingPassword && !isUploadingPhoto ? (
              <>
                <h1>{user.displayName || 'User'}</h1>
                <p className={styles.email}>{user.email}</p>
                <div className={styles.editButtons}>
                  <button onClick={() => { setIsEditing(true); setEditName(user.displayName || ''); }} className={styles.editButton}>
                    Edit Profile
                  </button>
                  <button onClick={() => setIsChangingPassword(true)} className={styles.editButton}>
                    Change Password
                  </button>
                </div>
              </>
            ) : isEditing ? (
              <div className={styles.editForm}>
                <h2>Edit Profile</h2>
                <div className={styles.inputGroup}>
                  <label>Display Name</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                {updateMessage && <div className={styles.success}>{updateMessage}</div>}
                {updateError && <div className={styles.error}>{updateError}</div>}
                <div className={styles.formButtons}>
                  <button onClick={handleUpdateProfile} className={styles.saveButton}>Save Changes</button>
                  <button onClick={() => { setIsEditing(false); setUpdateError(''); setUpdateMessage(''); }} className={styles.cancelButton}>Cancel</button>
                </div>
              </div>
            ) : isUploadingPhoto ? (
              <div className={styles.editForm}>
                <h2>Crop Profile Photo</h2>
                <p className={styles.cropHint}>🔲 Drag to select a square area for your profile photo</p>
                {selectedImage && (
                  <div className={styles.cropContainer}>
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      circularCrop={false}
                    >
                      <img
                        ref={imgRef}
                        src={selectedImage}
                        alt="Crop preview"
                        style={{ maxWidth: '100%', maxHeight: '400px' }}
                      />
                    </ReactCrop>
                  </div>
                )}
                {updateMessage && <div className={styles.success}>{updateMessage}</div>}
                {updateError && <div className={styles.error}>{updateError}</div>}
                <div className={styles.formButtons}>
                  <button onClick={handleSavePhoto} className={styles.saveButton}>Save Photo</button>
                  <button onClick={handleCancelPhoto} className={styles.cancelButton}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className={styles.editForm}>
                <h2>Change Password</h2>
                <div className={styles.inputGroup}>
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
                {updateMessage && <div className={styles.success}>{updateMessage}</div>}
                {updateError && <div className={styles.error}>{updateError}</div>}
                <div className={styles.formButtons}>
                  <button onClick={handleChangePassword} className={styles.saveButton}>Change Password</button>
                  <button onClick={() => { setIsChangingPassword(false); setNewPassword(''); setConfirmPassword(''); setUpdateError(''); setUpdateMessage(''); }} className={styles.cancelButton}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Personality Analysis */}
          {!personalityLoading && personality && personality.totalTracked > 0 && (
            <div className={styles.personalitySection}>
              <h2>🎭 Your Personality Analysis</h2>
              <p className={styles.personalitySubtitle}>
                Based on {personality.totalTracked} tracked gestures
              </p>
              
              <div className={styles.personalityGrid}>
                {/* Face Personality */}
                <div className={styles.personalityCard}>
                  <div className={styles.personalityIcon}>😊</div>
                  <h3>Face Expression</h3>
                  <div className={styles.personalityMain}>
                    <div className={styles.expressionName}>{personality.mostCommonFace}</div>
                    <div className={styles.personalityLabel}>{personality.facePersonality}</div>
                  </div>
                  <div className={styles.personalityStats}>
                    {Object.entries(personality.faceStats)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([face, count]) => (
                        <div key={face} className={styles.statItem}>
                          <span className={styles.statName}>{face}</span>
                          <span className={styles.statCount}>{count}x</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Hand Personality */}
                <div className={styles.personalityCard}>
                  <div className={styles.personalityIcon}>👋</div>
                  <h3>Hand Gesture</h3>
                  <div className={styles.personalityMain}>
                    <div className={styles.expressionName}>
                      {personality.mostCommonHand === 'None' ? 'Natural' : personality.mostCommonHand}
                    </div>
                    <div className={styles.personalityLabel}>{personality.handPersonality}</div>
                  </div>
                  <div className={styles.personalityStats}>
                    {Object.entries(personality.handStats)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([hand, count]) => (
                        <div key={hand} className={styles.statItem}>
                          <span className={styles.statName}>{hand}</span>
                          <span className={styles.statCount}>{count}x</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              
              <div className={styles.personalityHint}>
                💡 <strong>Tip:</strong> Use Facial Expression detection feature for at least 1 minute to track your personality!
              </div>
            </div>
          )}
          
          {!personalityLoading && (!personality || personality.totalTracked === 0) && (
            <div className={styles.personalityEmpty}>
              <h3>🎭 Personality Analysis</h3>
              <p>Start using the Facial Expression detection feature to discover your personality based on your most common expressions and gestures!</p>
              <Link href="/facial-expression" className={styles.startButton}>
                Start Detection →
              </Link>
            </div>
          )}

          {/* Expression Distribution */}
          {Object.keys(stats.expressions).length > 0 && (
            <div className={styles.section}>
              <h2>Expression Distribution</h2>
              <div className={styles.expressionBars}>
                {Object.entries(stats.expressions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([expression, count]) => {
                    const percentage = (count / stats.total) * 100;
                    return (
                      <div key={expression} className={styles.barItem}>
                        <div className={styles.barLabel}>
                          <span className={styles.expression}>{expression}</span>
                          <span className={styles.count}>{count}</span>
                        </div>
                        <div className={styles.barTrack}>
                          <div 
                            className={styles.barFill} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Photo Viewer Modal (WhatsApp style with zoom) */}
      {isViewingPhoto && profilePhoto && (
        <div className={styles.photoModal} onClick={closePhotoModal}>
          <div className={styles.photoModalHeader}>
            <div className={styles.photoModalInfo}>
              <h3>{user.displayName || 'User'}</h3>
              <p>{user.email}</p>
            </div>
            <div className={styles.photoModalControls}>
              <div className={styles.zoomInfo}>
                {Math.round(photoZoom * 100)}%
              </div>
              <button 
                className={styles.zoomBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoZoom(prev => Math.max(0.5, prev - 0.2));
                }}
                title="Zoom out"
              >
                −
              </button>
              <button 
                className={styles.zoomBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoZoom(prev => Math.min(5, prev + 0.2));
                }}
                title="Zoom in"
              >
                +
              </button>
              <button 
                className={styles.zoomBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  resetPhotoView();
                }}
                title="Reset zoom"
              >
                ↺
              </button>
              <button 
                className={styles.photoModalClose}
                onClick={closePhotoModal}
              >
                ✕
              </button>
            </div>
          </div>
          <div 
            className={styles.photoModalContent}
            onWheel={handlePhotoWheel}
            onMouseDown={handlePhotoMouseDown}
            onMouseMove={handlePhotoMouseMove}
            onMouseUp={handlePhotoMouseUp}
            onMouseLeave={handlePhotoMouseUp}
            style={{ cursor: photoZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
          >
            <img 
              src={profilePhoto} 
              alt={user.displayName || 'User'}
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `scale(${photoZoom}) translate(${photoPan.x / photoZoom}px, ${photoPan.y / photoZoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                userSelect: 'none'
              }}
              draggable={false}
            />
          </div>
          <div className={styles.photoModalHint}>
            💡 Scroll to zoom • Drag to pan • Click outside to close
          </div>
        </div>
      )}
    </>
  );
}
