# Ringkasan Audit Keamanan

## Cakupan dan metode

Tinjauan statis terbatas pada `src/aes.js` dan `src/App.jsx`. Tidak ada build,
test, atau eksekusi aplikasi yang dijalankan.

## Hasil

- Tidak ditemukan kerentanan kriptografi atau React yang terkonfirmasi dalam
  tinjauan statis ini.
- Fungsi `generateKey()` di `src/App.jsx` menghasilkan kunci melalui
  `crypto.getRandomValues()` dengan panjang sesuai pilihan AES-128/192/256.
  Ini menggunakan generator acak kriptografis Web Crypto; tidak diperlukan
  perubahan kode untuk persyaratan tersebut.
- Aplikasi memakai AES-CBC, yang tidak menyediakan autentikasi/integritas
  ciphertext. Antarmuka sudah memperingatkan bahwa CBC tidak memverifikasi
  integritas dan aplikasi ditujukan untuk pembelajaran, bukan data sensitif
  produksi. Karena itu, hal tersebut tidak dicatat sebagai celah terkonfirmasi
  dari bukti yang ditinjau.

## Validasi yang belum dilakukan

`npm run build` tidak dijalankan. Lingkungan ini tidak menyediakan sandbox
terisolasi dengan kontrol yang diwajibkan untuk menjalankan kode proyek.
Perilaku runtime dan hasil build karenanya belum diverifikasi; hasil ini bukan
klaim bahwa seluruh permukaan aplikasi telah divalidasi.
