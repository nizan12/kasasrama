import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import type { PaymentFrequency } from "../utils/schedule";
import { getCurrentPeriodKey, getPeriods, getFrequencyLabel, getDynamicFee } from "../utils/schedule";

interface Resident { id: string; name: string; room: string; }
interface PayInfo { id: string; amount: number; status?: string; proofImage?: string; note?: string; }

export function PaymentPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [paidMap, setPaidMap] = useState<Record<string, PayInfo>>({});
  const [loading, setLoading] = useState(true);
  const [baseFee, setBaseFee] = useState(50000);
  const [dueDay, setDueDay] = useState(1);
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [confirmResident, setConfirmResident] = useState<Resident | null>(null);
  const [confirmAction, setConfirmAction] = useState<"pay" | "cancel" | "approve" | "reject">("pay");
  const [processing, setProcessing] = useState(false);
  const [note, setNote] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [periods, setPeriods] = useState<{ key: string; label: string; shortLabel: string }[]>([]);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const loadSettings = useCallback(async () => {
    const snap = await getDoc(doc(db, "settings", "config"));
    let freq: PaymentFrequency = "monthly";
    let f = 50000;
    let dDay = 1;
    if (snap.exists()) {
      const d = snap.data();
      freq = (d.frequency as PaymentFrequency) || "monthly";
      f = d.monthlyFee || 50000;
      dDay = d.dueDay ?? 1;
    }
    setFrequency(freq);
    setBaseFee(f);
    setDueDay(dDay);
    const count = freq === "daily" ? 30 : freq === "weekly" ? 12 : 12;
    const p = getPeriods(freq, count);
    setPeriods(p);
    setSelectedPeriodIdx(0);
    return { freq, periods: p };
  }, []);

  const loadPayments = useCallback(async (periodKey: string) => {
    const resSnap = await getDocs(query(collection(db, "residents"), where("isActive", "==", true)));
    const res = resSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Resident));
    res.sort((a, b) => a.name.localeCompare(b.name));
    setResidents(res);

    const map: Record<string, PayInfo> = {};

    let snap;
    if (periodKey.match(/^\d{4}-\d{2}$/)) {
      const parts = periodKey.split("-");
      const month = parseInt(parts[1] ?? "0");
      const year = parseInt(parts[0] ?? "0");
      snap = await getDocs(query(collection(db, "payments"), where("month", "==", month), where("year", "==", year)));
    } else {
      snap = await getDocs(query(collection(db, "payments"), where("periodKey", "==", periodKey)));
    }

    snap.docs.forEach((d) => {
      const data = d.data();
      const resId = data.residentId as string;
      const amount = (data.amount as number) || 0;
      const status = (data.status as string) || "confirmed";

      if (!map[resId]) {
        map[resId] = { 
          id: d.id, 
          amount, 
          status,
          proofImage: data.proofImage as string | undefined,
          note: data.note as string | undefined
        };
      } else {
        map[resId].amount += amount;
        if (status === "pending" || map[resId].status === "pending") {
          map[resId].status = "pending";
        }
      }
    });
    setPaidMap(map);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { periods: p } = await loadSettings();
      if (p[0]) await loadPayments(p[0].key);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [loadSettings, loadPayments]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handlePeriodChange = async (idx: number) => {
    setSelectedPeriodIdx(idx);
    const period = periods[idx];
    if (period) {
      setLoading(true);
      try { await loadPayments(period.key); } catch (err) { console.error(err); } finally { setLoading(false); }
    }
  };

  const openModal = (r: Resident, action: "pay" | "cancel" | "approve" | "reject") => {
    setConfirmResident(r);
    setConfirmAction(action);
    setNote("");
    setSuccessMsg("");
  };

  const handleAction = async () => {
    if (!confirmResident) return;
    const period = periods[selectedPeriodIdx];
    if (!period) return;

    setProcessing(true);
    try {
      const payInfo = paidMap[confirmResident.id];

      const dynamicFeeInfo = getDynamicFee(baseFee, frequency, period.key, dueDay);

      switch (confirmAction) {
        case "pay":
          await addDoc(collection(db, "payments"), {
            residentId: confirmResident.id,
            residentName: confirmResident.name,
            periodKey: period.key,
            periodLabel: period.label,
            frequency,
            amount: dynamicFeeInfo.feePerPoint, // fee per billing point, not total monthly
            note: note.trim() || "Dicatat oleh admin",
            status: "confirmed",
            paidAt: serverTimestamp(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
          });
          setSuccessMsg(`Pembayaran ${confirmResident.name} berhasil dicatat`);
          break;

        case "approve":
          if (payInfo) {
            await updateDoc(doc(db, "payments", payInfo.id), { status: "confirmed" });
            setSuccessMsg(`Pembayaran ${confirmResident.name} disetujui`);
          }
          break;

        case "reject":
          if (payInfo) {
            await deleteDoc(doc(db, "payments", payInfo.id));
            setSuccessMsg(`Pembayaran ${confirmResident.name} ditolak`);
          }
          break;

        case "cancel":
          if (payInfo) {
            await deleteDoc(doc(db, "payments", payInfo.id));
            setSuccessMsg(`Pembayaran ${confirmResident.name} dibatalkan`);
          }
          break;
      }

      await loadPayments(period.key);
      setTimeout(() => { setConfirmResident(null); setSuccessMsg(""); }, 1500);
    } catch (err) { console.error(err); } finally { setProcessing(false); }
  };

  const confirmedCount = Object.values(paidMap).filter(p => p.status === "confirmed").length;
  const pendingCount = Object.values(paidMap).filter(p => p.status === "pending").length;
  const unpaidCount = residents.length - confirmedCount - pendingCount;
  const selectedPeriod = periods[selectedPeriodIdx];
  const dynamicFeeInfo = selectedPeriod ? getDynamicFee(baseFee, frequency, selectedPeriod.key, dueDay) : { fee: baseFee, count: 1, feePerPoint: baseFee };
  const totalIncome = Object.values(paidMap).filter(p => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);



  return (
    <div className="space-y-6 pt-12 lg:pt-0 fade-in">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Kelola Pembayaran</h1>
        <p className="text-slate-500 text-sm mt-1">
          Pencatatan kas untuk periode aktif — <span className="text-indigo-600 font-bold">{getFrequencyLabel(frequency)}</span>
          {dynamicFeeInfo.count > 1 ? (
            <> • <span className="text-slate-800 font-bold">{formatCurrency(dynamicFeeInfo.feePerPoint)}</span><span className="text-slate-400 text-xs ml-1">/tagihan ({dynamicFeeInfo.count}x tagihan = total {formatCurrency(dynamicFeeInfo.fee)}/bln)</span></>
          ) : (
            <> • <span className="text-slate-800 font-bold">{formatCurrency(dynamicFeeInfo.fee)}</span></>
          )}
        </p>
      </div>

      {/* Period switcher and stats row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button 
            disabled={selectedPeriodIdx >= periods.length - 1} 
            onClick={() => handlePeriodChange(selectedPeriodIdx + 1)}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all disabled:opacity-20 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {periods.slice(0, 8).map((p, i) => (
              <button 
                key={p.key} 
                onClick={() => handlePeriodChange(i)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex-shrink-0 border ${
                  i === selectedPeriodIdx 
                    ? "bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm" 
                    : "bg-white text-slate-500 border-slate-200/80 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>

          <button 
            disabled={selectedPeriodIdx <= 0} 
            onClick={() => handlePeriodChange(selectedPeriodIdx - 1)}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all disabled:opacity-20 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Lunas: {confirmedCount}
          </span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-550/10 text-amber-600 border border-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Verifikasi: {pendingCount}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Belum: {unpaidCount}
          </span>
        </div>
      </div>

      {/* Period Indicator */}
      {selectedPeriod && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/60 text-sm text-slate-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Periode: <span className="text-slate-900 font-extrabold">{selectedPeriod.label}</span>
            {selectedPeriod.key === getCurrentPeriodKey(frequency) && (
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600">
                Aktif
              </span>
            )}
          </div>
          {totalIncome > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/60 text-sm text-emerald-600 flex items-center gap-2 font-bold">
              <span>Dana Terkumpul: {formatCurrency(totalIncome)}</span>
            </div>
          )}
        </div>
      )}

      {/* Payment Grid */}
      {loading ? (
        <Skeleton type="grid" count={6} />
      ) : residents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </span>
          <p className="text-slate-400 text-sm font-bold mt-3">Belum ada data penghuni</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {residents.map((r) => {
          const payInfo = paidMap[r.id];
          const status = payInfo?.status || null;

          return (
            <div 
              key={r.id}
              onClick={() => {
                if (status === "pending") return;
                if (status === "confirmed") openModal(r, "cancel");
                else openModal(r, "pay");
              }}
              className={`p-5 rounded-3xl border transition-all duration-300 ${
                status === "confirmed" 
                  ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/60 cursor-pointer hover:scale-[1.01]"
                  : status === "pending" 
                    ? "bg-amber-50/30 border-amber-100"
                    : "bg-white border-slate-200/60 hover:bg-slate-50/80 cursor-pointer hover:scale-[1.01] shadow-sm shadow-slate-100"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${
                    status === "confirmed" 
                      ? "bg-emerald-100 text-emerald-600 border-emerald-200"
                      : status === "pending" 
                        ? "bg-amber-100 text-amber-600 border-amber-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{r.name}</p>
                    <p className="text-xs text-slate-400 font-semibold">Kamar {r.room}</p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {status === "confirmed" ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-600">Lunas</span>
                      <p className="text-xs text-emerald-600 font-bold">{formatCurrency(payInfo!.amount)}</p>
                    </div>
                  ) : status === "pending" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600">Verifikasi</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-100">Belum</span>
                  )}
                </div>
              </div>

              {/* Action buttons for verification */}
              {status === "pending" && (
                <div className="flex gap-2.5 mt-4 pt-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); openModal(r, "approve"); }}
                    className="w-full flex justify-center items-center gap-1 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-xs font-bold border border-emerald-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Setujui
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); openModal(r, "reject"); }}
                    className="w-full flex justify-center items-center gap-1 py-2 px-3 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors text-xs font-bold border border-rose-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> Tolak
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {residents.length === 0 && (
        <div className="text-center py-16">
          <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </span>
          <p className="text-slate-400 text-sm font-bold mt-3">Tidak ada penghuni yang sesuai pencarian</p>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      <Modal 
        isOpen={!!confirmResident} 
        onClose={() => { setConfirmResident(null); setSuccessMsg(""); }}
        title={successMsg ? "Selesai" : confirmAction === "pay" ? "Konfirmasi Kas" : confirmAction === "approve" ? "Setujui Kas" : confirmAction === "reject" ? "Tolak Kas" : "Batalkan Kas"}
        size="sm"
      >
        {confirmResident && (
          <div className="space-y-5">
            {successMsg ? (
              <div className="text-center py-6 fade-in space-y-4">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl shadow-sm ${confirmAction === "reject" || confirmAction === "cancel" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
                  {confirmAction === "reject" || confirmAction === "cancel" ? (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-700">{successMsg}</p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                      {confirmResident.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{confirmResident.name}</p>
                      <p className="text-xs text-slate-400 font-semibold">Kamar {confirmResident.room}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-200/60 pt-3 space-y-1.5 text-xs font-bold">
                    <div className="flex justify-between"><span className="text-slate-400">PERIODE</span><span className="text-slate-700">{selectedPeriod?.label}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">NOMINAL TAGIHAN</span><span className="text-indigo-600">{formatCurrency(dynamicFeeInfo.feePerPoint)}</span></div>
                    {dynamicFeeInfo.count > 1 && (
                      <div className="flex justify-between"><span className="text-slate-400">TARGET TOTAL/BULAN</span><span className="text-emerald-600">{formatCurrency(dynamicFeeInfo.fee)}</span></div>
                    )}
                  </div>
                </div>

                {confirmAction === "approve" && paidMap[confirmResident.id]?.proofImage && (
                  <div className="space-y-2 mt-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bukti Pembayaran</label>
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
                      <img src={paidMap[confirmResident.id]?.proofImage} alt="Bukti" className="max-h-60 object-contain rounded-lg" />
                    </div>
                  </div>
                )}
                
                {confirmAction === "approve" && paidMap[confirmResident.id]?.note && (
                  <div className="space-y-1 mt-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan Penghuni</label>
                    <p className="text-sm text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                      "{paidMap[confirmResident.id]?.note}"
                    </p>
                  </div>
                )}

                {confirmAction === "pay" && (
                  <div className="space-y-2 mt-4">
                    <label htmlFor="pay-note" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan Admin</label>
                    <input 
                      id="pay-note" 
                      type="text" 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)} 
                      className="input-premium text-sm text-slate-800" 
                      placeholder="Contoh: Bayar Tunai di Asrama" 
                    />
                  </div>
                )}

                {confirmAction === "approve" && (
                  <div className="mt-4 p-3.5 rounded-2xl text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600">
                    Sistem akan menyetujui transaksi kas penghuni ini dan menandainya sebagai LUNAS.
                  </div>
                )}

                {(confirmAction === "reject" || confirmAction === "cancel") && (
                  <div className="mt-4 p-3.5 rounded-2xl text-xs font-bold bg-rose-50 border border-rose-100 text-rose-600 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{confirmAction === "reject" ? "Pembayaran dari penghuni ini akan DITOLAK." : "Pembayaran kas penghuni ini akan DIHAPUS dari sistem."}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setConfirmResident(null)} className="btn-premium-secondary flex-1 text-sm py-3">Batal</button>
                  <button 
                    type="button" 
                    onClick={handleAction} 
                    disabled={processing}
                    className={`flex-1 text-sm py-3 rounded-2xl font-bold transition-all disabled:opacity-50 ${
                      confirmAction === "reject" || confirmAction === "cancel" ? "btn-premium-danger" : "btn-premium-success"
                    }`}
                  >
                    {processing ? "Memproses..." : confirmAction === "pay" ? "Catat Lunas" : confirmAction === "approve" ? "Setujui" : confirmAction === "reject" ? "Tolak" : "Hapus Catatan"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
