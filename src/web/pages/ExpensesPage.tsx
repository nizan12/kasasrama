import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, deleteDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { Pagination } from "../components/Pagination";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";

interface Expense {
  id: string;
  title: string;
  amount: number;
  items: string;
  proofImage: string;
  date: { seconds: number } | null;
}



export function ExpensesPage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [itemList, setItemList] = useState([{ name: "", qty: 1, price: 0 }]);
  const [proofImage, setProofImage] = useState("");

  const computedAmount = itemList.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load expenses
      const qExp = query(collection(db, "expenses"), orderBy("date", "desc"));
      const snapExp = await getDocs(qExp);
      const dataExp = snapExp.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Expense[];
      setExpenses(dataExp);

      // Load total income from confirmed payments
      const qPay = query(collection(db, "payments"), where("status", "==", "confirmed"));
      const snapPay = await getDocs(qPay);
      const income = snapPay.docs.reduce((sum, doc) => sum + ((doc.data().amount as number) || 0), 0);
      setTotalIncome(income);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setProofImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const currentBalance = totalIncome - totalExpense;

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !proofImage || itemList.length === 0) {
      toast.warning("Mohon lengkapi semua data, termasuk bukti pengeluaran.");
      return;
    }
    
    for (const item of itemList) {
      if (!item.name || item.qty < 1 || item.price < 0) {
        toast.warning("Mohon lengkapi rincian barang dengan benar.");
        return;
      }
    }

    if (computedAmount > currentBalance) {
      toast.error(`Saldo tidak mencukupi! Sisa saldo saat ini: ${formatCurrency(currentBalance)}`);
      return;
    }

    setSubmitting(true);
    try {
      const itemsString = itemList.map((i, idx) => `${idx + 1}. ${i.name} (${i.qty}x @ ${formatCurrency(i.price)})`).join("\n");
      
      await addDoc(collection(db, "expenses"), {
        title,
        amount: computedAmount,
        items: itemsString,
        proofImage,
        date: serverTimestamp(),
      });
      setShowModal(false);
      setTitle("");
      setItemList([{ name: "", qty: 1, price: 0 }]);
      setProofImage("");
      loadData();
      toast.success("Catatan pengeluaran berhasil disimpan");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menambahkan pengeluaran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "expenses", deleteId));
      setDeleteId(null);
      loadData();
      toast.success("Catatan pengeluaran berhasil dihapus");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus catatan pengeluaran");
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(expenses.length / perPage);
  const paginated = expenses.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-6 pt-12 lg:pt-0 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pengeluaran Kas</h1>
          <p className="text-slate-500 text-sm mt-1">Catat dan pantau penggunaan uang kas asrama secara transparan.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-premium-primary whitespace-nowrap self-start sm:self-auto">
          + Catat Pengeluaran
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-650 border border-emerald-100">
          Saldo Kas Tersedia: {formatCurrency(currentBalance)}
        </span>
        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-650 border border-rose-100">
          Total Kas Keluar: {formatCurrency(totalExpense)}
        </span>
        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
          {expenses.length} Transaksi
        </span>
      </div>

      <div className="premium-card overflow-hidden bg-white border border-slate-100 shadow-sm">
        {loading ? (
          <Skeleton type="table" count={5} />
        ) : expenses.length === 0 ? (
          <div className="text-center py-16">
            <span className="inline-block p-4 rounded-full bg-slate-50 text-slate-400 mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
            <p className="text-slate-400 text-sm font-bold mt-3">Belum ada pengeluaran kas tercatat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Keperluan</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Rincian Barang</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nominal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-400 text-xs font-semibold">
                      {e.date ? new Date(e.date.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Baru saja"}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{e.title}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-pre-wrap max-w-xs">{e.items}</td>
                    <td className="px-6 py-4 text-rose-600 font-bold text-sm">{formatCurrency(e.amount)}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-rose-500 font-bold hover:text-rose-700 transition-colors">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={expenses.length}
          itemsPerPage={perPage}
          onItemsPerPageChange={(val) => { setPerPage(val); setPage(1); }}
        />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Catat Pengeluaran" size="lg">
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Keperluan (Judul)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-premium text-sm text-slate-800" placeholder="Contoh: Beli Alat Kebersihan" required />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rincian Barang yang Dibeli</label>
              <button 
                type="button" 
                onClick={() => setItemList([...itemList, { name: "", qty: 1, price: 0 }])}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md"
              >
                + Tambah Item
              </button>
            </div>
            
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {itemList.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex-1">
                    <input type="text" value={item.name} onChange={(e) => {
                      setItemList(itemList.map((it, i) => i === idx ? { ...it, name: e.target.value } : it));
                    }} className="input-premium text-xs text-slate-800 w-full" placeholder="Nama barang" required />
                  </div>
                  <div className="w-full sm:w-20">
                    <input type="number" value={item.qty || ""} onChange={(e) => {
                      setItemList(itemList.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it));
                    }} className="input-premium text-xs text-slate-800 w-full" placeholder="Qty" min="1" required />
                  </div>
                  <div className="flex-1">
                    <input type="number" value={item.price || ""} onChange={(e) => {
                      setItemList(itemList.map((it, i) => i === idx ? { ...it, price: Number(e.target.value) } : it));
                    }} className="input-premium text-xs text-slate-800 w-full" placeholder="Harga satuan" min="0" required />
                  </div>
                  {itemList.length > 1 && (
                    <button type="button" onClick={() => {
                      const newList = itemList.filter((_, i) => i !== idx);
                      setItemList(newList);
                    }} className="p-2 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batas Maksimal (Saldo Tersedia)</span>
              <span className="text-sm font-bold text-slate-700">{formatCurrency(currentBalance)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-indigo-200/50 pt-2">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Pengeluaran</span>
              <span className={`text-lg font-extrabold ${computedAmount > currentBalance ? "text-rose-600" : "text-indigo-700"}`}>
                {formatCurrency(computedAmount)}
              </span>
            </div>
            {computedAmount > currentBalance && (
              <p className="text-[10px] font-bold text-rose-500 mt-1 text-right">
                ! Total melebihi batas saldo !
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upload Foto Bukti / Struk</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-xl" required />
            {proofImage && (
              <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 shadow-sm max-w-[150px]">
                <img src={proofImage} alt="Preview Bukti" className="w-full h-auto object-cover" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-premium-secondary flex-1">Batal</button>
            <button type="submit" disabled={submitting} className="btn-premium-primary flex-1">{submitting ? "Menyimpan..." : "Simpan Pengeluaran"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Hapus Pengeluaran"
        message="Apakah Anda yakin ingin menghapus catatan pengeluaran ini secara permanen dari sistem?"
        confirmText="Hapus"
        type="danger"
        isLoading={deleting}
      />
    </div>
  );
}
