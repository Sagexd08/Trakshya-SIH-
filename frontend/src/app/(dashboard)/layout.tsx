"use client";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { usePathname } from "next/navigation";
import { strings } from "@/lib/i18n";
import { Toaster } from "sonner";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/conflicts": "Conflict Predictions",
  "/energy": "Energy Optimization",
  "/scenarios": "What-If Scenarios",
  "/traffic": "Real-time Traffic",
  "/reports": "Reports",
  "/ai": "AI Assistant"
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar */}
        <Navbar title={title} />

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 space-y-4 min-h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
      />
    </div>
  );
}

