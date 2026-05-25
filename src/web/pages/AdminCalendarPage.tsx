import { useState, useEffect, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Skeleton } from "../components/Skeleton";

export function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [dueDayOfWeek, setDueDayOfWeek] = useState<number>(0);
  const [baseFee, setBaseFee] = useState<number>(0);
  const [systemStartDate, setSystemStartDate] = useState<string>("");

  const loadData = useCallback(async () => {
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
      // Add a small delay for smooth skeleton transition
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleDateString("id-ID", { month: "long" });
  const year = currentDate.getFullYear();

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

  const totalFeeForMonth = baseFee;

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const days = [];
  const targetDaysInfo: { date: number, dateStr: string, isPaid: boolean }[] = [];

  // Empty slots before 1st day
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square p-2 rounded-2xl border border-transparent bg-slate-50/50"></div>);
  }

  // Days
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
    if (isTargetDay) {
      targetDaysInfo.push({
        date: i,
        dateStr: new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }),
        isPaid: false
      });
    }
    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toDateString();
    const isSundayOrSaturday = dayOfWeek === 0 || dayOfWeek === 6;

    let cellClass = "bg-white border-slate-100";
    if (isTargetDay) {
      cellClass = "bg-amber-50 border-amber-200";
    } else if (isToday) {
      cellClass = "bg-amber-50 border-transparent";
    }

    let dateColorClass = isSundayOrSaturday ? 'text-rose-500' : 'text-slate-800';
    if (isToday) {
      dateColorClass = 'text-indigo-600 font-extrabold';
    }

    days.push(
      <div
        key={`day-${i}`}
        className={`relative p-1.5 sm:p-2 aspect-square rounded-xl sm:rounded-2xl border ${cellClass} ${isToday ? 'ring-2 ring-indigo-400' : ''} flex flex-col items-center justify-center text-center transition-colors`}
      >
        <span className={`text-sm sm:text-base ${dateColorClass}`}>
          {i}
        </span>

        {isTargetDay && (
          <div className="mt-0.5">
            <span className="text-[9px] sm:text-[10px] leading-tight font-bold text-amber-600">
              Jadwal Tagihan
            </span>
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
              <div className="w-4 h-4 rounded border border-amber-200 bg-amber-50"></div>
              <span className="text-xs font-semibold text-slate-500">Jadwal Tagihan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-slate-100 bg-slate-50"></div>
              <span className="text-xs font-semibold text-slate-500">Kosong</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-indigo-400 bg-indigo-50"></div>
              <span className="text-xs font-semibold text-slate-500">Hari Ini</span>
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
              targetDaysInfo.map((info, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl border border-slate-100 flex items-center gap-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm bg-amber-100 text-amber-600">
                    {info.date}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Tagihan {dueDayOfWeek === 0 ? "Mingguan" : "Berkala"}</h4>
                    <p className="text-xs text-slate-500 font-medium">{info.dateStr}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl text-xs font-semibold text-amber-700 flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex flex-col gap-1">
              <span>Total {targetDaysInfo.length} titik penagihan di bulan {monthName} {year}</span>
              <span className="font-extrabold text-amber-800">
                Total Biaya: {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(totalFeeForMonth)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
