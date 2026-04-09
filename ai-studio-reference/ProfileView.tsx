import React from 'react';
import { 
  User, 
  Shield, 
  Sun, 
  HelpCircle, 
  MessageSquare, 
  AlertTriangle, 
  FileText, 
  Lock, 
  Trash2,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ProfileViewProps {
  onLogout: () => void;
  onOpenModal: (type: string) => void;
}

export function ProfileView({ onLogout, onOpenModal }: ProfileViewProps) {
  const sections = [
    {
      title: "Planos",
      items: [
        { 
          label: "Gratuito", 
          sub: "Todos os jogos visíveis • 1 jogo liberado • 1 jogador/time • Acesso parcial às estatísticas", 
          badge: "Ativo", 
          badgeColor: "text-accent",
          onClick: () => {} 
        },
        { 
          label: "Pro", 
          sub: "R$24,90/mês • Todos os jogos • Todos os jogadores • Todas as estatísticas liberadas", 
          icon: <ChevronRight className="w-4 h-4 text-muted" />,
          onClick: () => onOpenModal('pro') 
        }
      ]
    },
    {
      title: "Conta",
      items: [
        { label: "Editar perfil", icon: <User className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('edit-profile') },
        { label: "Segurança", icon: <Shield className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('security') },
        { label: "Tema", sub: "Escuro", icon: <Sun className="w-4 h-4 text-muted" />, onClick: () => {} }
      ]
    },
    {
      title: "Suporte",
      items: [
        { label: "Perguntas frequentes", icon: <HelpCircle className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('faq') },
        { label: "Falar com suporte", icon: <MessageSquare className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('support') },
        { label: "Reportar um problema", icon: <AlertTriangle className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('bug') },
        { label: "Termos de uso", icon: <FileText className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('terms') },
        { label: "Política de privacidade", icon: <Lock className="w-4 h-4 text-muted" />, onClick: () => onOpenModal('privacy') },
        { label: "Excluir minha conta e dados", icon: <Trash2 className="w-4 h-4 text-red-500" />, labelColor: "text-red-500", onClick: () => onOpenModal('delete-account') }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {/* Header Card */}
      <div className="bg-surface border border-border p-10 text-center mb-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.1),transparent_70%)] pointer-events-none" />
        <div className="w-24 h-24 bg-accent flex items-center justify-center text-black text-4xl font-black mx-auto mb-6 relative z-10">
          G
        </div>
        <h2 className="text-3xl font-black mb-2 relative z-10">Guilherme de Abreu</h2>
        <p className="text-muted text-sm mb-6 relative z-10">guilhermede.abreu@hotmail.com</p>
        <div className="inline-flex items-center gap-2 px-4 py-1 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest relative z-10">
          Plano Gratuito
        </div>
      </div>

      {/* Technical Grids */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {sections.slice(0, 2).map((section, i) => (
          <div key={i}>
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">{section.title}</h3>
            <div className="technical-grid">
              {section.items.map((item, j) => (
                <div key={j} className="technical-item group" onClick={item.onClick}>
                  <div className="flex flex-col gap-1">
                    <span className={cn("text-xs font-bold", item.labelColor || "text-white")}>{item.label}</span>
                    {item.sub && <span className="text-[10px] text-muted leading-tight max-w-[200px]">{item.sub}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {item.badge && <span className={cn("text-[10px] font-black uppercase tracking-widest", item.badgeColor)}>{item.badge}</span>}
                    {item.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Support Section */}
      <div className="mb-12">
        <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">{sections[2].title}</h3>
        <div className="technical-grid">
          {sections[2].items.map((item, j) => (
            <div key={j} className="technical-item group" onClick={item.onClick}>
              <div className="flex items-center gap-4">
                {item.icon}
                <span className={cn("text-xs font-bold", item.labelColor || "text-white")}>{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Logout Button */}
      <div className="flex justify-center">
        <button onClick={onLogout} className="btn-secondary flex items-center gap-3 border-red-500/30 text-red-500 hover:bg-red-500/5">
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
