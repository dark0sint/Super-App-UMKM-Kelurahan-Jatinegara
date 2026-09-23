// Data awal (seed) — dijalankan otomatis sekali saat database pertama kali dibuat.
function runSeed(db) {
  const insertPanduan = db.prepare(`
    INSERT INTO perizinan_panduan (jenis, urutan, judul, deskripsi, syarat, link_resmi)
    VALUES (@jenis, @urutan, @judul, @deskripsi, @syarat, @link_resmi)
  `);

  const panduanNIB = [
    { urutan: 1, judul: 'Siapkan data diri & usaha', deskripsi: 'Siapkan NIK, alamat usaha, dan gambaran singkat kegiatan usaha Anda.', syarat: JSON.stringify(['KTP', 'NPWP (jika ada)', 'Nomor HP & email aktif']) },
    { urutan: 2, judul: 'Buat akun OSS', deskripsi: 'Daftar akun di sistem Online Single Submission (OSS) menggunakan NIK.', syarat: JSON.stringify(['Akses internet', 'NIK aktif']) },
    { urutan: 3, judul: 'Isi data usaha di OSS', deskripsi: 'Masukkan jenis usaha (KBLI), skala usaha (mikro/kecil), dan lokasi usaha.', syarat: JSON.stringify(['Nama usaha', 'Jenis kegiatan usaha']) },
    { urutan: 4, judul: 'Terbitkan NIB', deskripsi: 'Setelah data lengkap, NIB akan terbit otomatis dan bisa langsung diunduh sebagai PDF.', syarat: JSON.stringify(['Semua data pada langkah sebelumnya sudah benar']) },
    { urutan: 5, judul: 'Simpan & cetak NIB', deskripsi: 'Simpan salinan digital dan cetak NIB sebagai identitas legal usaha Anda.', syarat: JSON.stringify([]) },
  ].map(s => ({ jenis: 'NIB', link_resmi: 'https://oss.go.id', ...s }));

  const panduanHalal = [
    { urutan: 1, judul: 'Pastikan bahan baku halal', deskripsi: 'Periksa seluruh bahan baku dan bahan tambahan yang dipakai sudah bersertifikat halal atau tidak termasuk bahan haram.', syarat: JSON.stringify(['Daftar bahan baku lengkap']) },
    { urutan: 2, judul: 'Miliki NIB', deskripsi: 'Sertifikasi halal mensyaratkan usaha sudah memiliki NIB terlebih dahulu.', syarat: JSON.stringify(['NIB aktif']) },
    { urutan: 3, judul: 'Daftar melalui SIHALAL / self declare', deskripsi: 'UMKM dengan risiko rendah dapat mengajukan lewat jalur pernyataan mandiri (self declare) yang gratis melalui BPJPH.', syarat: JSON.stringify(['Akun SIHALAL', 'Foto produk & proses produksi']) },
    { urutan: 4, judul: 'Pendampingan oleh Pendamping PPH', deskripsi: 'Proses verifikasi dibantu oleh Pendamping Proses Produk Halal yang ditunjuk BPJPH.', syarat: JSON.stringify([]) },
    { urutan: 5, judul: 'Terbit sertifikat halal', deskripsi: 'Setelah disetujui, sertifikat halal terbit dan berlaku selama produk & proses tidak berubah.', syarat: JSON.stringify([]) },
  ].map(s => ({ jenis: 'HALAL', link_resmi: 'https://ptsp.halal.go.id', ...s }));

  const panduanPIRT = [
    { urutan: 1, judul: 'Ikuti penyuluhan keamanan pangan', deskripsi: 'Pelaku usaha wajib mengikuti Penyuluhan Keamanan Pangan (PKP) dari Dinas Kesehatan.', syarat: JSON.stringify(['KTP', 'Surat pengantar RT/RW atau kelurahan']) },
    { urutan: 2, judul: 'Persiapkan lokasi produksi', deskripsi: 'Pastikan tempat produksi bersih dan sesuai standar sanitasi dasar.', syarat: JSON.stringify(['Foto lokasi & peralatan produksi']) },
    { urutan: 3, judul: 'Ajukan permohonan ke DPMPTSP/Dinkes', deskripsi: 'Daftarkan produk pangan olahan melalui dinas terkait atau OSS.', syarat: JSON.stringify(['NIB', 'Label kemasan produk']) },
    { urutan: 4, judul: 'Survei/verifikasi lapangan', deskripsi: 'Petugas akan melakukan pemeriksaan ke lokasi produksi.', syarat: JSON.stringify([]) },
    { urutan: 5, judul: 'Terbit nomor P-IRT', deskripsi: 'Nomor P-IRT terbit dan wajib dicantumkan pada label kemasan produk.', syarat: JSON.stringify([]) },
  ].map(s => ({ jenis: 'PIRT', link_resmi: 'https://oss.go.id', ...s }));

  const trx = db.transaction((rows) => rows.forEach(r => insertPanduan.run(r)));
  trx([...panduanNIB, ...panduanHalal, ...panduanPIRT]);

  const insertMateri = db.prepare(`
    INSERT INTO edukasi_materi (kategori, judul, deskripsi, konten_url, durasi_menit, ukuran_mb)
    VALUES (@kategori, @judul, @deskripsi, @konten_url, @durasi_menit, @ukuran_mb)
  `);
  const materi = [
    { kategori: 'tips', judul: 'Cara menghitung untung bersih dengan benar', deskripsi: 'Bedanya omzet, laba kotor, dan laba bersih — dijelaskan dengan contoh warung sehari-hari.', konten_url: null, durasi_menit: null, ukuran_mb: null },
    { kategori: 'tips', judul: '5 kesalahan UMKM saat menetapkan harga jual', deskripsi: 'Hindari rugi karena salah hitung modal dan biaya operasional.', konten_url: null, durasi_menit: null, ukuran_mb: null },
    { kategori: 'video', judul: 'Belajar QRIS dalam 3 menit', deskripsi: 'Video singkat hemat kuota tentang cara menerima pembayaran QRIS.', konten_url: 'https://example.com/video/qris-3-menit.mp4', durasi_menit: 3, ukuran_mb: 8 },
    { kategori: 'video', judul: 'Foto produk pakai HP biar laku di marketplace', deskripsi: 'Tips foto produk sederhana tanpa kamera mahal.', konten_url: 'https://example.com/video/foto-produk.mp4', durasi_menit: 4, ukuran_mb: 10 },
    { kategori: 'artikel', judul: 'Langkah mudah mengurus NIB dari HP', deskripsi: 'Panduan ringkas sebelum masuk ke fitur Konsultasi & Perizinan di aplikasi.', konten_url: null, durasi_menit: null, ukuran_mb: null },
  ];
  const trx2 = db.transaction((rows) => rows.forEach(r => insertMateri.run(r)));
  trx2(materi);

  db.prepare(`INSERT INTO kurir (name, wa_number, kendaraan, is_active) VALUES (?, ?, ?, 1)`).run('Bang Udin', '628111111111', 'motor');
  db.prepare(`INSERT INTO kurir (name, wa_number, kendaraan, is_active) VALUES (?, ?, ?, 1)`).run('Kang Asep', '628222222222', 'motor');

  // Akun admin kelurahan default (dev/demo). Ganti nomor WA ini setelah deploy.
  db.prepare(`INSERT INTO users (wa_number, name, role) VALUES (?, ?, 'admin')`).run('628000000000', 'Admin Kelurahan Jatinegara');

  console.log('[DB] Seed selesai. Admin default: 628000000000');
}

module.exports = { runSeed };
