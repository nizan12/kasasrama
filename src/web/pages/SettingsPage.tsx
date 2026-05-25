import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { PaymentFrequency } from "../utils/schedule";
import { getFrequencyLabel } from "../utils/schedule";
import { parseQRIS, validateQRIS } from "../../core";
import { CustomSelect } from "../components/CustomSelect";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import jsQR from "jsqr";

const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function SettingsPage() {
  const toast = useToast();
  const [asramaName, setAsramaName] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [dueDay, setDueDay] = useState(10);
  const [qrisString, setQrisString] = useState(""); // Raw QRIS string (static)
  const [qrisImage, setQrisImage] = useState(""); // Preview image (uploaded by admin)
  const [qrisMerchant, setQrisMerchant] = useState(""); // Parsed merchant name
  const [qrisMethod, setQrisMethod] = useState(""); // static/dynamic
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [qrisError, setQrisError] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [systemStartDate, setSystemStartDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "config"));
        if (snap.exists()) {
          const d = snap.data();
          setAsramaName(d.asramaName || "");
          setMonthlyFee(String(d.monthlyFee || ""));
          setQrisString(d.qrisString || "");
          setQrisImage(d.qrisImage || "");
          setLogoUrl(d.logoUrl || "");
          setBackgroundUrl(d.backgroundUrl || "");
          setFrequency((d.frequency as PaymentFrequency) || "monthly");
          setDueDay(d.dueDay ?? 10);
          setSystemStartDate(d.systemStartDate || "");

          if (d.qrisString) {
            try {
              const parsed = parseQRIS(d.qrisString);
              setQrisMerchant(parsed.merchantName);
              setQrisMethod(parsed.method);
            } catch { /* ignore */ }
          }
        }
        // Add a small delay for smooth skeleton transition
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    load();
  }, []);

  const extractQRISFromImage = (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject("Canvas tidak didukung"); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrResult = jsQR(imageData.data, canvas.width, canvas.height);
        if (qrResult && qrResult.data) {
          resolve(qrResult.data);
        } else {
          reject("Tidak dapat membaca QR code dari gambar");
        }
      };
      img.onerror = () => reject("Gagal memuat gambar");
      img.src = imageDataUrl;
    });
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setQrisError("Ukuran gambar maksimal 2MB");
      toast.warning("Ukuran gambar QRIS maksimal 2MB");
      return;
    }

    setQrisError("");

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setQrisImage(dataUrl);

      try {
        const extracted = await extractQRISFromImage(dataUrl);
        const validation = validateQRIS(extracted);
        if (!validation.valid) {
          const errText = `QRIS tidak valid: ${validation.errors.join(", ")}`;
          setQrisError(errText);
          toast.error("QRIS tidak valid");
          return;
        }

        const parsed = parseQRIS(extracted);
        setQrisString(extracted);
        setQrisMerchant(parsed.merchantName);
        setQrisMethod(parsed.method);
        setQrisError("");
        toast.success("QRIS berhasil diekstrak & divalidasi");
      } catch (err) {
        setQrisError(String(err));
        setQrisString("");
        setQrisMerchant("");
        setQrisMethod("");
        toast.error("Gagal mendeteksi QRIS pada gambar");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveQris = () => {
    setQrisImage("");
    setQrisString("");
    setQrisMerchant("");
    setQrisMethod("");
    setQrisError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Gambar QRIS dihapus");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "settings", "config"), {
        asramaName: asramaName.trim(),
        monthlyFee: Number(monthlyFee) || 0,
        frequency,
        dueDay,
        qrisString,
        qrisImage,
        logoUrl,
        backgroundUrl,
        systemStartDate,
      });
      setSaved(true);
      toast.success("Pengaturan sistem berhasil disimpan");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan pengaturan sistem");
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  // Resize to max 400px PNG — preserves transparency, no JPEG black background, good quality
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        // Fill with transparent background (PNG supports it)
        canvas.getContext("2d")!.clearRect(0, 0, w, h);
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Ukuran file logo maksimal 5MB");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setLogoUrl(compressed);
      toast.success("Logo berhasil diunggah");
    } catch {
      toast.error("Gagal memproses gambar logo");
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    if (logoInputRef.current) logoInputRef.current.value = "";
    toast.info("Logo dihapus");
  };

  const compressBackground = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.clearRect(0, 0, w, h);
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8)); // Use JPEG for large backgrounds
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Ukuran file background maksimal 5MB");
      return;
    }
    try {
      const compressed = await compressBackground(file);
      setBackgroundUrl(compressed);
      toast.success("Background berhasil diunggah");
    } catch {
      toast.error("Gagal memproses gambar background");
    } finally {
      if (bgInputRef.current) bgInputRef.current.value = "";
    }
  };

  const handleRemoveBg = () => {
    setBackgroundUrl("");
    if (bgInputRef.current) bgInputRef.current.value = "";
    toast.info("Background dihapus");
  };

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-5xl fade-in">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pengaturan Sistem</h1>
        <p className="text-slate-500 text-sm mt-1">Konfigurasi nominal kas, jadwal jatuh tempo, dan QRIS pembayaran</p>
      </div>

      {loading ? (
        <Skeleton type="settings" count={2} />
      ) : (

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column */}
            <div className="space-y-6">
              {/* General Settings */}
              <div className="premium-card p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Pengaturan Umum
                </h2>

                <div className="space-y-2">
                  <label htmlFor="set-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Asrama</label>
                  <input id="set-name" type="text" value={asramaName} onChange={(e) => setAsramaName(e.target.value)} className="input-premium text-sm text-slate-800" placeholder="Contoh: Asrama Putra Harun" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="set-fee" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nominal Kas Wajib <span className="normal-case text-indigo-500 font-semibold">(Total Per Bulan)</span>
                  </label>
                  <input id="set-fee" type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className="input-premium text-sm text-slate-800" placeholder="Contoh: 40000" min="1" step="1" required />
                  <p className="text-[11px] text-indigo-600 font-bold leading-relaxed">
                    {monthlyFee && Number(monthlyFee) > 0
                      ? `Total kas wajib per bulan: ${formatCurrency(Number(monthlyFee))} — dibagi rata per periode tagihan`
                      : "Tentukan total nominal kas yang harus dibayar penghuni per bulan"}
                  </p>
                </div>
              </div>

              {/* Schedule Settings */}
              <div className="premium-card p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-650" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Jadwal Pembayaran
                </h2>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frekuensi Pembayaran</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["daily", "weekly", "monthly"] as PaymentFrequency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => { setFrequency(f); if (f === "monthly") setDueDay(10); if (f === "weekly") setDueDay(1); }}
                        className={`p-4 rounded-2xl border text-center transition-all duration-300 ${frequency === f
                          ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm shadow-indigo-50/50"
                          : "bg-slate-50/50 border-slate-200/80 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                      >
                        <div className="text-slate-400 mb-2">
                          {f === "daily" ? (
                            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          ) : f === "weekly" ? (
                            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          ) : (
                            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                        </div>
                        <p className="text-xs font-extrabold uppercase tracking-wider">{getFrequencyLabel(f)}</p>
                        <p className="text-[10px] mt-0.5 text-slate-400 font-semibold">{f === "daily" ? "Hitung berdasar hari" : f === "weekly" ? "Hitung berdasar minggu" : "Tetap per bulan"}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {frequency === "monthly" && (
                  <div className="space-y-2">
                    <label htmlFor="set-due-monthly" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jatuh Tempo (Tanggal)</label>
                    <CustomSelect
                      options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Tanggal ${i + 1}` }))}
                      value={String(dueDay)}
                      onChange={(val) => setDueDay(Number(val))}
                      placeholder="Pilih Tanggal"
                    />
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Pembayaran otomatis jatuh tempo pada tanggal {dueDay} setiap bulan</p>
                  </div>
                )}

                {frequency === "weekly" && (
                  <div className="space-y-2">
                    <label htmlFor="set-due-weekly" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jatuh Tempo (Hari)</label>
                    <CustomSelect
                      options={dayNames.map((name, i) => ({ value: String(i), label: name }))}
                      value={String(dueDay)}
                      onChange={(val) => setDueDay(Number(val))}
                      placeholder="Pilih Hari"
                    />
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">
                      Total bulanan ({monthlyFee ? formatCurrency(Number(monthlyFee)) : "—"}) akan dibagi rata ke setiap hari {dayNames[dueDay]} dalam bulan tersebut
                    </p>
                  </div>
                )}

                {frequency === "daily" && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Tagihan bulanan akan dikalkulasikan secara otomatis berdasarkan total hari dalam bulan tersebut.
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <label htmlFor="set-start-date" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tanggal Mulai Sistem Aktif</label>
                  <input
                    id="set-start-date"
                    type="date"
                    value={systemStartDate}
                    onChange={(e) => setSystemStartDate(e.target.value)}
                    className="input-premium text-sm text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                    Tagihan kas hanya akan dihitung untuk tanggal/hari jatuh tempo yang jatuh pada atau setelah tanggal mulai ini. Berguna jika sebelumnya pembayaran dicatat secara manual.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* QRIS Settings */}
              <div className="premium-card p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Konfigurasi QRIS
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Upload kode QRIS <span className="text-slate-800 font-extrabold">statis</span> Anda. Sistem secara otomatis melakukan ekstraksi string payload dan melakukan injeksi nilai secara dinamis sesuai nominal kas.
                </p>

                {qrisError && (
                  <div className="p-3 mt-4 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-600 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{qrisError}</span>
                  </div>
                )}

                {qrisString ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-600 uppercase tracking-wide">
                          QRIS Terbaca
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">
                          {qrisMethod === "static" ? "Statis / Merchant" : "Dinamis"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{qrisMerchant || "Merchant Asrama"}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1 break-all bg-slate-50 p-2 rounded-xl border border-slate-100">{qrisString.substring(0, 120)}...</p>
                      </div>
                    </div>

                    {qrisImage && (
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="p-3 bg-white border border-slate-100 rounded-2xl inline-block flex-shrink-0">
                          <img src={qrisImage} alt="Static QRIS" className="w-28 h-28 object-contain animate-fade-in" />
                        </div>
                        <div className="space-y-2 text-center sm:text-left">
                          <p className="text-xs text-slate-600 font-bold">QRIS Statis Asli</p>
                          <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                            Sistem akan membuat QR Code unik berbayar senilai <span className="text-indigo-600 font-bold">{formatCurrency(Number(monthlyFee) || 0)}</span> secara langsung di layar penghuni.
                          </p>
                          <button
                            type="button"
                            onClick={handleRemoveQris}
                            className="text-xs text-rose-600 hover:text-rose-500 font-bold underline underline-offset-2 transition-colors pt-1"
                          >
                            Hapus QRIS
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500">Ganti file gambar QRIS:</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleQrisUpload}
                        className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer file:transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:border-slate-300 transition-colors cursor-pointer space-y-3 bg-slate-50/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 font-bold">Pilih File QRIS Statis</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">Format PNG, JPG — Ukuran file maksimal 2MB</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" />
                  </div>
                )}
              </div>

              {/* Logo Asrama */}
              <div className="premium-card p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Logo Asrama
                </h2>
                <p className="text-xs text-slate-500 font-medium">Logo akan tampil di sidebar aplikasi. Ukuran ideal persegi (1:1), format PNG/JPG.</p>

                {logoUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Logo terpasang
                      </span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => logoInputRef.current?.click()} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-100 transition-all">
                          Ganti Logo
                        </button>
                        <button type="button" onClick={handleRemoveLogo} className="text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-100 transition-all">
                          Hapus
                        </button>
                      </div>
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-6 flex flex-col items-center gap-2 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-700 font-bold">Upload Logo Asrama</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">PNG, JPG — Maks. 2MB</p>
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </button>
                )}
              </div>

              {/* Background Auth */}
              <div className="premium-card p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Background Login & Register
                </h2>
                <p className="text-xs text-slate-500 font-medium">Gambar yang akan ditampilkan sebagai latar belakang di halaman Login dan Daftar. Maks. 5MB.</p>

                {backgroundUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <img src={backgroundUrl} alt="Background" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Background terpasang
                      </span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => bgInputRef.current?.click()} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-100 transition-all">
                          Ganti Background
                        </button>
                        <button type="button" onClick={handleRemoveBg} className="text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-100 transition-all">
                          Hapus
                        </button>
                      </div>
                    </div>
                    <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-6 flex flex-col items-center gap-2 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer"
                    onClick={() => bgInputRef.current?.click()}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-700 font-bold">Upload Background Auth</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Maks. 5MB — Biarkan kosong untuk default</p>
                    </div>
                    <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-premium-primary"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Menyimpan...
                </>
              ) : (
                "Simpan Pengaturan"
              )}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-650 text-sm font-bold border border-emerald-100 fade-in">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Pengaturan Disimpan
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
