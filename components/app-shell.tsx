'use client';

import {
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';

import { signOutAction } from '@/app/actions/auth';
import type { UserProfile } from '@/lib/types';

import { Logo } from './logo';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/favoritos', label: 'Favoritos', icon: Star },
  { href: '/perfil', label: 'Perfil', icon: UserRound },
];

const ADMIN_NAV = [{ href: '/admin', label: 'Administração', icon: ShieldCheck }];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isSigningOut, startSignOut] = useTransition();

  const items = profile.role === 'admin' ? [...NAV, ...ADMIN_NAV] : NAV;
  const initials = (profile.nome || profile.email)
    .replace(/[^a-zA-ZÀ-ÿ ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? 'bg-brand-cyan/12 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            }`}
          >
            {active ? (
              <span className="absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-cyan" />
            ) : null}
            <Icon
              className={`size-[18px] ${active ? 'text-brand-cyan' : 'text-slate-500 group-hover:text-slate-300'}`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const userCard = (
    <div className="border-t border-white/8 p-3">
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-cyan to-brand-lime text-xs font-black text-ink-950">
          {initials || 'U'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {profile.nome || 'Assinante'}
          </span>
          <span className="block truncate text-xs text-slate-400">{profile.email}</span>
        </span>
        {profile.role === 'admin' ? (
          <span className="chip border-brand-lime/30 bg-brand-lime/10 text-brand-lime">
            admin
          </span>
        ) : null}
      </div>

      <button
        type="button"
        disabled={isSigningOut}
        onClick={() =>
          startSignOut(async () => {
            await signOutAction();
          })
        }
        className="btn-ghost mt-2 w-full"
      >
        <LogOut className="size-4" />
        {isSigningOut ? 'Saindo…' : 'Sair'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/8 bg-ink-900/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-white/8 px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 flex-col py-4">{navList}</div>
        {userCard}
      </aside>

      {/* drawer mobile */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/10 bg-ink-900">
            <div className="flex h-16 items-center justify-between border-b border-white/8 px-5">
              <Logo />
              <button
                type="button"
                aria-label="Fechar menu"
                className="btn-ghost size-9 p-0"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col py-4">{navList}</div>
            {userCard}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/8 bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Abrir menu"
            className="btn-ghost size-9 p-0 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <Link href="/dashboard" className="lg:hidden">
            <Logo size="sm" />
          </Link>
          <span className="ml-auto hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <span className="size-1.5 rounded-full bg-brand-lime" />
            Área de membros
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
