import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Skeleton } from "../components/Skeleton";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "pending">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const imageRef = useRef<string>("");
  if (viewingImage) imageRef.current = viewingImage;

  const closeImageViewer = () => setViewingImage(null);

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

  const filtered = useMemo(() => {
    let list = history;
    if (statusFilter !== "all") list = list.filter((h) => h.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.periodLabel.toLowerCase().includes(q) ||
          (h.note || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [history, statusFilter, search]);

  // Reset to page 1 when filter/search changes
  useMemo(() => setPage(1), [statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  if (loading) return <Skeleton type="residentHistory" />;

  const statusTabs: { key: "all" | "confirmed" | "pending"; label: string; count: number }[] = [
    { key: "all", label: "Semua", count: history.length },
    { key: "confirmed", label: "Lunas", count: history.filter((h) => h.status === "confirmed").length },
    { key: "pending", label: "Verifikasi", count: history.filter((h) => h.status === "pending").length },
  ];

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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari periode atau catatan..."
            className="input-premium pl-10 text-sm text-slate-800 w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl flex-shrink-0">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                statusFilter === tab.key
                  ? tab.key === "confirmed" ? "bg-emerald-100 text-emerald-600"
                    : tab.key === "pending" ? "bg-amber-100 text-amber-600"
                    : "bg-indigo-100 text-indigo-600"
                  : "bg-slate-200 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="premium-card p-0 bg-white border border-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <p className="text-slate-500 text-sm mt-3 font-semibold">
              {history.length === 0 ? "Belum ada riwayat pembayaran." : "Tidak ada data yang cocok dengan filter."}
            </p>
            {(search || statusFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Reset filter
              </button>
            )}
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
                {paginated.map((h) => (
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
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filtered.length}
          itemsPerPage={perPage}
          onItemsPerPageChange={(val) => { setPerPage(val); setPage(1); }}
        />
      </div>

      <Modal isOpen={!!viewingImage} onClose={closeImageViewer} title="Bukti Pembayaran" size="lg">
        <img src={imageRef.current} alt="Bukti Pembayaran" className="w-full max-h-[70vh] object-contain rounded-2xl" />
      </Modal>
    </div>
  );
}
