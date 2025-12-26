# Output Assets Guide

Folder ini berisi gambar dan audio yang akan muncul sebagai output berdasarkan kombinasi **Ekspresi + Gesture**.

## Kombinasi yang Tersedia

### Happy Combinations
- `happy-thumbs.jpg` + `happy-thumbs.mp3` → Happy + Thumbs Up
- `happy-peace.jpg` + `happy-peace.mp3` → Happy + Peace
- `happy-wave.jpg` + `happy-wave.mp3` → Happy + Open Hand

### Sad Combinations
- `sad-fist.jpg` + `sad-fist.mp3` → Sad + Fist
- `sad-peace.jpg` + `sad-peace.mp3` → Sad + Peace

### Angry Combinations
- `angry-fist.jpg` + `angry-fist.mp3` → Angry + Fist
- `angry-pointing.jpg` + `angry-pointing.mp3` → Angry + Pointing

### Surprised Combinations
- `surprised-open.jpg` + `surprised-open.mp3` → Surprised + Open Hand
- `surprised-peace.jpg` + `surprised-peace.mp3` → Surprised + Peace

### Neutral Combinations
- `neutral-thumbs.jpg` + `neutral-thumbs.mp3` → Neutral + Thumbs Up
- `neutral-peace.jpg` + `neutral-peace.mp3` → Neutral + Peace

## Cara Menambahkan Asset

1. Siapkan gambar (format: JPG/PNG) dan audio (format: MP3/WAV)
2. Rename sesuai dengan kombinasi yang diinginkan
3. Letakkan di folder ini (`public/outputs/`)
4. Asset akan otomatis dimuat saat kombinasi terdeteksi

## Contoh

Jika Anda ingin output untuk kombinasi **Happy + Thumbs Up**:
1. Siapkan gambar emoji jempol bahagia → rename menjadi `happy-thumbs.jpg`
2. Siapkan audio (misalnya suara "yeay!") → rename menjadi `happy-thumbs.mp3`
3. Letakkan kedua file di folder ini
4. Saat kamera mendeteksi ekspresi Happy + gesture Thumbs Up, gambar dan audio akan muncul otomatis!

## Catatan

- Jika file tidak ditemukan, output akan tetap hitam (black screen)
- Gunakan resolusi gambar 640x480 untuk hasil terbaik
- Audio akan otomatis play saat kombinasi terdeteksi
- Anda bisa menambahkan kombinasi baru di file `pages/free.tsx` di bagian `OUTPUT_MAP`
