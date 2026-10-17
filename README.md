# chartcut web

Editor video 9:16 yang jalan sepenuhnya di browser. Tidak ada server, tidak ada upload.
Rekaman layar landscape masuk, MP4 vertikal siap upload keluar.

## Pakai

1. Buka halaman.
2. Pilih berkas rekaman (mp4/mov/mkv/webm).
3. Isi hook, label, watermark, CTA.
4. Klik **Render video**.
5. Klik **Unduh MP4**.

## Fitur

- Crop + zoom otomatis ke 1080x1920
- Hook text (0 sampai N detik), posisi aman dari UI TikTok
- Label konsep timed, bisa banyak
- Watermark terus-menerus
- Kartu CTA di akhir
- Caption dari berkas .srt (burn-in)
- Push-in zoom halus (naikkan retention)
- Geser fokus horizontal/vertikal
- Pengali kecepatan
- Pilih FPS dan bitrate
- Opsi buang audio asli
- Setelan tersimpan otomatis di browser

## Cara kerja

Render memakai **WebCodecs** (VideoEncoder + AudioEncoder) dan **mp4-muxer**.
Frame digambar deterministik per tick, bukan realtime, jadi hasilnya presisi dan
tidak kehilangan frame.

Audio didekode lewat WebAudio, disandikan ke AAC, lalu digabung ke MP4.

## Syarat browser

Chrome / Edge versi baru (butuh WebCodecs). Firefox dan Safari belum didukung penuh.

Video diproses lokal — tidak ada yang dikirim ke internet.

## Struktur

```
index.html
style.css
app.js
vendor/mp4-muxer/mp4-muxer.mjs
```

## Catatan

- Video panjang (di atas ~5 menit) bisa kehabisan memori karena diproses di tab.
- Render berjalan lebih lambat dari realtime pada mesin lemah.
