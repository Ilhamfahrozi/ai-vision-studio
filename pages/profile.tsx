import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
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

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchDetections();
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
            <h1>{user.displayName || 'User'}</h1>
            <p className={styles.email}>{user.email}</p>
          </div>

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
