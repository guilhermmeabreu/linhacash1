import React, { useState } from 'react';
import { BarChart3, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface AuthViewProps {
  onLogin: () => void;
}

export function AuthView({ onLogin }: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-accent flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">
            Linha<span className="text-accent">Cash</span>
          </h1>
          <p className="text-muted text-xs font-bold uppercase tracking-widest">Análise de props da NBA</p>
        </div>

        <div className="bg-surface border border-border p-8 md:p-10">
          <p className="text-center text-muted text-sm mb-8">Entre para acessar seus jogos e continuar sua rotina de análise.</p>
          
          {/* Tabs */}
          <div className="flex bg-background border border-border p-1 mb-8">
            <button 
              onClick={() => setTab('login')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                tab === 'login' ? "bg-surface text-accent border border-accent/20" : "text-muted hover:text-white"
              )}
            >
              Entrar
            </button>
            <button 
              onClick={() => setTab('register')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                tab === 'register' ? "bg-surface text-accent border border-accent/20" : "text-muted hover:text-white"
              )}
            >
              Criar conta
            </button>
          </div>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
            {tab === 'register' && (
              <div>
                <label>Nome</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="text" placeholder="Seu nome" className="w-full pl-12" />
                </div>
              </div>
            )}
            <div>
              <label>Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input type="email" placeholder="seu@email.com" className="w-full pl-12" />
              </div>
            </div>
            <div>
              <label>Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input type="password" placeholder="••••••••" className="w-full pl-12" />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              {tab === 'login' ? 'Entrar' : 'Criar conta grátis'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {tab === 'login' && (
            <p className="text-center mt-6 text-xs text-muted">
              Esqueceu a senha? <button className="text-accent font-bold hover:underline">Recuperar</button>
            </p>
          )}

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-surface px-4 text-muted">ou</span></div>
          </div>

          <button className="w-full bg-background border border-border py-4 flex items-center justify-center gap-3 hover:bg-white/5 transition-colors group">
            <svg width="18" height="18" viewBox="0 0 24 24" className="group-hover:scale-110 transition-transform"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span className="text-xs font-bold">Continuar com Google</span>
          </button>
        </div>

        <div className="mt-10 text-center space-y-4">
          <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted">
            <a href="#" className="hover:text-white">Termos de uso</a>
            <span>•</span>
            <a href="#" className="hover:text-white">Política de privacidade</a>
          </div>
          <p className="text-[10px] text-muted leading-relaxed max-w-xs mx-auto">
            Uso responsável: o LinhaCash é uma plataforma informativa e não intermedia apostas.
          </p>
        </div>
      </div>
    </div>
  );
}
