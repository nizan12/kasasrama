import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ResidentsPage } from "./pages/ResidentsPage";
import { PaymentPage } from "./pages/PaymentPage";
import { PaymentHistoryPage } from "./pages/PaymentHistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminCalendarPage } from "./pages/AdminCalendarPage";
import { ResidentHomePage } from "./pages/ResidentHomePage";
import { ResidentHistoryPage } from "./pages/ResidentHistoryPage";
import { ResidentCalendarPage } from "./pages/ResidentCalendarPage";
import { RoomsPage } from "./pages/RoomsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, logout } = useAuth();
  const [showDenied, setShowDenied] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    if (user && !profile) {
      setShowDenied(false);
      // Wait 2 seconds to allow profile doc creation/sync to resolve
      timeoutId = window.setTimeout(() => {
        setShowDenied(true);
      }, 2000);
    } else {
      setShowDenied(false);
    }
    return () => clearTimeout(timeoutId);
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <svg className="w-10 h-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile) {
    if (!showDenied) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
          <svg className="w-10 h-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-100/50 max-w-sm border border-slate-100">
          <svg className="w-12 h-12 text-rose-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Akses Ditolak</h2>
          <p className="text-sm text-slate-500 mb-6">Profil tidak ditemukan atau Anda tidak memiliki izin untuk mengakses aplikasi ini.</p>
          <button
            onClick={logout}
            className="w-full bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile?.role !== "admin") return <Navigate to="/beranda" replace />;
  return <>{children}</>;
}

function ResidentRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile?.role !== "penghuni") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (user && profile) {
    return <Navigate to={profile.role === "admin" ? "/" : "/beranda"} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/lupa-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

          {/* Admin routes */}
          <Route path="/" element={<ProtectedRoute><AdminRoute><Layout /></AdminRoute></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="penghuni" element={<ResidentsPage />} />
            <Route path="pembayaran" element={<PaymentPage />} />
            <Route path="riwayat" element={<PaymentHistoryPage />} />
            <Route path="pengeluaran" element={<ExpensesPage />} />
            <Route path="kalender" element={<AdminCalendarPage />} />
            <Route path="kamar" element={<RoomsPage />} />
            <Route path="pengaturan" element={<SettingsPage />} />
          </Route>

          {/* Resident routes */}
          <Route path="/beranda" element={<ProtectedRoute><ResidentRoute><Layout /></ResidentRoute></ProtectedRoute>}>
            <Route index element={<ResidentHomePage />} />
            <Route path="riwayat" element={<ResidentHistoryPage />} />
            <Route path="kalender" element={<ResidentCalendarPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
