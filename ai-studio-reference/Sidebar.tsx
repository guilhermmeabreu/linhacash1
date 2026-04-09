import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  BarChart3, 
  User, 
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SidebarProps {
  className?: string;
  activeItem: string;
  onNavigate: (item: string) => void;
}

export function Sidebar({ className, activeItem, onNavigate }: SidebarProps) {
  const navItems = [
    { id: 'jogos', icon: LayoutDashboard, label: 'Jogos do dia' },
    { id: 'calendario', icon: Calendar, label: 'Calendário', badge: 'EM BREVE' },
    { id: 'classificacao', icon: BarChart3, label: 'Classificação', badge: 'EM BREVE' },
    { id: 'perfil', icon: User, label: 'Meu Perfil' },
  ];

  return (
    <aside className={cn("w-64 bg-surface border-r border-border flex flex-col h-screen", className)}>
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-accent flex items-center justify-center">
          <BarChart3 className="text-black w-5 h-5" />
        </div>
        <h1 className="text-xl font-black tracking-tighter uppercase">Linha<span className="text-accent">Cash</span></h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !item.badge && onNavigate(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 transition-all duration-200 group",
                isActive 
                  ? "bg-accent/10 text-accent border border-accent/20" 
                  : "text-muted hover:bg-white/5 hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-4 h-4", isActive ? "text-accent" : "text-muted group-hover:text-white")} />
                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 text-muted tracking-tighter">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-background p-4 border border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 flex items-center justify-center text-accent font-black text-xs border border-accent/30">
            G
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black truncate uppercase tracking-tighter">Guilherme de Abreu</p>
            <p className="text-[8px] text-muted font-black uppercase tracking-widest truncate">Plano Gratuito</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
