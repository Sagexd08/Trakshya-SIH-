import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }){
  return (
    <div className="grid grid-cols-[16rem_1fr]">
      <Sidebar/>
      <div className="h-screen flex flex-col">
        <Navbar title="Dashboard"/>
        <main className="flex-1 overflow-auto p-4 space-y-4">{children}</main>
      </div>
    </div>
  );
}

