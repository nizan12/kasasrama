import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex min-h-screen bg-[#f8fafc] w-full relative">
      {/* Light, soft colored background gradients */}
      <div className="absolute top-0 left-0 w-full h-[320px] bg-gradient-to-b from-indigo-50/40 via-transparent to-transparent pointer-events-none" />
      
      <Sidebar />
      
      <main className="flex-1 min-h-screen relative z-10 overflow-y-auto">
        <div className="p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
