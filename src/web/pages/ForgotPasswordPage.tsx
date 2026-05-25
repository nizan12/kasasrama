import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export function ForgotPasswordPage() {
  const { logoUrl, logoLoading, backgroundUrl } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        setError("Email tidak ditemukan atau tidak valid.");
      } else {
        setError("Gagal mengirim email reset. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-[#f8fafc] to-indigo-50/40 relative overflow-hidden"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {!backgroundUrl && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[100px]" />
        </>
      )}

      {backgroundUrl && (
        <div className="absolute inset-0 bg-slate-900/30" />
      )}

      <div className="w-full max-w-md relative z-10 fade-in">
        <div className="premium-card p-8 bg-white/95 backdrop-blur-xl border border-slate-100 shadow-2xl shadow-slate-900/10 space-y-6">
          {/* Brand Header */}
          <div className="text-center pb-2">
          {logoLoading ? (
            <div className="w-16 h-16 rounded-2xl mb-4 bg-slate-100 animate-pulse mx-auto border border-slate-200/50" />
          ) : logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain mb-4 mx-auto block" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-gradient-to-tr from-indigo-600 to-violet-600 p-[1px] shadow-lg shadow-indigo-500/10">
              <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
            </div>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Lupa Password</h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">
            Masukkan email Anda dan kami akan mengirimkan link reset password
          </p>
        </div>
          {sent ? (
            <div className="text-center space-y-4">
              {/* Success state */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-800 font-bold text-base">Email Terkirim!</p>
                <p className="text-slate-500 text-sm mt-1">
                  Cek inbox <span className="font-bold text-indigo-600">{email}</span> dan ikuti petunjuk untuk mereset password Anda.
                </p>
                <p className="text-slate-400 text-xs mt-2">Periksa folder spam jika email tidak muncul dalam beberapa menit.</p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Kirim ulang ke email lain
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-2xl text-sm bg-rose-50 border border-rose-100 text-rose-600 flex items-start gap-2.5">
                  <svg className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="fp-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-premium text-sm text-slate-800"
                    placeholder="name@email.com"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`btn-premium-primary w-full transition-opacity ${loading ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  {loading ? "Mengirim..." : "Kirim Link Reset Password"}
                </button>
              </form>
            </>
          )}

          <div className="text-center pt-1">
            <Link to="/login" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors">
              ← Kembali ke halaman masuk
            </Link>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="inline-block text-xs font-semibold px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/40 text-slate-600 shadow-sm">
            Sistem Pembayaran Uang Kas Asrama Mandiri © 2026.
          </p>
        </div>
      </div>
    </div>
  );
}
