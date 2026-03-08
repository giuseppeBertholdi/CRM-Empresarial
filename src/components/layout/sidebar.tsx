"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bot,
  Building2,
  Gauge,
  MessageCircleMore,
  Settings2,
  ShieldUser,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/common/logout-button";

type SidebarProps = {
  role: "ATTENDANT" | "MANAGER" | "ADMIN";
  departmentName?: string | null;
  userName: string;
};

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/conversations", label: "Conversas", icon: MessageCircleMore },
  { href: "/customers", label: "Clientes", icon: Building2 },
  { href: "/automations", label: "Automações", icon: Bot },
];

const adminLinks = [
  { href: "/users", label: "Usuários", icon: Users },
  { href: "/departments", label: "Setores", icon: Settings2 },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Sidebar({ role, departmentName, userName }: SidebarProps) {
  const pathname = usePathname();
  const [logoError, setLogoError] = useState(false);

  const links = role === "ADMIN" ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <aside className="flex h-screen w-80 flex-col border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100">
      <div className="border-b border-slate-700/70 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          {!logoError ? (
            <Image
              src="/jjsul.png"
              alt="JJSul"
              width={108}
              height={34}
              className="rounded-lg bg-white/95 p-1 object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20" />
          )}
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            {departmentName ?? "Sem setor"}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon size={16} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/70 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldUser size={16} className="text-slate-300" />
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs uppercase tracking-wide text-slate-300">{role}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
