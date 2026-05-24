import React from "react";

interface SkeletonProps {
  type: "card" | "table" | "grid" | "stat" | "residentHome" | "residentCalendar" | "residentHistory" | "settings";
  count?: number;
}

export function Skeleton({ type, count = 1 }: SkeletonProps) {
  const renderSkeletons = (content: React.ReactNode) => {
    return Array.from({ length: count }).map((_, i) => (
      <React.Fragment key={i}>{content}</React.Fragment>
    ));
  };

  if (type === "card") {
    return renderSkeletons(
      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-slate-200/60" />
          <div className="w-16 h-6 rounded-full bg-slate-200/60" />
        </div>
        <div className="space-y-2">
          <div className="w-24 h-4 rounded-lg bg-slate-200/60" />
          <div className="w-32 h-8 rounded-xl bg-slate-200/60" />
        </div>
      </div>
    );
  }

  if (type === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {renderSkeletons(
          <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm animate-pulse flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-slate-200/60" />
              <div className="space-y-2">
                <div className="w-24 h-4 rounded-lg bg-slate-200/60" />
                <div className="w-16 h-3 rounded-lg bg-slate-200/60" />
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200/60" />
          </div>
        )}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="overflow-x-auto w-full animate-pulse">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4"><div className="w-20 h-4 bg-slate-200/60 rounded-md" /></th>
              <th className="px-6 py-4"><div className="w-32 h-4 bg-slate-200/60 rounded-md" /></th>
              <th className="px-6 py-4"><div className="w-24 h-4 bg-slate-200/60 rounded-md" /></th>
              <th className="px-6 py-4"><div className="w-16 h-4 bg-slate-200/60 rounded-md" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderSkeletons(
              <tr>
                <td className="px-6 py-4"><div className="w-24 h-4 bg-slate-200/60 rounded-md" /></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-200/60" />
                    <div className="w-32 h-4 bg-slate-200/60 rounded-md" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="w-20 h-5 bg-slate-200/60 rounded-full" />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-200/60" />
                    <div className="w-8 h-8 rounded-xl bg-slate-200/60" />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "residentHome") {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 animate-pulse w-full">
        <div className="flex items-center gap-4 p-4 sm:p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-200/60" />
          <div className="space-y-2 flex-1">
            <div className="w-48 h-6 rounded-lg bg-slate-200/60" />
            <div className="w-64 h-4 rounded-md bg-slate-200/60" />
          </div>
          <div className="hidden sm:block w-32 h-10 rounded-xl bg-slate-200/60" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-100 space-y-6">
              <div className="flex justify-between">
                <div className="w-32 h-4 bg-slate-200/60 rounded-md" />
                <div className="w-24 h-4 bg-slate-200/60 rounded-md" />
              </div>
              <div className="w-32 h-10 bg-slate-200/60 rounded-xl" />
              <div className="flex gap-4 items-center">
                <div className="w-36 h-36 bg-slate-200/60 rounded-2xl" />
                <div className="space-y-2 flex-1">
                  <div className="w-32 h-4 bg-slate-200/60 rounded-md" />
                  <div className="w-full h-4 bg-slate-200/60 rounded-md" />
                  <div className="w-3/4 h-4 bg-slate-200/60 rounded-md" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="w-full h-10 bg-slate-200/60 rounded-xl" />
                <div className="w-full h-32 bg-slate-200/60 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-100 space-y-4">
              <div className="w-32 h-6 bg-slate-200/60 rounded-lg" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-full h-20 bg-slate-200/60 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "residentCalendar") {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 animate-pulse w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-200/60" />
          <div className="w-48 h-8 rounded-lg bg-slate-200/60" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-100 space-y-6">
            <div className="flex justify-between items-center">
              <div className="w-10 h-10 rounded-full bg-slate-200/60" />
              <div className="w-32 h-6 rounded-lg bg-slate-200/60" />
              <div className="w-10 h-10 rounded-full bg-slate-200/60" />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-200/60 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-1 p-6 rounded-3xl bg-white border border-slate-100 space-y-4">
            <div className="w-48 h-6 bg-slate-200/60 rounded-lg mb-6" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-full h-16 bg-slate-200/60 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "residentHistory") {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 animate-pulse w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-200/60" />
          <div className="w-48 h-8 rounded-lg bg-slate-200/60" />
        </div>
        <div className="rounded-3xl bg-white border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4"><div className="w-20 h-4 bg-slate-200/60 rounded-md" /></th>
                <th className="px-6 py-4"><div className="w-32 h-4 bg-slate-200/60 rounded-md" /></th>
                <th className="px-6 py-4"><div className="w-24 h-4 bg-slate-200/60 rounded-md" /></th>
                <th className="px-6 py-4"><div className="w-16 h-4 bg-slate-200/60 rounded-md" /></th>
                <th className="px-6 py-4"><div className="w-32 h-4 bg-slate-200/60 rounded-md" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="w-24 h-4 bg-slate-200/60 rounded-md" /></td>
                  <td className="px-6 py-4"><div className="w-32 h-4 bg-slate-200/60 rounded-md" /></td>
                  <td className="px-6 py-4"><div className="w-20 h-5 bg-slate-200/60 rounded-md" /></td>
                  <td className="px-6 py-4"><div className="w-16 h-6 bg-slate-200/60 rounded-full" /></td>
                  <td className="px-6 py-4"><div className="w-48 h-4 bg-slate-200/60 rounded-md" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "settings") {
    return (
      <div className="space-y-6 animate-pulse max-w-2xl">
        {renderSkeletons(
          <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-5">
            <div className="w-40 h-6 bg-slate-200/60 rounded-lg" />
            <div className="space-y-2">
              <div className="w-24 h-4 bg-slate-200/60 rounded-md" />
              <div className="w-full h-12 bg-slate-200/60 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="w-32 h-4 bg-slate-200/60 rounded-md" />
              <div className="w-full h-12 bg-slate-200/60 rounded-xl" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
