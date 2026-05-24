import { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { PaymentFrequency } from "../utils/schedule";
import { getFrequencyLabel, getPeriods } from "../utils/schedule";
import { CustomSelect } from "../components/CustomSelect";
import { Skeleton } from "../components/Skeleton";
import { Modal } from "../components/Modal";

interface Payment {
  id: string;
  residentName: string;
  periodKey: string;
  periodLabel: string;
  frequency: string;
  amount: number;
  note: string;
  paidAt: { seconds: number } | null;
  proofImage?: string;
  month?: number;
  year?: number;
}

const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export function PaymentHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [periods, setPeriods] = useState<{ key: string; label: string }[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const imageRef = useRef<string>("");
  if (viewingImage) imageRef.current = viewingImage; // preserve during close animation

  const closeImageViewer = () => setViewingImage(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "config"));
      let freq: PaymentFrequency = "monthly";
      if (settingsSnap.exists()) {
        freq = (settingsSnap.data().frequency as PaymentFrequency) || "monthly";
      }
      setFrequency(freq);

      const count = freq === "daily" ? 30 : freq === "weekly" ? 12 : 12;
      const p = getPeriods(freq, count);
      setPeriods(p);

      let q;
      if (selectedPeriod !== "all") {
        q = query(collection(db, "payments"), where("periodKey", "==", selectedPeriod));
      } else {
        q = collection(db, "payments");
      }
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          periodLabel: raw.periodLabel || (raw.month && raw.year ? `${monthNames[(raw.month as number) - 1]} ${raw.year}` : "Unknown"),
          periodKey: raw.periodKey || (raw.month && raw.year ? `${raw.year}-${String(raw.month).padStart(2, "0")}` : ""),
        } as Payment;
      });
      data.sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));
      setPayments(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedPeriod]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const filtered = payments.filter((p) =>
    p.residentName.toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 pt-12 lg:pt-0 fade-in">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Riwayat Pembayaran</h1>
        <p className="text-slate-500 text-sm mt-1">Semua data transaksi pembayaran kas masuk — {getFrequencyLabel(frequency)}</p>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Cari nama penghuni..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="input-premium pl-12 text-sm text-slate-800" 
          />
        </div>
        <div className="w-full sm:w-64">
          <CustomSelect 
            options={[
              { value: "all", label: "Semua Periode" },
              ...periods.map(p => ({ value: p.key, label: p.label }))
            ]}
            value={selectedPeriod} 
            onChange={setSelectedPeriod} 
            placeholder="Pilih Periode"
          />
        </div>
      </div>

      {/* Quick Summary Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-650 border border-indigo-100">
          Total Transaksi: {filtered.length}
        </span>
        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-650 border border-emerald-100 font-bold">
          Total Kas: {formatCurrency(totalAmount)}
        </span>
      </div>

      {/* History Card Table */}
      <div className="premium-card overflow-hidden bg-white border border-slate-100 shadow-sm">
        {loading ? (
          <Skeleton type="table" count={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </span>
            <p className="text-slate-400 text-sm mt-3 font-bold">Belum ada riwayat transaksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Penghuni</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Periode</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nominal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal Transaksi</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-650 flex-shrink-0">
                          {p.residentName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{p.residentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 text-sm font-semibold">{p.periodLabel}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold text-sm">{formatCurrency(p.amount)}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-medium">
                      {p.paidAt ? new Date(p.paidAt.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-semibold max-w-[200px] truncate" title={p.note || "-"}>{p.note || "-"}</td>
                    <td className="px-6 py-4">
                      {p.proofImage && (
                        <button
                          onClick={() => setViewingImage(p.proofImage!)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-bold border border-indigo-100 whitespace-nowrap"
                        >
                          Lihat Bukti
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Viewer Modal — standard Modal component */}
      <Modal isOpen={!!viewingImage} onClose={closeImageViewer} title="Bukti Pembayaran" size="lg">
        <img src={imageRef.current} alt="Bukti Pembayaran" className="w-full max-h-[70vh] object-contain rounded-2xl" />
      </Modal>
    </div>
  );
}
