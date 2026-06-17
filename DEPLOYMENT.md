# Stock Opname Pro - Deployment Guide

## Optimasi Performa

Aplikasi ini sudah dioptimasi untuk performa tinggi dengan fitur-fitur berikut:

### 1. IndexedDB Caching (`src/lib/cache.ts`)
- **Products Master**: Di-cache 5 menit
- **Transactions**: Di-cache 1 menit
- Cache TTL dapat disesuaikan
- Automatic fallback ke cache saat offline

### 2. Offline Queue & Batch Sync (`src/lib/syncManager.ts`)
- Transaksi disimpan lokal dulu, lalu sync otomatis setiap 30 detik
- Retry logic otomatis (max 3x) saat gagal sync
- Queue processing saat kembali online
- Indikator pending sync di UI

### 3. Service Worker Caching (`public/sw.js`)
- **Static Assets**: Cache first (immutable, 1 tahun)
- **API Calls**: Network first, fallback cache
- **HTML Pages**: Stale-while-revalidate
- Auto-update saat ada versi baru

### 4. Vercel Caching Headers (`vercel.json`)
- Assets: `max-age=31536000, immutable`
- Images: `max-age=86400, stale-while-revalidate=604800`
- API: `no-cache, no-store, must-revalidate`

## Cara Deploy ke Vercel (Gratis)

### Prerequisites
- GitHub repository
- Akun Vercel (free tier)

### Steps

1. **Push ke GitHub**
   ```bash
   git add .
   git commit -m "feat: offline support & performance optimization"
   git push origin main
   ```

2. **Deploy di Vercel**
   - Buka https://vercel.com/new
   - Import repository GitHub
   - Framework: **Vite**
   - Build Command: `vite build`
   - Output Directory: `dist`

3. **Set Environment Variable**
   Tambahkan di Vercel dashboard:
   ```
   GOOGLE_SCRIPT_URL = https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   ```

4. **Deploy**

### Catatan Penting

- **Free Tier Limits**: 100GB bandwidth/bulan, 100 serverless execution/hari
- **Cold Start**: Vercel free tier punya cold start ~1-3 detik untuk serverless functions
- **Data Flow**: 
  ```
  User → Vercel CDN (cached assets) → Vercel Function → Google Apps Script → Google Sheets
  ```

## Troubleshooting

### App Loading Slow
1. Cek Vercel analytics untuk cold start
2. Pastikan service worker sudah registered
3. Cek network tab untuk cache hits

### Sync Gagal
1. Cek `GOOGLE_SCRIPT_URL` sudah benar
2. Cek Google Apps Script deployed sebagai Web App
3. Cek console untuk error details

### Offline Mode Tidak Jalan
1. Pastikan HTTPS (required untuk service worker)
2. Cek service worker registration di Application tab

## Performance Targets

| Metric | Target | Realistic |
|--------|--------|-----------|
| First Contentful Paint | <1s | ~1.5s |
| Time to Interactive | <2s | ~2.5s |
| Cache Hit Ratio | >90% | ~85% |
| Sync Latency | <500ms | 1-3s (GS dependency) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SCRIPT_URL` | Yes | Google Apps Script Web App URL |
| `PORT` | No | Server port (default: 3000) |