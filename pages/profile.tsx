import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { updateProfile, updatePassword } from 'firebase/auth';
import { getPersonalityAnalysis, PersonalityAnalysis } from '@/lib/gestureTracking';
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

  useEffect(() => {
    if (!user) {
      router.push('/login');
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
    try {
      const url = user?.uid 
        ? `/api/get-detections?limit=50&userId=${user.uid}`
        : '/api/get-detections?limit=50';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setDetections(data.data);
        calculateStats(data.data);
      }
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

  const handleLogout = async () => {
    await logout();
    router.push('/');
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
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            
            {!isEditing && !isChangingPassword ? (
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

          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.total}</div>
              <div className={styles.statLabel}>Total Detections</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{Object.keys(stats.expressions).length}</div>
              <div className={styles.statLabel}>Unique Expressions</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>
                {Object.keys(stats.expressions).length > 0 
                  ? Object.entries(stats.expressions).sort((a, b) => b[1] - a[1])[0][0]
                  : 'N/A'}
              </div>
              <div className={styles.statLabel}>Most Common</div>
            </div>
          </div>

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

          {/* Detection History */}
          <div className={styles.section}>
            <h2>Recent Detections</h2>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : detections.length === 0 ? (
              <div className={styles.empty}>
                <p>No detections yet. Start using the app to see your history!</p>
                <Link href="/facial-expression" className={styles.startButton}>
                  Start Detecting →
                </Link>
              </div>
            ) : (
              <div className={styles.detectionList}>
                {detections.map((detection) => (
                  <div key={detection.id} className={styles.detectionItem}>
                    <div className={styles.detectionIcon}>
                      {detection.type === 'expression' ? '😊' : '👋'}
                    </div>
                    <div className={styles.detectionInfo}>
                      <div className={styles.detectionResult}>{detection.result}</div>
                      <div className={styles.detectionMeta}>
                        {detection.type} • {detection.confidence}% confidence
                        {detection.metadata?.age && ` • ${detection.metadata.age}yo ${detection.metadata.gender}`}
                      </div>
                    </div>
                    <div className={styles.detectionTime}>
                      {formatDate(detection.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
