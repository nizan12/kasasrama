import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import QRCode from "qrcode";
import type { PaymentFrequency } from "../utils/schedule";
import { getCurrentPeriodKey, getFrequencyLabel, getDynamicFee, getPeriods } from "../utils/schedule";
import { convertQRIS } from "../../core";
import { Modal } from "../components/Modal";
import { CustomSelect } from "../components/CustomSelect";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface Payment {
  id: string;
  amount: number;
  periodKey: string;
  periodLabel: string;
  status: string;
  paidAt: { seconds: number } | null;
  note: string;
  month?: number;
  year?: number;
}

export function ResidentHomePage() {
  const toast = useToast();
  const { profile } = useAuth();
  const [residentName, setResidentName] = useState("");
  const [room, setRoom] = useState("");
  const [avatar, setAvatar] = useState("");

  const [baseFee, setBaseFee] = useState(0);
  const [dynamicFee, setDynamicFee] = useState(0);
  const [feeCount, setFeeCount] = useState(1);
  const [totalFeeThisMonth, setTotalFeeThisMonth] = useState(0);
  const [totalPaidThisMonth, setTotalPaidThisMonth] = useState(0);

  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [dueDay, setDueDay] = useState(1);
  const [systemStartDate, setSystemStartDate] = useState("");
  const [qrisString, setQrisString] = useState(""); // Static QRIS template from settings
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "pending" | "confirmed">("unpaid");
  const [history, setHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [success, setSuccess] = useState(false);
  const [payFull, setPayFull] = useState(false);

  // Financial Transparency State
  const [globalIncome, setGlobalIncome] = useState(0);
  const [globalExpense, setGlobalExpense] = useState(0);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  // Edit Profile State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [rooms, setRooms] = useState<{ value: string; label: string }[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image using canvas
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to base64 jpeg
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setProofImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const loadData = useCallback(async () => {
    if (!profile?.residentId) { setLoading(false); return; }

    try {
      // 1. Get resident info
      const resSnap = await getDoc(doc(db, "residents", profile.residentId));
      if (resSnap.exists()) {
        const d = resSnap.data();
        setResidentName(d.name || "");
        setRoom(d.room || "");
        setAvatar(d.avatar || "");
      }

      // 2. Get global settings
      const settingsSnap = await getDoc(doc(db, "settings", "config"));
      let feeVal = 0;
      let freqVal: PaymentFrequency = "monthly";
      let dueDay = 1;
      let qrisStr = "";
      let systemStartDate = "";

      if (settingsSnap.exists()) {
        const d = settingsSnap.data();
        feeVal = d.monthlyFee || 0;
        freqVal = (d.frequency as PaymentFrequency) || "monthly";
        dueDay = d.dueDay ?? 1;
        qrisStr = d.qrisString || "";
        systemStartDate = d.systemStartDate || "";
        setFrequency(freqVal);
        setBaseFee(feeVal);
        setQrisString(qrisStr);
        setDueDay(dueDay);
        setSystemStartDate(systemStartDate);
      }

      const currentPeriodKey = getCurrentPeriodKey(freqVal);
      const feeInfo = getDynamicFee(feeVal, freqVal, currentPeriodKey, dueDay, systemStartDate);
      setDynamicFee(feeInfo.fee);
      setFeeCount(feeInfo.count);

      // 3. Get payments history
      const payQuery = query(collection(db, "payments"), where("residentId", "==", profile.residentId));
      const paySnap = await getDocs(payQuery);
      const payList = paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
      payList.sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));
      setHistory(payList);

      // 4. Determine current period payment status
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const currentMonthPayments = payList.filter((p) =>
        p.periodKey === currentPeriodKey ||
        (p.month === currentMonth && p.year === currentYear)
      );

      const totalConfirmedPaid = currentMonthPayments.filter(p => p.status === "confirmed").reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Calculate accumulated outstanding:
      // Count how many billing points have passed UP TO AND INCLUDING TODAY
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const feePerPoint = feeInfo.count > 0 ? Math.round(feeInfo.fee / feeInfo.count) : feeInfo.fee;
      let passedBillingPoints = 0;

      // Determine the start date boundary for the current month
      let startDate = new Date(currentYear, currentMonth - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      if (systemStartDate) {
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        if (parsedStart > startDate) {
          startDate = parsedStart;
        }
      }

      if (freqVal === "weekly") {
        // Count billing days that have occurred in this month on/after startDate and up to today
        const iter = new Date(startDate);
        while (iter.getMonth() + 1 === currentMonth && iter <= today) {
          if (iter.getDay() === dueDay) passedBillingPoints++;
          iter.setDate(iter.getDate() + 1);
        }
      } else if (freqVal === "daily") {
        if (startDate <= today && startDate.getMonth() + 1 === currentMonth) {
          const diffTime = today.getTime() - startDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
          passedBillingPoints = Math.max(0, diffDays);
        } else {
          passedBillingPoints = 0;
        }
      } else {
        if (startDate <= today && startDate.getMonth() + 1 === currentMonth) {
          passedBillingPoints = 1;
        } else {
          passedBillingPoints = 0;
        }
      }

      // Accumulated outstanding = total due for passed weeks - total already paid
      const accumulatedDue = Math.max(0, passedBillingPoints * feePerPoint - totalConfirmedPaid);
      const remainingFee = accumulatedDue;

      setTotalFeeThisMonth(feeInfo.fee);
      setTotalPaidThisMonth(totalConfirmedPaid);
      setDynamicFee(remainingFee); // Total outstanding for all passed billing points

      if (remainingFee <= 0) {
        setPaymentStatus("confirmed");
      } else {
        const hasPending = currentMonthPayments.some(p => p.status === "pending");
        if (hasPending) {
          setPaymentStatus("pending");
        } else {
          setPaymentStatus("unpaid");

          // 5. QRIS generation is now handled reactively by useEffect based on selected options
        }
      }

      // 6. Fetch Global Income (All confirmed payments)
      const allPaySnap = await getDocs(query(collection(db, "payments"), where("status", "==", "confirmed")));
      const totalInc = allPaySnap.docs.reduce((sum, doc) => sum + ((doc.data().amount as number) || 0), 0);
      setGlobalIncome(totalInc);

      // 7. Fetch Global Expenses
      const expSnap = await getDocs(query(collection(db, "expenses")));
      const expData = expSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort expenses by date descending
      expData.sort((a: any, b: any) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      const totalExp = expData.reduce((sum, doc: any) => sum + (doc.amount || 0), 0);
      setGlobalExpense(totalExp);
      setExpensesList(expData);

    } catch (err) {
      console.error("Gagal memuat portal:", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const feePerPoint = feeCount > 0 ? Math.round(totalFeeThisMonth / feeCount) : totalFeeThisMonth;
  const fullMonthRemainingAmount = Math.max(0, totalFeeThisMonth - totalPaidThisMonth);
  // Option 1: Bayar Rutin (accumulated outstanding up to today)
  const regularCycleAmount = dynamicFee;
  // Option 2: Bayar Penuh (full month remaining)
  const fullMonthAmount = fullMonthRemainingAmount;

  const selectedAmount = payFull ? fullMonthAmount : regularCycleAmount;

  // Generate dynamic QRIS when selectedAmount or qrisString changes
  useEffect(() => {
    if (!qrisString || selectedAmount <= 0) {
      setQrCodeDataUrl("");
      return;
    }

    let isMounted = true;
    const generateQR = async () => {
      try {
        const dynamicStr = convertQRIS(qrisString, { amount: selectedAmount });
        const url = await QRCode.toDataURL(dynamicStr, {
          margin: 1,
          width: 300,
          color: { dark: "#1e293b", light: "#ffffff" },
        });
        if (isMounted) {
          setQrCodeDataUrl(url);
        }
      } catch (err) {
        console.error("Failed generating QR", err);
      }
    };

    generateQR();
    return () => {
      isMounted = false;
    };
  }, [qrisString, selectedAmount]);

  const handlePayConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.residentId || submitting) return;

    if (!proofImage) {
      toast.error("Harap unggah bukti pembayaran.");
      return;
    }

    setSubmitting(true);
    try {
      const currentPeriodKey = getCurrentPeriodKey(frequency);
      const currentPeriodLabel = getPeriods(frequency, 1)[0]?.label || "";

      await addDoc(collection(db, "payments"), {
        residentId: profile.residentId,
        residentName: residentName,
        periodKey: currentPeriodKey,
        periodLabel: currentPeriodLabel,
        frequency,
        amount: selectedAmount,
        note: note.trim() || "Konfirmasi oleh penghuni",
        proofImage: proofImage,
        status: "pending", // Waiting admin verification
        paidAt: serverTimestamp(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      });

      setSuccess(true);
      toast.success("Konfirmasi pembayaran dikirim ke admin");
      setPaymentStatus("pending");
      setNote("");
      setProofImage("");
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 200; // Small size for avatar
        let width = img.width;
        let height = img.height;

        // Make it a square if we want, or just resize max
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setEditAvatar(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const openProfileModal = async () => {
    setEditName(residentName);
    setEditRoom(room);
    setEditAvatar(avatar);
    setShowProfileModal(true);

    // Load rooms if not loaded
    if (rooms.length === 0) {
      try {
        const snap = await getDocs(query(collection(db, "rooms")));
        const roomOptions = snap.docs.map((d) => ({
          value: d.data().name,
          label: `Kamar ${d.data().name}`,
        }));
        roomOptions.sort((a, b) => a.value.localeCompare(b.value));
        setRooms(roomOptions);
      } catch (err) {
        console.error("Gagal memuat kamar:", err);
      }
    }
  };

  // Listen for event dispatched by Sidebar
  useEffect(() => {
    const handler = () => openProfileModal();
    window.addEventListener("openProfileModal", handler);
    return () => window.removeEventListener("openProfileModal", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentName, room, avatar, rooms.length]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.residentId || !editName.trim() || !editRoom) return;

    setSavingProfile(true);
    try {
      await updateDoc(doc(db, "residents", profile.residentId), {
        name: editName.trim(),
        room: editRoom,
        avatar: editAvatar,
      });
      setResidentName(editName.trim());
      setRoom(editRoom);
      setAvatar(editAvatar);
      setShowProfileModal(false);
      // Notify Sidebar to update avatar/name immediately
      window.dispatchEvent(new CustomEvent("profileUpdated", {
        detail: { name: editName.trim(), avatar: editAvatar },
      }));
      toast.success("Profil berhasil diperbarui.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) return <Skeleton type="residentHome" />;

  const activePeriodLabel = getPeriods(frequency, 1)[0]?.label || "";

  // Compute next billing due date
  const getNextDueDate = (): string => {
    const now = new Date();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    if (frequency === "monthly") {
      let targetMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      if (systemStartDate) {
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        const currentMonthDue = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
        currentMonthDue.setHours(0, 0, 0, 0);
        if (currentMonthDue >= parsedStart && now < currentMonthDue) {
          targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
          let iterMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          while (true) {
            const due = new Date(iterMonth.getFullYear(), iterMonth.getMonth(), Math.min(dueDay, new Date(iterMonth.getFullYear(), iterMonth.getMonth() + 1, 0).getDate()));
            due.setHours(0, 0, 0, 0);
            if (due >= parsedStart) {
              targetMonth = iterMonth;
              break;
            }
            iterMonth.setMonth(iterMonth.getMonth() + 1);
          }
        }
      }
      const maxDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
      const day = Math.min(dueDay, maxDay);
      return `${day} ${monthNames[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`;
    }

    if (frequency === "weekly") {
      let d = new Date(now);
      d.setDate(d.getDate() + 1); // start from tomorrow
      if (systemStartDate) {
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        if (parsedStart > d) {
          d = new Date(parsedStart);
        }
      }
      while (d.getDay() !== dueDay) d.setDate(d.getDate() + 1);
      return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} (${dayNames[d.getDay()]})`;
    }

    if (frequency === "daily") {
      let tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (systemStartDate) {
        const parsedStart = new Date(systemStartDate);
        parsedStart.setHours(0, 0, 0, 0);
        if (parsedStart > tomorrow) {
          tomorrow = parsedStart;
        }
      }
      return `${tomorrow.getDate()} ${monthNames[tomorrow.getMonth()]} ${tomorrow.getFullYear()}`;
    }

    return "-";
  };

  return (
    <div className="space-y-6 pt-12 lg:pt-0 w-full fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-100 border-2 border-white text-indigo-600 flex items-center justify-center text-xl font-bold shadow-sm">
              {residentName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">Halo, {residentName}! 👋</h1>
            <p className="text-slate-500 text-sm font-semibold mt-1">Kamar {room} • Portal Pembayaran Mandiri</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 flex-col sm:flex-row sm:gap-1.5 items-end sm:items-center">
            <span>Kas {getFrequencyLabel(frequency)}: {formatCurrency(dynamicFee)}</span>
            {feeCount > 1 && (
              <span className="text-[10px] text-indigo-400 font-semibold">(Dihitung {feeCount}x {formatCurrency(baseFee)})</span>
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment actions column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card p-6 bg-white border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">STATUS TAGIHAN PERIODE INI</span>
                <span className="text-xs font-bold text-slate-500 uppercase">{activePeriodLabel}</span>
              </div>

              {paymentStatus === "confirmed" ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Tagihan Lunas</h3>
                  <p className="text-slate-500 text-xs leading-normal max-w-sm mx-auto font-medium">
                    Terima kasih! Pembayaran kas Anda periode <span className="font-bold text-slate-800">{activePeriodLabel}</span> telah diverifikasi oleh pengelola asrama.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Tagihan berikutnya jatuh pada: {getNextDueDate()}
                  </div>
                </div>
              ) : paymentStatus === "pending" ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Menunggu Verifikasi</h3>
                  <p className="text-slate-500 text-xs leading-normal max-w-sm mx-auto font-medium">
                    Anda sudah mengonfirmasi pembayaran kas. Mohon tunggu admin memverifikasi transfer dana Anda.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Pilih Nominal Pembayaran:
                    </label>
                    {fullMonthAmount > regularCycleAmount ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPayFull(false)}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${!payFull
                            ? "bg-indigo-50/60 border-indigo-200 ring-2 ring-indigo-500/10"
                            : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {regularCycleAmount > feePerPoint ? "Bayar Rutin + Tunggakan" : "Bayar Rutin"}
                            </span>
                            {!payFull && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                          </div>
                          <p className="text-base font-extrabold text-slate-800 mt-1">{formatCurrency(regularCycleAmount)}</p>
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            {regularCycleAmount > feePerPoint
                              ? "Termasuk akumulasi tunggakan"
                              : `Seperti biasa per ${frequency === "weekly" ? "minggu" : frequency === "daily" ? "hari" : "bulan"}`}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPayFull(true)}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${payFull
                            ? "bg-indigo-50/60 border-indigo-200 ring-2 ring-indigo-500/10"
                            : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bayar Penuh</span>
                            {payFull && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                          </div>
                          <p className="text-base font-extrabold text-slate-800 mt-1">{formatCurrency(fullMonthAmount)}</p>
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Satu bulan penuh</p>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1">
                        <div className="p-3.5 rounded-2xl border bg-indigo-50/60 border-indigo-200 ring-2 ring-indigo-500/10 text-left transition-all">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Bayar Penuh (Wajib)</span>
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          </div>
                          <p className="text-base font-extrabold text-slate-800 mt-1">{formatCurrency(fullMonthAmount)}</p>
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Tunggakan telah mencapai akhir periode bulan berjalan.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {qrCodeDataUrl ? (
                    <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="p-3 bg-white border border-slate-100 rounded-2xl inline-block shadow-sm shadow-slate-100 flex-shrink-0">
                        <img src={qrCodeDataUrl} alt="Dynamic QRIS" className="w-36 h-36 object-contain" />
                      </div>
                      <div className="space-y-2 text-center md:text-left min-w-0 flex-1">
                        <h4 className="text-sm font-extrabold text-slate-800">Scan QRIS</h4>
                        <p className="text-xs text-slate-500 leading-normal font-medium mb-3">
                          Scan menggunakan e-wallet (Gopay, OVO, Dana, LinkAja) atau Mobile Banking.
                          Nominal transfer otomatis terisi sebesar <span className="text-indigo-650 font-extrabold">{formatCurrency(selectedAmount)}</span>.
                        </p>

                        <div className="flex flex-col gap-1.5 mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shadow-slate-50">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-medium">Total Tagihan Bulan Ini</span>
                            <span className="font-bold text-slate-700">{formatCurrency(totalFeeThisMonth)}</span>
                          </div>
                          {totalPaidThisMonth > 0 && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Telah Dibayar</span>
                              <span className="font-bold text-emerald-600">- {formatCurrency(totalPaidThisMonth)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100 mt-0.5">
                            <span className="text-slate-800 font-bold">
                              {payFull ? "Nominal Bayar Penuh" : `Nominal Bayar Rutin (${frequency === "weekly" ? "Mingguan" : frequency === "daily" ? "Harian" : "Bulanan"})`}
                            </span>
                            <span className="font-extrabold text-indigo-600">{formatCurrency(selectedAmount)}</span>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          QRIS DINAMIS • AUTO-FEE 100% BEBAS BIAYA
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-600 flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <span className="text-left">Pengelola asrama belum mengunggah QRIS pembayaran. Hubungi admin untuk melengkapi konfigurasi.</span>
                    </div>
                  )}

                  <form onSubmit={handlePayConfirm} className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label htmlFor="confirm-note" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Sudah transfer? Konfirmasi di sini:
                      </label>
                      <input
                        id="confirm-note"
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="input-premium text-sm text-slate-800"
                        placeholder="Contoh: Transfer via GoPay an. Budi"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Bukti Pembayaran
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-xl"
                          required
                        />
                      </div>
                      {proofImage && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 shadow-sm max-w-[200px]">
                          <img src={proofImage} alt="Preview Bukti" className="w-full h-auto object-cover" />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !qrisString}
                      className="btn-premium-primary w-full"
                    >
                      {submitting ? "Mengirim Konfirmasi..." : "Saya Sudah Bayar"}
                    </button>

                    {success && (
                      <div className="p-3 rounded-2xl text-xs font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Konfirmasi pembayaran dikirim ke admin
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History column */}
        <div className="premium-card p-6 bg-white border border-slate-100 flex flex-col justify-between">
          <div className="w-full">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">Riwayat Kas Anda</h2>

            {history.length === 0 ? (
              <div className="text-center py-12">
                <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </span>
                <p className="text-slate-400 text-sm mt-3 font-semibold">Belum ada riwayat pembayaran</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                {history.slice(0, 3).map((h) => (
                  <div key={h.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-50 transition-colors space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-700 uppercase tracking-wider">{h.periodLabel}</span>
                      {h.status === "confirmed" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-600">Lunas</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-600">Verifikasi</span>
                      )}
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-400">Nominal:</span>
                      <span className={h.status === "confirmed" ? "text-emerald-650" : "text-amber-650"}>
                        {formatCurrency(h.amount)}
                      </span>
                    </div>
                    {h.paidAt && (
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>Tanggal:</span>
                        <span>
                          {new Date(h.paidAt.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    )}
                    {h.note && (
                      <p className="text-[10px] text-slate-400 font-semibold border-t border-slate-200/60 pt-1.5 leading-relaxed italic">
                        "{h.note}"
                      </p>
                    )}
                  </div>
                ))}

                {history.length > 3 && (
                  <div className="pt-2 text-center">
                    <a href="/beranda/riwayat" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                      Lihat Semua Riwayat ({history.length})
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Transparency Section */}
      <div className="premium-card p-6 sm:p-8 bg-white border border-slate-100 mt-8">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Transparansi Keuangan Asrama</h2>
          <p className="text-slate-500 text-xs mt-1 font-medium">Laporan kas masuk dan keluar secara terbuka untuk seluruh penghuni.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Total Kas Masuk</span>
            <span className="text-xl font-extrabold text-indigo-700">{formatCurrency(globalIncome)}</span>
          </div>
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Total Kas Terpakai</span>
            <span className="text-xl font-extrabold text-rose-700">{formatCurrency(globalExpense)}</span>
          </div>
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Saldo Kas Saat Ini</span>
            <span className="text-2xl font-extrabold text-emerald-700">{formatCurrency(globalIncome - globalExpense)}</span>
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-800 mb-4 tracking-tight">Riwayat Pengeluaran Kas</h3>
        {expensesList.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-slate-200">
            <span className="inline-block p-3 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
            <p className="text-slate-400 text-xs font-semibold">Belum ada pengeluaran kas yang dicatat oleh admin.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expensesList.map((exp) => (
              <div key={exp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-800">{exp.title}</h4>
                    <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-white rounded-full border border-slate-200">
                      {exp.date ? new Date(exp.date.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Baru saja"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium whitespace-pre-wrap">{exp.items}</p>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                  <span className="text-rose-600 font-extrabold text-sm">{formatCurrency(exp.amount)}</span>
                  {exp.proofImage && (
                    <button
                      onClick={() => setSelectedProof(exp.proofImage)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Lihat Bukti
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!selectedProof} onClose={() => setSelectedProof(null)} title="Bukti Pengeluaran" size="md">
        <div className="flex flex-col items-center justify-center p-4">
          <img src={selectedProof || ""} alt="Bukti Struk" className="max-w-full rounded-xl border border-slate-200 shadow-sm" />
        </div>
        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
          <button onClick={() => setSelectedProof(null)} className="btn-premium-secondary">Tutup</button>
        </div>
      </Modal>

      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Edit Profil" size="sm">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-20 h-20 group">
              {editAvatar ? (
                <img src={editAvatar} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-indigo-100" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 text-slate-400 flex items-center justify-center text-3xl font-bold">
                  {editName.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ubah Foto Profil</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-premium text-sm text-slate-800"
              placeholder="Nama lengkap Anda"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kamar</label>
            <CustomSelect
              options={rooms}
              value={editRoom}
              onChange={setEditRoom}
              placeholder={rooms.length === 0 ? "Memuat kamar..." : "Pilih Kamar"}
              disabled={rooms.length === 0}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowProfileModal(false)} className="btn-premium-secondary flex-1 text-sm py-3">Batal</button>
            <button type="submit" disabled={savingProfile} className="btn-premium-primary flex-1 text-sm py-3">{savingProfile ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
