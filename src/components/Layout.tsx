import { FileText, Calendar, FileCheck, Menu, X, PlusCircle, Building2 } from 'lucide-react';
import React, { useState } from 'react';
import logoUrl from './logo-main-negative.png';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: 'cadastro', label: 'Cadastros', icon: PlusCircle },
  { id: 'aniversarios', label: 'Aniversários', icon: Calendar },
  { id: 'documentos', label: 'Checklist Docs', icon: FileCheck },
  { id: 'boletos', label: 'Envio de Boletos', icon: FileText },
];

const pageTitles: Record<string, string> = {
  cadastro: 'Cadastros',
  aniversarios: 'Aniversários',
  documentos: 'Checklist de Documentos',
  boletos: 'Envio de Boletos',
};

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logoUrl}
        alt="Logo IMG Imóveis Mogi Guaçu"
        className="w-11 h-11 rounded-full bg-white shadow-md ring-2 ring-white/20 object-contain p-1"
      />
      <div className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-white">IMG</span>
        <span className="block text-[11px] font-medium text-sidebar-foreground/80">
          Imóveis Mogi Guaçu
        </span>
      </div>
    </div>
  );
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background font-sans">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-brand-navy/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 transform flex-col bg-sidebar transition-transform duration-200 ease-in-out lg:static lg:inset-0 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-5">
          <Brand />
          <button
            className="text-sidebar-foreground/70 transition-colors hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 p-4" aria-label="Navegação principal">
          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Gestão de Locações
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/50'
                  }`}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent px-4 py-3">
            <Building2 className="h-4 w-4 shrink-0 text-sidebar-primary" />
            <p className="text-xs leading-relaxed text-sidebar-foreground/80">
              Sistema interno de gestão de contratos
            </p>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="flex h-16 items-center justify-between bg-sidebar px-4 lg:hidden">
          <Brand />
          <button
            className="text-sidebar-foreground/80 transition-colors hover:text-white"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-10">
            <div className="mb-6 hidden lg:block">
              <h1 className="text-2xl font-bold tracking-tight text-brand-navy text-balance">
                {pageTitles[activeTab]}
              </h1>
              <div className="mt-2 h-1 w-12 rounded-full bg-primary" />
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
