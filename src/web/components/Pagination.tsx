import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (perPage: number) => void;
}

const PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];

function PerPageSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [openUp, setOpenUp] = useState(false);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = PER_PAGE_OPTIONS.length * 36 + 12; // estimated height
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const shouldOpenUp = spaceBelow < dropdownHeight;
    setOpenUp(shouldOpenUp);

    if (shouldOpenUp) {
      setDropdownStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  };

  useEffect(() => {
    let timeoutId: number;
    if (isOpen) {
      updatePosition();
      setIsRendered(true);
      timeoutId = window.setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      timeoutId = window.setTimeout(() => setIsRendered(false), 200);
    }
    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on scroll / resize
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const dropdown = isRendered && (
    <div
      style={dropdownStyle}
      className={`bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 overflow-y-auto transition-all duration-200 ease-out ${openUp ? "origin-bottom" : "origin-top"} ${isVisible ? "opacity-100 scale-100 translate-y-0" : `opacity-0 scale-95 ${openUp ? "translate-y-2" : "-translate-y-2"}`}`}
    >
      <div className="p-1.5 flex flex-col gap-0.5">
        {PER_PAGE_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(opt);
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              value === opt
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`text-left px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold transition-all duration-300 shadow-sm shadow-slate-100 flex items-center gap-2 ${
          isOpen ? "border-indigo-500 ring-4 ring-indigo-500/10" : "hover:border-indigo-300"
        }`}
      >
        <span className="text-slate-700">{value}</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  );
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage, onItemsPerPageChange }: PaginationProps) {
  const from = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
      <div className="flex items-center gap-3">
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Tampilkan</span>
            <PerPageSelect
              value={itemsPerPage}
              onChange={(val) => {
                onItemsPerPageChange(val);
                onPageChange(1);
              }}
            />
            <span className="text-xs text-slate-500 font-medium">per halaman</span>
          </div>
        )}
        <span className="text-xs text-slate-400 font-medium hidden sm:inline">·</span>
        <p className="text-xs text-slate-500 font-medium">
          Menampilkan <span className="font-bold text-slate-700">{from}–{to}</span> dari <span className="font-bold text-slate-700">{totalItems}</span> data
        </p>
      </div>
      <div className="flex items-center gap-1">
          {/* First page «  */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
          >
            «
          </button>
          {/* Prev page ‹ */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
          >
            ‹
          </button>

          {pages.map((page, i) =>
            page === "..." ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 font-medium">…</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                  currentPage === page
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                }`}
              >
                {page}
              </button>
            )
          )}

          {/* Next page › */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
          >
            ›
          </button>
          {/* Last page » */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
          >
            »
          </button>
        </div>
    </div>
  );
}
