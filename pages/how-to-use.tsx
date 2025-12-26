import Head from 'next/head'
import Link from 'next/link'
import styles from '@/styles/HowToUse.module.css'

export default function HowToUse() {
  const tutorials = [
    {
      title: 'Hand Tracking Tutorial',
      description: 'Pelajari cara menggunakan fitur hand tracking untuk mendeteksi gerakan tangan dan gesture recognition',
      media: '/hand-tutorial.gif',
      type: 'gif',
      features: [
        'Deteksi 21 landmark points per tangan',
        'Gesture recognition (fist, peace, pointing, dll)',
        'Support hingga 2 tangan sekaligus',
        'Real-time tracking dengan FPS tinggi'
      ],
      link: '/hand-tracking'
    },
    {
      title: 'Facial Expression Tutorial',
      description: 'Panduan lengkap menggunakan facial expression recognition untuk mendeteksi 7 emosi (Happy, Sad, Angry, Surprised, Fear, Disgust, Neutral)',
      media: '/face-tutorial.mp4',
      type: 'video',
      features: [
        'Deteksi 7 ekspresi wajah',
        'Real-time emotion recognition',
        'Confidence score untuk setiap emosi',
        'History tracking emosi'
      ],
      link: '/facial-expression'
    },
    {
      title: 'Pose Detection Tutorial',
      description: 'Tutorial pose detection untuk tracking full body dengan 33 landmark points dan skeleton visualization',
      media: '/pose-tutorial.mp4',
      type: 'video',
      features: [
        'Full body pose tracking',
        '33 landmark points',
        'Skeleton visualization',
        'Activity recognition'
      ],
      link: '/pose-detection'
    }
  ]

  return (
    <>
      <Head>
        <title>How to Use - AI Vision Studio</title>
        <meta name="description" content="Tutorial lengkap penggunaan AI Vision Studio" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backButton}>← Back to Home</Link>
          <div className={styles.headerContent}>
            <h1>Panduan Penggunaan</h1>
            <p>Tutorial lengkap untuk setiap fitur Computer Vision</p>
          </div>
        </header>

        <main className={styles.main}>
          {/* Intro Section */}
          <section className={styles.intro}>
            <div className={styles.introCard}>
              <h2>Selamat Datang di AI Vision Studio! 👋</h2>
              <p>
                AI Vision Studio adalah platform Computer Vision berbasis web yang menggunakan 
                teknologi <strong>MediaPipe AI</strong> dari Google. Di sini Anda bisa mencoba 
                berbagai fitur deteksi real-time langsung di browser!
              </p>
              <div className={styles.quickTips}>
                <h3>Quick Tips:</h3>
                <ul>
                  <li>✅ Pastikan webcam Anda terhubung</li>
                  <li>✅ Izinkan akses kamera saat diminta browser</li>
                  <li>✅ Gunakan pencahayaan yang baik</li>
                  <li>✅ Posisikan diri di tengah frame kamera</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Tutorials Grid */}
          <section className={styles.tutorials}>
            {tutorials.map((tutorial, index) => (
              <div key={index} className={styles.tutorialCard}>
                <div className={styles.mediaContainer}>
                  {tutorial.type === 'gif' ? (
                    <img 
                      src={tutorial.media} 
                      alt={tutorial.title}
                      className={styles.tutorialMedia}
                    />
                  ) : (
                    <video 
                      src={tutorial.media}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className={styles.tutorialMedia}
                    />
                  )}
                  <div className={styles.mediaOverlay}>
                    <span className={styles.mediaType}>
                      {tutorial.type === 'gif' ? 'GIF' : 'VIDEO'}
                    </span>
                  </div>
                </div>

                <div className={styles.tutorialContent}>
                  <h2>{tutorial.title}</h2>
                  <p className={styles.tutorialDescription}>{tutorial.description}</p>
                  
                  <div className={styles.features}>
                    <h3>Fitur Utama:</h3>
                    <ul>
                      {tutorial.features.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  </div>

                  <Link href={tutorial.link} className={styles.tryButton}>
                    Coba Sekarang →
                  </Link>
                </div>
              </div>
            ))}
          </section>

          {/* General Instructions */}
          <section className={styles.instructions}>
            <h2>Langkah-langkah Umum Penggunaan</h2>
            <div className={styles.stepsGrid}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <h3>Pilih Fitur</h3>
                <p>Pilih fitur Computer Vision yang ingin Anda coba (Hand Tracking, Face Detection, atau Pose Detection)</p>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <h3>Izinkan Akses Kamera</h3>
                <p>Browser akan meminta izin akses kamera. Klik "Allow" atau "Izinkan" untuk melanjutkan</p>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <h3>Klik Start</h3>
                <p>Klik tombol "Start Detection" atau "Start Tracking" untuk memulai deteksi real-time</p>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <h3>Posisikan Diri</h3>
                <p>Posisikan tangan/wajah/tubuh Anda di depan kamera sesuai dengan fitur yang dipilih</p>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>5</div>
                <h3>Lihat Hasil</h3>
                <p>AI akan mendeteksi dan menampilkan landmarks/skeleton secara real-time di layar</p>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>6</div>
                <h3>Eksperimen!</h3>
                <p>Coba berbagai gesture, ekspresi, atau pose untuk melihat kemampuan AI</p>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className={styles.faq}>
            <h2>Frequently Asked Questions</h2>
            <div className={styles.faqGrid}>
              <div className={styles.faqItem}>
                <h3>❓ Kamera tidak terdeteksi?</h3>
                <p>Pastikan webcam terhubung dan tidak digunakan aplikasi lain. Refresh browser dan izinkan akses kamera.</p>
              </div>
              
              <div className={styles.faqItem}>
                <h3>❓ Deteksi tidak akurat?</h3>
                <p>Gunakan pencahayaan yang baik dan posisikan diri di tengah frame. Hindari background yang ramai.</p>
              </div>
              
              <div className={styles.faqItem}>
                <h3>❓ Aplikasi lambat?</h3>
                <p>Gunakan browser Chrome untuk performa terbaik. Tutup tab browser lain yang tidak perlu.</p>
              </div>
              
              <div className={styles.faqItem}>
                <h3>❓ Apakah data saya aman?</h3>
                <p>Ya! Semua proses dilakukan di browser Anda. Tidak ada data yang dikirim ke server.</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
