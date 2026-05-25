import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const adminMenuItems = [
  {
    path: "/",
    label: "Dashboard Overview",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: "/penghuni",
    label: "Data Penghuni",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    path: "/kamar",
    label: "Manajemen Kamar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: "/pembayaran",
    label: "Kelola Pembayaran",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    path: "/riwayat",
    label: "Riwayat Transaksi",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    path: "/pengeluaran",
    label: "Pengeluaran Kas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: "/kalender",
    label: "Kalender Kas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    path: "/pengaturan",
    label: "Pengaturan Sistem",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const residentMenuItems = [
  {
    path: "/beranda",
    label: "Portal Beranda",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: "/beranda/riwayat",
    label: "Riwayat Kas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: "/beranda/kalender",
    label: "Kalender Kas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayRendered, setOverlayRendered] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    if (mobileOpen) {
      setOverlayRendered(true);
      timeoutId = window.setTimeout(() => setOverlayVisible(true), 10);
    } else {
      setOverlayVisible(false);
      timeoutId = window.setTimeout(() => setOverlayRendered(false), 300);
    }
    return () => clearTimeout(timeoutId);
  }, [mobileOpen]);
  const { logout, user, profile, logoUrl, logoLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.role === "admin";
  const menuItems = isAdmin ? adminMenuItems : residentMenuItems;
  const [residentName, setResidentName] = useState("");
  const [residentAvatar, setResidentAvatar] = useState("");

  // Fetch resident name + avatar for penghuni
  useEffect(() => {
    if (!isAdmin && profile?.residentId) {
      getDoc(doc(db, "residents", profile.residentId)).then((snap) => {
        if (snap.exists()) {
          setResidentName(snap.data().name || "");
          setResidentAvatar(snap.data().avatar || "");
        }
      }).catch(() => {});
    }
  }, [isAdmin, profile?.residentId]);

  // Live-update when profile is saved from the modal
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string; avatar: string }>).detail;
      if (detail.name !== undefined) setResidentName(detail.name);
      if (detail.avatar !== undefined) setResidentAvatar(detail.avatar);
    };
    window.addEventListener("profileUpdated", handler);
    return () => window.removeEventListener("profileUpdated", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
        aria-label="Buka menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {overlayRendered && (
        <div
          className={`lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${overlayVisible ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} 
          lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:min-h-0
          bg-white border-r border-slate-200/80`}
      >
        {/* Brand logo */}
        <div className="flex items-center gap-3.5 px-6 py-6 border-b border-slate-100">
          {logoLoading ? (
            <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse flex-shrink-0 border border-slate-200/50" />
          ) : logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-md shadow-indigo-600/10 flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-none">Uang Kas</h1>
            <p className="text-[10px] text-indigo-600 font-bold tracking-wider mt-1 uppercase">Portal Asrama</p>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-6 py-4 border-b border-slate-100/60 bg-slate-50/50">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            isAdmin 
              ? "bg-indigo-50 text-indigo-600 border-indigo-100" 
              : "bg-emerald-50 text-emerald-600 border-emerald-100"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? "bg-indigo-500" : "bg-emerald-500"}`} />
            {isAdmin ? "Administrator" : "Penghuni"}
          </span>
        </div>

        {/* Nav list */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/" || item.path === "/beranda"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 border ${
                  isActive
                    ? "bg-indigo-50/80 text-indigo-600 border-indigo-100/50 shadow-sm shadow-indigo-100/30"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 space-y-3">
          {/* User info — clickable for penghuni to edit profile */}
          {isAdmin ? (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center border bg-indigo-50 text-indigo-600 border-indigo-100 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate font-bold">{user?.email || "User"}</p>
                <p className="text-[10px] text-slate-400 font-semibold truncate">Sesi Aktif</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("openProfileModal"));
                setMobileOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-emerald-50 hover:border-emerald-100 border border-transparent transition-all group text-left"
            >
              {residentAvatar ? (
                <img src={residentAvatar} alt={residentName} className="w-8 h-8 rounded-full object-cover border border-emerald-100 flex-shrink-0" />
              ) : residentName ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-700 text-sm font-bold flex-shrink-0">
                  {residentName.charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center border bg-emerald-50 text-emerald-600 border-emerald-100 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate font-bold group-hover:text-emerald-700 transition-colors">
                  {residentName || user?.email || "Penghuni"}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold truncate">{user?.email}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-rose-600 bg-rose-50/50 hover:bg-rose-50 border border-rose-100/30 hover:border-rose-100 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>
    </>
  );
}
