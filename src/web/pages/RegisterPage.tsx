import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { collection, query, getDocs, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { CustomSelect } from "../components/CustomSelect";
import { useAuth } from "../contexts/AuthContext";

export function RegisterPage() {
  const { logoUrl, logoLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [rooms, setRooms] = useState<{ value: string; label: string }[]>([]);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRooms = async () => {
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
    };
    fetchRooms();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!name.trim() || !email.trim() || !password || !selectedRoom) {
      setError("Semua field harus diisi");
      return;
    }
    
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Auth User
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Update Auth Profile (optional)
      await updateProfile(cred.user, { displayName: name });
      
      // 3. Create Resident Profile in Firestore
      const residentRef = await addDoc(collection(db, "residents"), {
        name: name.trim(),
        room: selectedRoom,
        isActive: true,
        createdAt: serverTimestamp(),
      });
      
      // 4. Create User Role in Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        email: email.trim(),
        role: "penghuni",
        residentId: residentRef.id,
      });

      // Navigate to portal
      navigate("/beranda");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("Email sudah digunakan");
      } else if (code === "auth/invalid-email") {
        setError("Format email tidak valid");
      } else {
        setError(`Gagal mendaftar. Error: ${(err as Error).message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-[#f8fafc] to-indigo-50/40 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[100px]" />

      <div className="w-full max-w-md relative z-10 space-y-8 fade-in">
        <div className="text-center">
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
            Daftar Penghuni
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Buat akun untuk akses portal pembayaran</p>
        </div>

        <div className="premium-card p-8 bg-white border border-slate-100 shadow-xl shadow-slate-100/50 space-y-6">
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-premium text-sm text-slate-800"
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kamar</label>
              <CustomSelect
                options={rooms}
                value={selectedRoom}
                onChange={setSelectedRoom}
                placeholder={rooms.length === 0 ? "Memuat kamar..." : "Pilih Kamar"}
                disabled={rooms.length === 0}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium text-sm text-slate-800"
                placeholder="name@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-premium text-sm text-slate-800"
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-premium-primary w-full mt-2"
            >
              {loading ? "Memproses..." : "Daftar Sekarang"}
            </button>
          </form>
          
          <div className="text-center pt-2">
            <Link to="/login" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors">
              Sudah punya akun? Masuk di sini
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
