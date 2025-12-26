import Head from 'next/head'
import Link from 'next/link'
import styles from '@/styles/Home.module.css'

export default function Home() {
  const features = [
    {
      title: 'Hand Tracking',
      description: 'Deteksi dan tracking tangan real-time dengan 21 landmark points',
      icon: 'hand',
      link: '/hand-tracking'
    },
    {
      title: 'Facial Expression',
      description: 'Kenali ekspresi wajah: happy, sad, angry, surprised, neutral',
      icon: 'smile',
      link: '/facial-expression'
    },
    {
      title: 'Pose Detection',
      description: 'Full body pose tracking dengan 33 landmark points',
      icon: 'person',
      link: '/pose-detection'
    },
    {
      title: 'Free',
      description: 'Deteksi ekspresi & gesture → output gambar & audio otomatis',
      icon: 'media',
      link: '/free'
    }
  ]

  return (
    <>
      <Head>
        <title>AI Vision Studio - Computer Vision Web App</title>
        <meta name="description" content="Real-time Computer Vision menggunakan MediaPipe AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <h1 className={styles.title}>AI Vision Studio</h1>
            <p className={styles.subtitle}>Real-time Computer Vision menggunakan MediaPipe AI</p>
            <p className={styles.description}>
              Deteksi tangan, wajah, ekspresi, dan pose tubuh langsung di browser Anda
            </p>
            <Link href="/how-to-use" className={styles.tutorialButton}>
              📖 Panduan Penggunaan
            </Link>
          </header>

          <section className={styles.featuresSection}>
            <h2 className={styles.sectionTitle}>Fitur Computer Vision</h2>
            <div className={styles.featuresGrid}>
              {features.map((feature, index) => (
                <Link href={feature.link} key={index} className={styles.featureCard}>
                  <div className={styles.featureIcon}>
                    {feature.icon === 'hand' && (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                      </svg>
                    )}
                    {feature.icon === 'all' && (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                    )}
                    {feature.icon === 'media' && (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12h8M12 8v8" />
                      </svg>
                    )}
                    {feature.icon === 'face' && (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    )}
                    {feature.icon === 'smile' && (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 15h8" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    )}
                    {feature.icon === 'person' && (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="5" r="2" />
                        <path d="M12 7v8M12 15l-3 5M12 15l3 5M12 11l-3 2M12 11l3 2" />
                      </svg>
                    )}
                  </div>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureDescription}>{feature.description}</p>
                  <div className={styles.arrow}>→</div>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.techSection}>
            <h2 className={styles.sectionTitle}>Teknologi</h2>
            <div className={styles.techGrid}>
              <div className={styles.techItem}>MediaPipe AI</div>
              <div className={styles.techItem}>Real-time Processing</div>
              <div className={styles.techItem}>Browser-based</div>
              <div className={styles.techItem}>Next.js + TypeScript</div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
