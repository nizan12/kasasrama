import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db, secondaryAuth } from "../firebase";
import { Modal } from "../components/Modal";
import { CustomSelect } from "../components/CustomSelect";
import { Skeleton } from "../components/Skeleton";

interface Resident {
  id: string;
  name: string;
  room: string;
  isActive: boolean;
  hasAccount?: boolean;
}

export function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [rooms, setRooms] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Account creation state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountResident, setAccountResident] = useState<Resident | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");

  // Track which residents have accounts
  const [accountMap, setAccountMap] = useState<Set<string>>(new Set());

  const loadResidents = useCallback(async () => {
    try {
      const q = showInactive
        ? collection(db, "residents")
        : query(collection(db, "residents"), where("isActive", "==", true));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Resident));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setResidents(data);

      // Check which residents have accounts
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "penghuni")));
      const resIds = new Set<string>();
      usersSnap.docs.forEach((d) => {
        const rid = d.data().residentId as string;
        if (rid) resIds.add(rid);
      });
      setAccountMap(resIds);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  const loadRooms = async () => {
    if (rooms.length > 0) return;
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

  const openAdd = async () => {
    setEditId(null);
    setFormName("");
    setFormRoom("");
    setShowModal(true);
    await loadRooms();
  };

  const openEdit = async (r: Resident) => {
    setEditId(r.id);
    setFormName(r.name);
    setFormRoom(r.room);
    setShowModal(true);
    await loadRooms();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRoom.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "residents", editId), {
          name: formName.trim(),
          room: formRoom.trim(),
        });
      } else {
        await addDoc(collection(db, "residents"), {
          name: formName.trim(),
          room: formRoom.trim(),
          isActive: true,
          createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
      await loadResidents();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: Resident) => {
    try {
      await updateDoc(doc(db, "residents", r.id), { isActive: !r.isActive });
      await loadResidents();
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateAccount = (r: Resident) => {
    setAccountResident(r);
    setAccountEmail("");
    setAccountPassword("");
    setAccountError("");
    setAccountSuccess("");
    setShowAccountModal(true);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountResident || !accountEmail.trim() || !accountPassword.trim()) return;
    if (accountPassword.length < 6) {
      setAccountError("Password minimal 6 karakter");
      return;
    }
    setCreatingAccount(true);
    setAccountError("");
    setAccountSuccess("");

    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        accountEmail.trim(),
        accountPassword
      );

      await setDoc(doc(db, "users", cred.user.uid), {
        email: accountEmail.trim(),
        role: "penghuni",
        residentId: accountResident.id,
      });

      await signOut(secondaryAuth);

      setAccountSuccess(`Akun berhasil dibuat untuk ${accountResident.name}`);
      await loadResidents();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/email-already-in-use") {
        setAccountError("Email sudah digunakan");
      } else if (code === "auth/invalid-email") {
        setAccountError("Format email tidak valid");
      } else if (code === "auth/weak-password") {
        setAccountError("Password terlalu lemah (minimal 6 karakter)");
      } else {
        setAccountError("Gagal membuat akun. Coba lagi.");
        console.error(err);
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const filtered = residents.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.room.toLowerCase().includes(search.toLowerCase())
  );



  return (
    <div className="space-y-6 pt-12 lg:pt-0 fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Kelola Penghuni</h1>
          <p className="text-slate-500 text-sm mt-1">{residents.length} Penghuni terdaftar di sistem</p>
        </div>
        <button 
          onClick={openAdd} 
          className="btn-premium-primary flex items-center gap-2 text-sm font-bold py-3"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Tambah Penghuni
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Cari nama atau nomor kamar..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="input-premium pl-12 text-sm text-slate-800" 
          />
        </div>
        <label className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-500 shadow-sm shadow-slate-100/50">
          <input 
            type="checkbox" 
            checked={showInactive} 
            onChange={(e) => setShowInactive(e.target.checked)} 
            className="rounded bg-white border-slate-300 text-indigo-600 focus:ring-indigo-500/30" 
          />
          Tampilkan Nonaktif
        </label>
      </div>

      {/* Table Card */}
      <div className="premium-card overflow-hidden bg-white border border-slate-100 shadow-sm">
        {loading ? (
          <Skeleton type="table" count={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </span>
            <p className="text-slate-400 text-sm font-bold mt-3">Belum ada data penghuni</p>
            <p className="text-slate-400 text-xs mt-1">Ketuk tombol "Tambah Penghuni" untuk meregistrasikan baru</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nama</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Kamar</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Akun Portal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const hasAccount = accountMap.has(r.id);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-650 flex-shrink-0">
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm font-semibold">{r.room}</td>
                      <td className="px-6 py-4">
                        {r.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-650 border border-emerald-100">Aktif</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-650 border border-rose-100">Nonaktif</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {hasAccount ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Terhubung
                          </span>
                        ) : (
                          <button
                            onClick={() => openCreateAccount(r)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold underline underline-offset-2 transition-colors"
                          >
                            Buat Akun Login
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => openEdit(r)} 
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-colors" 
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleActive(r)}
                            className={`p-2 rounded-xl border transition-colors ${
                              r.isActive 
                                ? "bg-slate-50 border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600" 
                                : "bg-slate-50 border-slate-200 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600"
                            }`}
                            title={r.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {r.isActive ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Resident Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? "Edit Penghuni" : "Tambah Penghuni"} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="res-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
            <input 
              id="res-name" 
              type="text" 
              value={formName} 
              onChange={(e) => setFormName(e.target.value)} 
              className="input-premium text-sm text-slate-800" 
              placeholder="Masukkan nama lengkap..." 
              required 
              autoFocus 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor Kamar</label>
            <CustomSelect
              options={rooms}
              value={formRoom}
              onChange={setFormRoom}
              placeholder={rooms.length === 0 ? "Memuat kamar..." : "Pilih Kamar"}
              disabled={rooms.length === 0}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-premium-secondary flex-1 text-sm py-3">Batal</button>
            <button type="submit" disabled={saving} className="btn-premium-primary flex-1 text-sm py-3">{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      {/* Create Account Modal */}
      <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Buat Akun Portal" size="sm">
        {accountResident && (
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 flex-shrink-0">
                {accountResident.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-800 leading-tight">{accountResident.name}</p>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Kamar {accountResident.room}</p>
              </div>
            </div>

            {accountError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600 flex items-start gap-2 fade-in">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{accountError}</span>
              </div>
            )}

            {accountSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-600 flex items-center gap-2 fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>{accountSuccess}</span>
              </div>
            )}

            {!accountSuccess && (
              <>
                <div className="space-y-2">
                  <label htmlFor="acc-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Login</label>
                  <input id="acc-email" type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} className="input-premium text-sm text-slate-800" placeholder="penghuni@email.com" required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="acc-pass" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                  <input id="acc-pass" type="text" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} className="input-premium text-sm text-slate-800" placeholder="Minimal 6 karakter" required minLength={6} />
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">Berikan password ini agar penghuni dapat masuk ke portal mandiri.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAccountModal(false)} className="btn-premium-secondary flex-1 text-sm py-3">Batal</button>
                  <button type="submit" disabled={creatingAccount} className="btn-premium-primary flex-1 text-sm py-3">
                    {creatingAccount ? "Memproses..." : "Buat Akun"}
                  </button>
                </div>
              </>
            )}

            {accountSuccess && (
              <button type="button" onClick={() => setShowAccountModal(false)} className="btn-premium-primary w-full text-sm py-3">Tutup Dialog</button>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
