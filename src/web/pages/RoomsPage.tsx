import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { Pagination } from "../components/Pagination";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";

interface Room {
  id: string;
  name: string;
  occupantsCount?: number;
}

export function RoomsPage() {
  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "rooms"));
      
      const resSnap = await getDocs(query(collection(db, "residents"), where("isActive", "==", true)));
      const counts: Record<string, number> = {};
      resSnap.docs.forEach(d => {
        const r = d.data();
        if (r.room) counts[r.room] = (counts[r.room] || 0) + 1;
      });

      const data = snap.docs.map((d) => {
        const roomData = d.data();
        return { 
          id: d.id, 
          name: roomData.name,
          occupantsCount: counts[roomData.name] || 0
        } as Room;
      });
      data.sort((a, b) => a.name.localeCompare(b.name));
      setRooms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const openAdd = () => {
    setEditId(null);
    setFormName("");
    setShowModal(true);
  };

  const openEdit = (r: Room) => {
    setEditId(r.id);
    setFormName(r.name);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "rooms", deleteId));
      setDeleteId(null);
      await loadRooms();
      toast.success("Kamar berhasil dihapus");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus kamar");
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "rooms", editId), {
          name: formName.trim(),
        });
        toast.success("Kamar berhasil diperbarui");
      } else {
        await addDoc(collection(db, "rooms"), {
          name: formName.trim(),
          createdAt: serverTimestamp(),
        });
        toast.success("Kamar baru berhasil ditambahkan");
      }
      setShowModal(false);
      await loadRooms();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan data kamar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginatedRooms = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-6 pt-12 lg:pt-0 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Manajemen Kamar</h1>
          <p className="text-slate-500 text-sm mt-1">{rooms.length} Kamar terdaftar di sistem</p>
        </div>
        <button onClick={openAdd} className="btn-premium-primary flex items-center gap-2 text-sm font-bold py-3">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Tambah Kamar
        </button>
      </div>

      <div className="relative max-w-md">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input 
          type="text" 
          placeholder="Cari nama kamar..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="input-premium pl-12 text-sm text-slate-800" 
        />
      </div>

      <div className="premium-card overflow-hidden bg-white border border-slate-100 shadow-sm">
        {loading ? (
          <Skeleton type="table" count={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
            <p className="text-slate-400 text-sm font-bold mt-3">Belum ada data kamar</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Kamar</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Penghuni Aktif</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRooms.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          </div>
                          {r.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {r.occupantsCount !== undefined && r.occupantsCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {r.occupantsCount} Orang
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
                            Kosong
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(r)} className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-colors" title="Edit">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors" title="Hapus">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              onItemsPerPageChange={(val) => {
                setPerPage(val);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? "Edit Kamar" : "Tambah Kamar"} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Kamar</label>
            <input 
              type="text" 
              value={formName} 
              onChange={(e) => setFormName(e.target.value)} 
              className="input-premium text-sm text-slate-800" 
              placeholder="Contoh: A-101" 
              required 
              autoFocus 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-premium-secondary flex-1 text-sm py-3">Batal</button>
            <button type="submit" disabled={saving} className="btn-premium-primary flex-1 text-sm py-3">{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Hapus Kamar"
        message="Apakah Anda yakin ingin menghapus kamar ini? Semua data kamar akan dihapus secara permanen dari sistem."
        confirmText="Hapus"
        type="danger"
        isLoading={deleting}
      />
    </div>
  );
}
