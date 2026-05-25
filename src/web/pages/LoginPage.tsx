import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, profile, user, logoUrl, logoLoading, backgroundUrl } = useAuth();
  const navigate = useNavigate();

  // Navigate as soon as profile is confirmed loaded after login
  useEffect(() => {
    if (user && profile) {
      if (profile.role === "admin") navigate("/", { replace: true });
      else navigate("/beranda", { replace: true });
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      // Navigation is handled by the useEffect above once profile loads
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Email atau password tidak sesuai");
      } else if (code === "auth/too-many-requests") {
        setError("Terlalu banyak percobaan masuk. Silakan coba lagi nanti.");
      } else {
        setError(`Gagal masuk. Error: ${(err as Error).message || JSON.stringify(err)}`);
      }
      setLoading(false);
    }
    // Note: don't setLoading(false) on success — useEffect navigates, unmounting this page
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

      <div className="w-full max-w-md relative z-10">
        {/* Login Form Card */}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Uang Kas Asrama
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Sistem Pembayaran Kas</p>
          </div>

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
              <label htmlFor="login-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium pl-12 text-sm text-slate-800"
                  placeholder="name@email.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-premium pl-12 pr-12 text-sm text-slate-800"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`btn-premium-primary w-full mt-2 transition-opacity ${loading ? "opacity-75 cursor-not-allowed" : ""}`}
            >
              {loading ? "Menghubungkan..." : "Masuk ke Dashboard"}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2 pt-2">
            <Link to="/lupa-password" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors">
              Lupa password?
            </Link>
            <Link to="/register" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors">
              Belum punya akun? Daftar di sini
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
