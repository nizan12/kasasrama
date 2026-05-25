// Shared types and utilities for payment scheduling

export type PaymentFrequency = "daily" | "weekly" | "monthly";

export interface ScheduleConfig {
  frequency: PaymentFrequency;
  monthlyFee: number;
  // For monthly: due date (1-31), e.g., "every 10th"
  // For weekly: due day (0=Minggu, 1=Senin, ..., 6=Sabtu)
  // For daily: ignored
  dueDay: number;
}

export interface PeriodInfo {
  key: string;       // unique key: "2026-05" | "2026-W21" | "2026-05-23"
  label: string;     // display label: "Mei 2026" | "Minggu 21" | "23 Mei 2026"
  shortLabel: string; // short: "Mei" | "W21" | "23 Mei"
}

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const monthShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function getFrequencyLabel(freq: PaymentFrequency): string {
  switch (freq) {
    case "daily": return "Harian (Tagihan Bulanan)";
    case "weekly": return "Mingguan (Tagihan Bulanan)";
    case "monthly": return "Bulanan";
  }
}

export function getDueDayLabel(freq: PaymentFrequency, dueDay: number): string {
  switch (freq) {
    case "monthly": return `Tanggal ${dueDay} setiap bulan`;
    case "weekly": return `Jumlah yang ditetapkan dibagi rata ke setiap hari ${dayNames[dueDay] || "Senin"} dalam bulan tersebut`;
    case "daily": return "Jumlah yang ditetapkan dibagi rata ke setiap hari dalam bulan tersebut";
  }
}

// Get current period key (Always YYYY-MM for all frequencies now)
export function getCurrentPeriodKey(_freq?: PaymentFrequency): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  return `${now.getFullYear()}-${String(m).padStart(2, "0")}`;
}

// Generate list of periods for display
export function getPeriods(_freq: PaymentFrequency, _count: number): PeriodInfo[] {
  const periods: PeriodInfo[] = [];
  const now = new Date();
  
  // Now all frequencies use monthly periods
  // Default count 12 for all
  const actualCount = 12;

  for (let i = 0; i < actualCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    periods.push({
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: `${monthNames[m - 1]} ${y}`,
      shortLabel: `${monthShort[m - 1]}`,
    });
  }
  return periods;
}

// Get periods for a year (for resident view)
export function getYearPeriods(_freq: PaymentFrequency, year: number): PeriodInfo[] {
  const periods: PeriodInfo[] = [];
  for (let m = 1; m <= 12; m++) {
    periods.push({
      key: `${year}-${String(m).padStart(2, "0")}`,
      label: `${monthNames[m - 1]} ${year}`,
      shortLabel: monthNames[m - 1]!,
    });
  }
  return periods;
}

// Count specific days in a month (e.g. how many Sundays in May 2026)
export function countTargetDaysInMonth(year: number, month: number, targetDayOfWeek: number): number {
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() === targetDayOfWeek) {
      count++;
    }
    date.setDate(date.getDate() + 1);
  }
  return count;
}

// Calculate dynamic fee based on frequency and period.
// baseFee = total monthly target set by admin.
// For weekly/daily: fee per billing point = baseFee / count (divided equally).
export function getDynamicFee(
  baseFee: number, 
  freq: PaymentFrequency, 
  periodKey: string, 
  dueDay: number,
  systemStartDate?: string
): { fee: number; count: number; feePerPoint: number } {
  if (freq === "monthly") {
    let isValid = true;
    if (systemStartDate) {
      const [yearStr, monthStr] = periodKey.split("-");
      const year = parseInt(yearStr || "0");
      const month = parseInt(monthStr || "0");
      if (!isNaN(year) && !isNaN(month)) {
        const firstDay = new Date(year, month - 1, 1);
        firstDay.setHours(0, 0, 0, 0);
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        if (firstDay < parsedStart) {
          const dueDayDate = new Date(year, month - 1, Math.min(dueDay, new Date(year, month, 0).getDate()));
          dueDayDate.setHours(0, 0, 0, 0);
          if (dueDayDate < parsedStart) {
            isValid = false;
          }
        }
      }
    }
    return { fee: isValid ? baseFee : 0, count: isValid ? 1 : 0, feePerPoint: isValid ? baseFee : 0 };
  }
  
  const [yearStr, monthStr] = periodKey.split("-");
  const year = parseInt(yearStr || "0");
  const month = parseInt(monthStr || "0");
  
  if (isNaN(year) || isNaN(month)) return { fee: baseFee, count: 1, feePerPoint: baseFee };

  if (freq === "weekly") {
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === dueDay) {
        let isValid = true;
        if (systemStartDate) {
          const checkDate = new Date(date);
          checkDate.setHours(0, 0, 0, 0);
          const parsedStart = new Date(systemStartDate);
          parsedStart.setHours(0, 0, 0, 0);
          if (checkDate < parsedStart) {
            isValid = false;
          }
        }
        if (isValid) {
          count++;
        }
      }
      date.setDate(date.getDate() + 1);
    }
    const feePerPoint = count > 0 ? Math.round(baseFee / count) : 0;
    const fee = count > 0 ? baseFee : 0;
    return { fee, count, feePerPoint };
  }
  
  if (freq === "daily") {
    let count = 0;
    const totalDays = new Date(year, month, 0).getDate();
    for (let d = 1; d <= totalDays; d++) {
      let isValid = true;
      if (systemStartDate) {
        const checkDate = new Date(year, month - 1, d);
        checkDate.setHours(0, 0, 0, 0);
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        if (checkDate < parsedStart) {
          isValid = false;
        }
      }
      if (isValid) {
        count++;
      }
    }
    const feePerPoint = count > 0 ? Math.round(baseFee / count) : 0;
    const fee = count > 0 ? baseFee : 0;
    return { fee, count, feePerPoint };
  }
  
  return { fee: baseFee, count: 1, feePerPoint: baseFee };
}
