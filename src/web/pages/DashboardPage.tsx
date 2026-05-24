import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { StatCard } from "../components/StatCard";
import type { PaymentFrequency } from "../utils/schedule";
import { getCurrentPeriodKey, getPeriods, getFrequencyLabel } from "../utils/schedule";

export function DashboardPage() {
  const [totalResidents, setTotalResidents] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [currentIncome, setCurrentIncome] = useState(0);
  const [unpaidResidents, setUnpaidResidents] = useState<{ name: string; room: string }[]>([]);
  const [chartData, setChartData] = useState<{ label: string; total: number; isCurrent: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [asramaName, setAsramaName] = useState("Asrama");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const queryPaymentsByPeriod = async (periodKey: string) => {
    let snap;
    if (periodKey.match(/^\d{4}-\d{2}$/)) {
      const parts = periodKey.split("-");
      const month = parseInt(parts[1] ?? "0");
      const year = parseInt(parts[0] ?? "0");
      snap = await getDocs(
        query(collection(db, "payments"), where("month", "==", month), where("year", "==", year))
      );
    } else {
      snap = await getDocs(query(collection(db, "payments"), where("periodKey", "==", periodKey)));
    }
    return [...snap.docs];
  };

  const loadData = useCallback(async () => {
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "config"));
      let freq: PaymentFrequency = "monthly";
      if (settingsSnap.exists()) {
        const d = settingsSnap.data();
        freq = (d.frequency as PaymentFrequency) || "monthly";
        setAsramaName(d.asramaName || "Asrama");
      }
      setFrequency(freq);

      const currentKey = getCurrentPeriodKey(freq);

      const residentsSnap = await getDocs(query(collection(db, "residents"), where("isActive", "==", true)));
      const residents = residentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as { id: string; name: string; room: string }[];
      setTotalResidents(residents.length);

      const payDocs = await queryPaymentsByPeriod(currentKey);
      const paidIds = new Set(payDocs.map((d) => d.data().residentId as string));
      const income = payDocs.reduce((s, d) => s + ((d.data().amount as number) || 0), 0);

      setPaidCount(paidIds.size);
      setUnpaidCount(residents.length - paidIds.size);
      setCurrentIncome(income);
      setUnpaidResidents(residents.filter((r) => !paidIds.has(r.id)).slice(0, 10));

      const chartCount = freq === "daily" ? 7 : 6;
      const periods = getPeriods(freq, chartCount);
      const chart: { label: string; total: number; isCurrent: boolean }[] = [];

      for (const p of periods) {
        const docs = await queryPaymentsByPeriod(p.key);
        chart.push({
          label: p.shortLabel,
          total: docs.reduce((s, d) => s + ((d.data().amount as number) || 0), 0),
          isCurrent: p.key === currentKey,
        });
      }
      setChartData(chart.reverse());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const maxChart = Math.max(...chartData.map((d) => d.total), 1);
  const freqLabel = getFrequencyLabel(frequency);

  return (
    <div className="space-y-8 pt-12 lg:pt-0 fade-in">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 text-sm mt-1">{asramaName} — Rekapitulasi Kas {freqLabel}</p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm animate-pulse h-32 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <div className="w-10 h-10 bg-slate-200/60 rounded-xl" />
                  <div className="w-24 h-4 bg-slate-200/60 rounded-md" />
                </div>
                <div className="w-32 h-8 bg-slate-200/60 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="premium-card p-6 lg:p-8 bg-white border border-slate-100 h-96 animate-pulse space-y-6">
            <div className="flex justify-between items-center">
              <div className="w-48 h-6 bg-slate-200/60 rounded-lg" />
              <div className="w-24 h-8 bg-slate-200/60 rounded-lg" />
            </div>
            <div className="w-full h-64 bg-slate-200/60 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} 
          label="Total Penghuni" 
          value={totalResidents} 
          sublabel="Status aktif" 
          color="indigo" 
          delay={0} 
        />
        <StatCard 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
          label="Sudah Bayar" 
          value={paidCount} 
          sublabel={`Periode ${getCurrentPeriodKey(frequency)}`} 
          color="emerald" 
          delay={100} 
        />
        <StatCard 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
          label="Belum Bayar" 
          value={unpaidCount} 
          sublabel="Tunggakan periode ini" 
          color="rose" 
          delay={200} 
        />
        <StatCard 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
          label="Pemasukan" 
          value={formatCurrency(currentIncome)} 
          sublabel="Kas terkumpul" 
          color="cyan" 
          delay={300} 
        />
      </div>

      {/* Main Charts & Unpaid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income Chart */}
        <div className="lg:col-span-2 premium-card p-6 bg-white border border-slate-100 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Tren Pemasukan Kas</h2>
            <p className="text-slate-400 text-xs mt-0.5">{chartData.length} periode pembayaran terakhir</p>
          </div>
          
          <div className="flex items-end gap-3 sm:gap-5 h-48 mt-6">
            {chartData.map((d, i) => {
              const height = maxChart > 0 ? (d.total / maxChart) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold">
                    {d.total > 0 ? formatCurrency(d.total).replace("Rp", "").trim() : "0"}
                  </span>
                  <div className="w-full relative rounded-t-xl bg-slate-50 overflow-hidden" style={{ height: "120px" }}>
                    <div 
                      className={`absolute bottom-0 w-full rounded-t-xl transition-all duration-1000 ease-out ${
                        d.isCurrent 
                          ? "bg-gradient-to-t from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.2)]" 
                          : "bg-slate-300"
                      }`} 
                      style={{ height: `${Math.max(height, 4)}%` }} 
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${d.isCurrent ? "text-indigo-600" : "text-slate-400"}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unpaid List */}
        <div className="premium-card p-6 bg-white border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Belum Bayar</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
              {unpaidCount} Orang
            </span>
          </div>

          {unpaidResidents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </span>
              <p className="text-slate-800 font-bold mt-3">Lunas Semua!</p>
              <p className="text-slate-400 text-xs mt-1">Semua penghuni asrama lunas periode ini.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1">
              {unpaidResidents.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-xs font-bold text-rose-500">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{r.name}</p>
                    <p className="text-xs text-slate-400 font-semibold">Kamar {r.room}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-100">
                    Belum
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
        </>
      )}
    </div>
  );
}
