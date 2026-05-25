import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Skeleton } from "../components/Skeleton";

export function ResidentCalendarPage() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>({});
  const [paidDates, setPaidDates] = useState<Set<string>>(new Set());
  const [dueDayOfWeek, setDueDayOfWeek] = useState<number>(0);
  const [baseFee, setBaseFee] = useState<number>(0);
  const [systemStartDate, setSystemStartDate] = useState<string>("");

  const loadData = useCallback(async () => {
    if (!profile?.residentId) return;
    try {
      // Get settings for due day
      const settingsSnap = await getDoc(doc(db, "settings", "config"));
      if (settingsSnap.exists()) {
        const d = settingsSnap.data();
        setBaseFee(d.monthlyFee || 0);
        setSystemStartDate(d.systemStartDate || "");
        if (d.frequency === "weekly") {
          setDueDayOfWeek(d.dueDay ?? 0); // e.g., 0 for Sunday
        } else {
          setDueDayOfWeek(-1); // Not applicable
        }
      }

      // Get payments
      const payQuery = query(collection(db, "payments"), where("residentId", "==", profile.residentId));
      const paySnap = await getDocs(payQuery);

      const paidA: Record<string, number> = {};
      const paidD = new Set<string>();
      paySnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status === "confirmed") {
          let pKey = data.periodKey;

          // Backward compatibility for old weekly periods
          if (data.month && data.year) {
            pKey = `${data.year}-${String(data.month).padStart(2, "0")}`;
          }

          paidA[pKey] = (paidA[pKey] || 0) + Number(data.amount || 0);

          if (data.paidAt && data.paidAt.seconds) {
            const dObj = new Date(data.paidAt.seconds * 1000);
            const y = dObj.getFullYear();
            const m = String(dObj.getMonth() + 1).padStart(2, "0");
            const date = String(dObj.getDate()).padStart(2, "0");
            paidD.add(`${y}-${m}-${date}`);
          }
        }
      });
      setPaidAmounts(paidA);
      setPaidDates(paidD);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profile?.residentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleDateString("id-ID", { month: "long" });
  const year = currentDate.getFullYear();
  const periodKey = `${year}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  let targetDayCount = 0;
  if (dueDayOfWeek >= 0) {
    for (let i = 1; i <= daysInMonth; i++) {
      const thisDayDate = new Date(year, currentDate.getMonth(), i);
      thisDayDate.setHours(0, 0, 0, 0);
      let isValidTarget = dueDayOfWeek === thisDayDate.getDay();
      if (isValidTarget && systemStartDate) {
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        if (thisDayDate < parsedStart) {
          isValidTarget = false;
        }
      }
      if (isValidTarget) {
        targetDayCount++;
      }
    }
  } else {
    let isValidTarget = true;
    if (systemStartDate) {
      const thisDayDate = new Date(year, currentDate.getMonth(), 1);
      thisDayDate.setHours(0, 0, 0, 0);
      const parsedStart = new Date(systemStartDate);
      parsedStart.setHours(0, 0, 0, 0);
      if (thisDayDate < parsedStart) {
        isValidTarget = false;
      }
    }
    targetDayCount = isValidTarget ? 1 : 0;
  }

  const totalFeeForMonth = baseFee; // baseFee IS the total monthly target
  const feePerPoint = targetDayCount > 0 ? Math.round(baseFee / targetDayCount) : baseFee;
  const paidThisMonthAmount = paidAmounts[periodKey] || 0;

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const days = [];
  const targetDaysInfo: { date: number, dateStr: string, isPaid: boolean, amountDue: number, weekIndex: number }[] = [];

  // Empty slots before 1st day
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square p-2 rounded-2xl border border-transparent bg-slate-50/50"></div>);
  }

  // Days
  let currentTargetDayIndex = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const dayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).getDay();
    let isTargetDay = dueDayOfWeek === dayOfWeek || (dueDayOfWeek === -1 && i === 1); // If monthly, assume 1st day is target
    if (isTargetDay && systemStartDate) {
      const thisDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      thisDayDate.setHours(0, 0, 0, 0);
      const parsedStart = new Date(systemStartDate);
      parsedStart.setHours(0, 0, 0, 0);
      if (thisDayDate < parsedStart) {
        isTargetDay = false;
      }
    }
    let isThisTargetDayPaid = false;
    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toDateString();
    const isSundayOrSaturday = dayOfWeek === 0 || dayOfWeek === 6;

    if (isTargetDay) {
      currentTargetDayIndex++;
      const weekIdx = currentTargetDayIndex;
      // Cumulative logic: week N is paid if totalPaid >= N × feePerPoint
      isThisTargetDayPaid = paidThisMonthAmount >= weekIdx * feePerPoint;

      const cumulativeDueUpToHere = weekIdx * feePerPoint;
      const thisDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const isPastOrToday = thisDayDate <= new Date();

      const amountDueForThisWeek = isThisTargetDayPaid
        ? feePerPoint // already paid — show normal amount per week
        : isPastOrToday
          ? Math.max(0, cumulativeDueUpToHere - paidThisMonthAmount) // accumulated outstanding for all past/current weeks
          : feePerPoint; // future week — just normal fee, not yet due
      const dateStr = thisDayDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
      targetDaysInfo.push({ date: i, dateStr, isPaid: isThisTargetDayPaid, amountDue: amountDueForThisWeek, weekIndex: weekIdx });
    }

    let cellClass = "bg-white border-slate-100";
    if (isTargetDay) {
      cellClass = isThisTargetDayPaid ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200";
    } else if (isToday) {
      cellClass = "bg-amber-50 border-transparent";
    }

    let dateColorClass = isSundayOrSaturday ? 'text-rose-500' : 'text-slate-800';
    if (isToday) {
      dateColorClass = 'text-amber-600 font-extrabold';
    }

    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const isPaymentDate = paidDates.has(dateKey);

    days.push(
      <div
        key={`day-${i}`}
        className={`relative p-1.5 sm:p-2 aspect-square rounded-xl sm:rounded-2xl border ${cellClass} ${isToday ? 'ring-2 ring-amber-400' : ''} flex flex-col items-center justify-center text-center transition-colors`}
      >
        <span className={`text-sm sm:text-base ${dateColorClass}`}>
          {i}
        </span>

        {isTargetDay && (
          <div className="mt-0.5">
            <span className={`text-[9px] sm:text-[10px] leading-tight font-bold ${isThisTargetDayPaid ? 'text-emerald-600' : 'text-rose-500'}`}>
              {isThisTargetDayPaid ? "Lunas" : "Tagihan"}
            </span>
          </div>
        )}

        {isPaymentDate && (
          <div className="absolute -bottom-1 -right-1 sm:bottom-0 sm:right-0">
            <div className="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-sm" title="Telah Bayar">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Empty slots after the last day
  const totalSlots = firstDayOfMonth + daysInMonth;
  const trailingDays = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
  for (let i = 0; i < trailingDays; i++) {
    days.push(<div key={`trailing-${i}`} className="aspect-square p-2 rounded-2xl border border-transparent bg-slate-50/50"></div>);
  }

  if (loading) return <Skeleton type="residentCalendar" />;

  return (
    <div className="space-y-6 pt-12 lg:pt-0 w-full fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-amber-50 text-amber-500 rounded-xl">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Kalender Kas
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Pantau jadwal tagihan Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Calendar View */}
        <div className="lg:col-span-2 premium-card p-4 sm:p-5 bg-white border border-slate-100 shadow-sm rounded-3xl">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{monthName} {year}</h2>
            <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Days Header */}
          <div className="mb-2" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {dayNames.map((day, idx) => (
              <div key={day} className={`text-center text-sm font-bold ${idx === 0 || idx === 6 ? 'text-rose-500' : 'text-slate-600'}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="gap-2 sm:gap-3" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {days}
          </div>

          {/* Legend */}
          <div className="mt-8 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-rose-200 bg-rose-50"></div>
              <span className="text-xs font-semibold text-slate-500">Tagihan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-emerald-200 bg-emerald-50"></div>
              <span className="text-xs font-semibold text-slate-500">Lunas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-slate-100 bg-slate-50"></div>
              <span className="text-xs font-semibold text-slate-500">Kosong</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50"></div>
              <span className="text-xs font-semibold text-slate-500">Hari Ini</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-indigo-200 bg-indigo-50"></div>
              <span className="text-xs font-semibold text-slate-500">Hari Pembayaran</span>
            </div>
          </div>
        </div>

        {/* Right: List of Target Days */}
        <div className="lg:col-span-1 premium-card p-4 sm:p-5 bg-white border border-slate-100 shadow-sm rounded-3xl h-fit">
          <div className="flex items-center gap-3 mb-5">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-bold text-slate-800">Daftar Tagihan — {monthName}</h3>
          </div>

          <div className="space-y-3 mb-6">
            {targetDaysInfo.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400 font-medium">Tidak ada target tagihan di bulan ini.</div>
            ) : (
              targetDaysInfo.map((info, idx) => {
                const isAccumulated = !info.isPaid && info.amountDue > feePerPoint;
                return (
                  <div key={idx} className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                    info.isPaid ? 'bg-emerald-50 border-emerald-100' : isAccumulated ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0 ${
                      info.isPaid ? 'bg-emerald-100 text-emerald-600' : isAccumulated ? 'bg-orange-100 text-orange-600' : 'bg-rose-100 text-rose-500'
                    }`}>
                      {info.date}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-800">
                          Minggu ke-{info.weekIndex}
                          {isAccumulated && <span className="ml-1.5 text-[10px] font-extrabold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Akumulasi</span>}
                        </h4>
                        <span className={`text-xs font-extrabold ${
                          info.isPaid ? 'text-emerald-600' : isAccumulated ? 'text-orange-600' : 'text-rose-500'
                        }`}>
                          {info.isPaid ? '✓ Lunas' : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(info.amountDue)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{info.dateStr}</p>
                      {isAccumulated && (
                        <p className="text-[10px] text-orange-500 font-semibold mt-0.5">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(feePerPoint)} normal + {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(info.amountDue - feePerPoint)} tunggakan
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl text-xs font-semibold text-amber-700 flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex flex-col gap-1">
              <span>Total {targetDaysInfo.length} titik penagihan di bulan {monthName} {year}</span>
              <span className="font-extrabold text-amber-800">
                Per Tagihan: {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(feePerPoint)}
              </span>
              <span className="text-amber-700">
                Total Wajib/Bulan: {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(totalFeeForMonth)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
