"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navigationGroups } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { can, type Identity } from "@/lib/auth/permissions";
import { LogoutButton } from "@/components/auth/logout-button";
type ShellUser = Identity & { name: string };
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join("") || "CC";}
function NavTree({user,close,collapsed,navigate}:{user:ShellUser;close?:()=>void;collapsed:boolean;navigate:(event:ReactMouseEvent<HTMLAnchorElement>,href:string)=>void}) {
  const pathname=usePathname(); const allowed=navigationGroups.filter(item=>can(user,item.permission));
  const [expanded,setExpanded]=useState<string|null>(navigationGroups.find(item=>item.children?.some(child=>child.href===pathname))?.label ?? null);
  return <nav aria-label="Main navigation" className="space-y-1">{allowed.map(({label,href,icon:Icon,children})=>{
    const links=children?.filter(child=>can(user,child.permission)); const active=pathname===href || links?.some(item=>item.href===pathname);
    return <div key={label}>
      <div className="flex items-center gap-1">
        <Link title={collapsed?label:undefined} aria-current={pathname===href&&!children?"page":undefined} onClick={event=>{close?.();navigate(event,href);}} href={href} className={cn("flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",active?"bg-primary text-[#171717]":"text-white/75 hover:bg-white/10 hover:text-white",collapsed&&"justify-center px-2")}><Icon size={18}/><span className={collapsed?"sr-only":"truncate"}>{label}</span></Link>
        {links&&links.length>0&&!collapsed&&<button type="button" onClick={()=>setExpanded(expanded===label?null:label)} className="rounded p-2 text-white/60 hover:bg-white/10" aria-label={`${expanded===label?"Collapse":"Expand"} ${label}`} aria-expanded={expanded===label}>{expanded===label?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button>}
      </div>
      {links&&links.length>0&&!collapsed&&expanded===label&&<div className="ml-5 mt-1 space-y-1 border-l border-white/15 pl-3">{links.map(child=><Link key={`${label}-${child.label}`} href={child.href} onClick={event=>{close?.();navigate(event,child.href);}} aria-current={pathname===child.href?"page":undefined} className={cn("block rounded-md px-3 py-2 text-xs transition-colors",pathname===child.href?"bg-white/10 text-white":"text-white/60 hover:bg-white/10 hover:text-white")}>{child.label}</Link>)}</div>}
    </div>;
  })}</nav>;
}
export function AppShell({children,user}:{children:ReactNode;user:ShellUser}) {
  const [collapsed,setCollapsed]=useState(false);const [open,setOpen]=useState(false);const pathname=usePathname();const router=useRouter();const [isPending,startTransition]=useTransition();
  const navigate=(event:ReactMouseEvent<HTMLAnchorElement>,href:string)=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();if(href!==pathname)startTransition(()=>router.push(href));};
  const selected=navigationGroups.find(group=>group.href===pathname||group.children?.some(item=>item.href===pathname));
  const tabs=selected?.children?.filter(item=>can(user,item.permission));
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#main-content" className="sr-only z-[100] rounded bg-white p-3 focus:not-sr-only focus:fixed">Skip to content</a>
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto bg-sidebar px-3 py-5 transition-[width] lg:flex",collapsed?"w-[76px]":"w-[248px]")}>
      <Link href="/" title="Cue. & Coffee" className={cn("mb-6 flex h-10 items-center gap-3 px-2 text-white",collapsed&&"justify-center")}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1"><Image src="/cuecafe.png" alt="Cue. & Coffee" width={32} height={32} priority className="h-8 w-8 rounded-full object-cover"/></span>{!collapsed&&<span className="text-base font-semibold">cue<span className="text-primary">.</span> & coffee</span>}</Link>
      <NavTree user={user} collapsed={collapsed} navigate={navigate}/>
      <div className={cn("mt-auto border-t border-white/10 pt-4",collapsed?"flex flex-col items-center gap-3":"flex items-center gap-2")}>
        <span title={user.name} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials(user.name)}</span>
        {!collapsed&&<span className="min-w-0 flex-1 truncate text-xs text-white">{user.name}</span>}
        {!collapsed&&<LogoutButton compact/>}
        <button onClick={()=>setCollapsed(!collapsed)} className="rounded-md p-2 text-white/65 hover:bg-white/10" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
        {collapsed&&<LogoutButton compact/>}
      </div>
    </aside>
    <div className={cn("min-h-screen transition-[padding]",collapsed?"lg:pl-[76px]":"lg:pl-[248px]")}>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={20}/></Button><span className="text-sm font-medium">{selected?.label ?? "Overview"}</span>{isPending&&<span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-[#4B5563]"><LoaderCircle size={15} className="text-primary motion-safe:animate-spin"/><span className="sr-only">Loading page</span></span>}</div>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-muted sm:inline">{user.role}</span><span aria-label={user.name} className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-900 lg:hidden">{initials(user.name)}</span></div>
      </header>
      {tabs&&tabs.length>1&&<nav aria-label={`${selected?.label} pages`} className="relative z-10 flex flex-wrap gap-2 border-b border-border bg-white px-4 py-3 shadow-none sm:px-6">{tabs.map(tab=><Link key={`${selected?.label}-${tab.label}`} href={tab.href} onClick={event=>navigate(event,tab.href)} aria-current={pathname===tab.href?"page":undefined} className={cn("inline-flex min-h-9 items-center rounded-md border px-3 py-2 text-xs font-semibold transition-colors",pathname===tab.href?"border-primary bg-primary text-[#171717]":"border-border bg-white text-[#4B5563] hover:border-[#CBD0D6] hover:bg-[#F1F3F5] hover:text-[#171717]")}>{tab.label}</Link>)}</nav>}
      <main id="main-content" className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
      <footer className="px-4 pb-5 text-[11px] text-muted sm:px-6">cue. & coffee · NPR · Asia/Kathmandu</footer>
    </div>
    <Modal open={open} onOpenChange={setOpen} title="Navigation" description="Choose a workspace."><NavTree user={user} close={()=>setOpen(false)} collapsed={false} navigate={navigate}/><div className="mt-4 flex items-center justify-between border-t pt-4"><span className="text-sm">{user.name}</span><LogoutButton compact/></div></Modal>
  </div>;
}
