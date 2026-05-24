import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Skeleton } from "../components/Skeleton";

interface Payment {
  id: string;
  amount: number;
  periodKey: string;
  periodLabel: string;
  status: string;
  paidAt: { seconds: number } | null;
  note: string;
  proofImage?: string;
}

export function ResidentHistoryPage() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Image viewer state with animation
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imageVisible, setImageVisible] = useState(false);
  const [imageRendered, setImageRendered] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    if (viewingImage) {
      setImageRendered(true);
      document.body.style.overflow = "hidden";
      timeoutId = window.setTimeout(() => setImageVisible(true), 10);
    } else {
      setImageVisible(false);
      document.body.style.overflow = "";
      timeoutId = window.setTimeout(() => setImageRendered(false), 300);
    }
    return () => {
      clearTimeout(timeoutId);
      document.body.style.overflow = "";
    };
  }, [viewingImage]);

  const closeImageViewer = () => {
    setImageVisible(false);
    setTimeout(() => setViewingImage(null), 300);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const loadData = useCallback(async () => {
    if (!profile?.residentId) return;
    try {
      const payQuery = query(collection(db, "payments"), where("residentId", "==", profile.residentId));
      const paySnap = await getDocs(payQuery);
      const payList = paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
      payList.sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));
      setHistory(payList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profile?.residentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <Skeleton type="residentHistory" />;

  return (
    <div className="space-y-6 pt-12 lg:pt-0 w-full fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
          <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </span>
          Riwayat Kas
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">Seluruh riwayat pembayaran kas asrama Anda.</p>
      </div>

      <div className="premium-card p-0 bg-white border border-slate-100 overflow-hidden">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <p className="text-slate-500 text-sm mt-3 font-semibold">Belum ada riwayat pembayaran.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Periode</th>
                  <th scope="col" className="px-6 py-4 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th scope="col" className="px-6 py-4 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Nominal</th>
                  <th scope="col" className="px-6 py-4 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Catatan</th>
                  <th scope="col" className="px-6 py-4 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-800 text-sm">{h.periodLabel}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-500 font-medium">
                        {h.paidAt ? new Date(h.paidAt.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-extrabold ${h.status === "confirmed" ? "text-emerald-650" : "text-amber-650"}`}>
                        {formatCurrency(h.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {h.status === "confirmed" ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Lunas
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                          <svg className="w-3.5 h-3.5 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Verifikasi
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium max-w-[200px] truncate">
                      {h.note || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {h.proofImage ? (
                        <button
                          onClick={() => setViewingImage(h.proofImage!)}
                          className="group flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 px-3 py-1.5 rounded-xl transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Lihat
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 font-medium">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {imageRendered && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm transition-opacity duration-300 ${imageVisible ? "opacity-100" : "opacity-0"}`}
          onClick={closeImageViewer}
        >
          <div
            className={`relative max-w-3xl w-full flex flex-col items-center gap-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${imageVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-1 px-1">
              <span className="text-white/70 text-sm font-semibold">Bukti Pembayaran</span>
              <button
                onClick={closeImageViewer}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {viewingImage && (
              <img
                src={viewingImage}
                alt="Bukti Pembayaran"
                className="max-h-[80vh] w-full rounded-2xl shadow-2xl bg-white object-contain"
              />
            )}
            <p className="text-white/40 text-xs font-medium">Klik di luar gambar untuk menutup</p>
          </div>
        </div>
      )}
    </div>
  );
}
