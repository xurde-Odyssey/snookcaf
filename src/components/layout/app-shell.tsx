"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CircleDot,
  Menu,
  PanelLeftClose,
} from "lucide-react";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { can, routePermissions, type Identity } from "@/lib/auth/permissions";
import { LogoutButton } from "@/components/auth/logout-button";
type ShellUser = Identity & { name: string };
function NavLinks({ close, user }: { close?: () => void; user: ShellUser }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {navigation.filter(n => can(user, routePermissions[n.href])).map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={close}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
            href === "/settings" && "mt-7 border-t border-white/10 pt-4",
            pathname === href
              ? "bg-[#ff7417] text-[#111111]"
              : "text-[#b8babf] hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon size={18} strokeWidth={1.7} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function AppShell({ children, user }: { children: ReactNode; user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = navigation.find((n) => n.href === pathname)?.label ?? "Page";
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded bg-white p-3 focus:not-sr-only focus:fixed"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto bg-[#111111] px-4 py-7 lg:flex">
        <Link
          href="/"
          className="mb-10 flex items-center gap-3 px-3 text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[#111]">
            <CircleDot size={23} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            cue<span className="text-primary">.</span> & coffee
          </span>
        </Link>
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[.18em] text-gray-500">
          WORKSPACE
        </p>
        <NavLinks user={user} />
        <div className="mt-auto pt-8">
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs font-medium text-white">
              Built for your daily rhythm.
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-400">
              Tables, coffee, and everything in between.
            </p>
            <span className="mt-3 inline-flex items-center gap-2 text-[11px] text-orange-300">
              Staff workspace <ArrowUpRight size={13} />
            </span>
          </div>
          <div className="mt-5 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs text-white">
              SC
            </span>
            <div>
              <p className="text-xs font-medium text-white">Snooker + Café</p>
              <p className="mt-1 text-[10px] text-gray-400">Nepal · NPR</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="flex h-[76px] items-center justify-between border-b border-border bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Workspace
            </span>
            <ChevronRight className="hidden text-gray-300 sm:block" size={15} />
            <span className="text-sm font-medium">{current}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              {user.role}
            </span>
            <LogoutButton />
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-800"
              aria-label={user.name}
            >
              SC
            </span>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1600px] p-5 sm:p-8">
          {children}
        </main>
        <footer className="flex flex-wrap justify-between gap-2 px-5 pb-6 text-[11px] text-muted-foreground sm:px-8">
          <span>cue. & coffee · Business management</span>
          <span>NPR currency · Asia/Kathmandu time</span>
        </footer>
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Your workspace"
        description="Navigate the application preview."
      >
        <div className="rounded-xl bg-[#111111] p-3">
          <NavLinks user={user} close={() => setOpen(false)} />
        </div>
        <Button
          className="mt-4 w-full"
          variant="outline"
          onClick={() => setOpen(false)}
        >
          <PanelLeftClose size={16} />
          Close navigation
        </Button>
      </Modal>
    </div>
  );
}
