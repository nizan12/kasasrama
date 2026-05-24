import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CustomSelect({ options, value, onChange, placeholder = "Pilih opsi...", disabled = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    let timeoutId: number;
    if (isOpen) {
      setIsRendered(true);
      timeoutId = window.setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      timeoutId = window.setTimeout(() => setIsRendered(false), 200);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium transition-all shadow-sm shadow-slate-100 flex items-center justify-between ${
          disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
        } ${isOpen ? "border-indigo-500 ring-4 ring-indigo-500/10" : ""}`}
      >
        <span className={selectedOption ? "text-slate-800" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isRendered && (
        <div className={`absolute top-full left-0 right-0 z-[100] mt-1 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 max-h-60 overflow-y-auto transition-all duration-200 ease-out origin-top ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2"}`}>
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">Data tidak tersedia</div>
          ) : (
            <div className="p-1.5 flex flex-col gap-0.5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    value === option.value
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
