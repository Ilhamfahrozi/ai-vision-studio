import Head from 'next/head'
import Link from 'next/link'
import styles from '@/styles/Gestures.module.css'

export default function Gestures() {
  const gestures = [
    {
      name: 'Fist',
      description: 'Semua jari tertutup, membentuk kepalan tangan',
      usage: 'Bisa untuk kontrol stop/pause'
    },
    {
      name: 'Pointing',
      description: 'Hanya jari telunjuk yang terangkat',
      usage: 'Untuk menunjuk atau memilih objek'
    },
    {
      name: 'Peace Sign',
      description: 'Jari telunjuk dan jari tengah terangkat (V shape)',
      usage: 'Untuk navigasi atau konfirmasi'
    },
    {
      name: 'Three Fingers',
      description: 'Tiga jari terangkat (telunjuk, tengah, manis)',
      usage: 'Untuk menu atau opsi tambahan'
    },
    {
      name: 'Open Hand',
      description: 'Semua jari terbuka lebar',
      usage: 'Untuk reset atau membuka menu utama'
    }
  ]

  return (
    <>
      <Head>
        <title>Gesture List - Hand Tracking</title>
        <meta name="description" content="Daftar gesture yang dapat dideteksi" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Home
          </Link>
          <h1>Gesture List</h1>
        </header>

        <div className={styles.content}>
          <div className={styles.intro}>
            <h2>Daftar Gesture yang Dapat Dideteksi</h2>
            <p>Berikut adalah gesture-gesture tangan yang dapat dikenali oleh sistem hand tracking kami</p>
          </div>

          <div className={styles.gestureGrid}>
            {gestures.map((gesture, index) => (
              <div key={index} className={styles.gestureCard}>
                <div className={styles.gestureIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                  </svg>
                </div>
                <h3>{gesture.name}</h3>
                <p className={styles.description}>{gesture.description}</p>
                <div className={styles.usage}>
                  <span className={styles.usageLabel}>Kegunaan:</span>
                  <span>{gesture.usage}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.cta}>
            <h3>Siap Mencoba?</h3>
            <p>Buka halaman hand tracking untuk mencoba mendeteksi gesture Anda</p>
            <Link href="/hand-tracking" className={styles.btnPrimary}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Mulai Hand Tracking
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
