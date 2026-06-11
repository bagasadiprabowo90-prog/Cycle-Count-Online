# Stock Opname Pro

Aplikasi input stok berbasis React + Express untuk Product In, Cycle Count, riwayat transaksi, dan scan barcode 1D. Data master dan transaksi disinkronkan melalui Google Apps Script ke Google Sheets.

Login operator memakai nama bebas dengan password tetap `blp123`.

## Persiapan

1. Install dependency:
   ```bash
   npm install
   ```

2. Buat file `.env.local` dari `.env.example`, lalu isi URL Google Apps Script:
   ```bash
   GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
   PORT=3000
   ```

3. Jalankan lokal:
   ```bash
   npm run dev
   ```

## Database Google Sheets

Gunakan file [database/google-apps-script.gs](database/google-apps-script.gs) sebagai kode Google Apps Script. Buat tiga sheet dengan nama dan kolom berikut:

- `Daftar Product`: `Barcode`, `SKU`, `Product`, `Batch`
- `Product In`: `Row ID`, `Date`, `Barcode`, `SKU`, `Product`, `Batch`, `SKU_BATCH`, `Qty`, `Status`, `User`
- `Cycle Count`: `Row ID`, `Date`, `Barcode`, `SKU`, `Product`, `Batch`, `SKU_BATCH`, `Qty`, `User`

Saat menyimpan transaksi baru, Apps Script selalu menambahkan data ke baris paling bawah dengan `appendRow`, sehingga history lama dan baris kosong di tengah tidak disentuh.

Apps Script saat ini memakai `SPREADSHEET_ID` berikut:

```text
16kGt5RM2bpAA8iDqlqS1SgATEHYN1X5B8JaLCz29Wvo
```

Jika Apps Script dibuat langsung dari Google Sheets lewat menu Extensions, `SPREADSHEET_ID` sebenarnya boleh dibiarkan kosong. Jika Apps Script berdiri sendiri, isi `SPREADSHEET_ID` di file Apps Script dengan ID dari URL Google Sheets:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

Deploy Apps Script sebagai Web App:

- Execute as: `Me`
- Who has access: sesuaikan kebutuhan, biasanya `Anyone` jika dipakai dari aplikasi ini tanpa login Google
- Copy Web App URL ke `.env.local` sebagai `GOOGLE_SCRIPT_URL`

## Script

- `npm run dev` menjalankan server Express + Vite.
- `npm run typecheck` mengecek TypeScript tanpa membuat output.
- `npm run build` membuat build production frontend dan backend.
- `npm start` menjalankan hasil build dari `dist/server.cjs`.

## Catatan Deploy

Pastikan environment production memiliki `GOOGLE_SCRIPT_URL`. Untuk hosting yang menyediakan port dinamis, isi atau biarkan platform mengatur `PORT`.

## Deploy ke Render

Repository ini sudah menyertakan `render.yaml` untuk deploy sebagai Node Web Service.

1. Push branch ke GitHub.
2. Di Render, pilih New > Blueprint, lalu hubungkan repository GitHub ini.
3. Saat diminta environment variable, isi:
   ```bash
   GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
   ```
4. Render akan menjalankan:
   ```bash
   npm ci && npm run build
   npm start
   ```

`DATA_DIR` diarahkan ke `/var/data` supaya database SQLite lokal memakai persistent disk Render.
