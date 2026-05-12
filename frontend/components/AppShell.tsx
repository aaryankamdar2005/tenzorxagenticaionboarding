"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, ShieldCheck, FileText, Settings, Users, Building2 } from "lucide-react";
import { loadAuth, clearAuth } from "../lib/api";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "banker" | null>(null);
  const [name, setName] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Exclude login/register pages from the shell
  const isAuthPage = pathname.includes("/login") || pathname.includes("/register") || pathname === "/";
  // The video room should be full screen without the sidebar
  const isVideoRoom = pathname.includes("/onboarding/");

  useEffect(() => {
    const auth = loadAuth();
    if (auth) {
      setRole(auth.role);
      setName(auth.name);
    } else {
      setRole(null);
    }
    setIsLoaded(true);
  }, [pathname]);

  const handleLogout = () => {
    clearAuth();
    router.push(role === "banker" ? "/banker/login" : "/login");
  };

  if (!isLoaded) return <div className="min-h-screen" />;

  if (isAuthPage || isVideoRoom) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Permanent Translucent Sidebar - Only for Bankers */}
      {role === "banker" && (
        <aside className="fixed inset-y-0 left-0 z-50 w-64 glass-panel border-r border-white/20 flex-col hidden md:flex">
          <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 text-brand-blue">
            <Building2 size={24} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-tight">SecureBank</p>
              <h1 className="text-sm font-bold leading-tight text-slate-900">
                {role === "banker" ? "Underwriting" : "Personal"}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Officer Controls</p>
          <NavLink href="/banker/dashboard" icon={Users} label="Applicant Queue" active={pathname === "/banker/dashboard"} />
          <NavLink href="/admin" icon={FileText} label="Audit Logs" active={pathname === "/admin"} />
          <NavLink href="/admin/dashboard" icon={ShieldCheck} label="Risk Center" active={pathname.includes("/admin/dashboard")} disabled={!pathname.includes("/admin/dashboard")} />
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="rounded-xl bg-white/20 p-4 border border-white/30 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xs shadow-inner">
                {name ? name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{name || "User"}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {role === "banker" ? "Authorized Officer" : "Verified Customer"}
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 text-xs font-bold transition-all border border-red-500/20"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col min-h-screen ${role === "banker" ? "md:pl-64" : ""}`}>
        <div className="flex-1 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({ href, icon: Icon, label, active, disabled }: { href: string, icon: any, label: string, active: boolean, disabled?: boolean }) {
  if (disabled) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 opacity-50 cursor-not-allowed`}>
        <Icon size={18} /> {label}
      </div>
    );
  }
  return (
    <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
      active 
        ? "bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 shadow-sm border border-brand-blue/20 dark:border-brand-blue/30" 
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
    }`}>
      <Icon size={18} /> {label}
    </Link>
  );
}
