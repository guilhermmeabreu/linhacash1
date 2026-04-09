import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { PlayerChart } from './PlayerChart';
import { ProfileView } from './ProfileView';
import { LegalView } from './LegalView';
import { Modal } from './ui/Modal';
import { 
  ArrowLeft, 
  User, 
  Info,
  ChevronRight,
  Lock,
  Search,
  ChevronDown,
  MessageSquare,
  AlertTriangle,
  HelpCircle,
  X,
  Plus,
  Minus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface DashboardProps {
  onLogout: () => void;
}

type ViewType = 'games' | 'players' | 'detail' | 'profile' | 'terms' | 'privacy';

export function Dashboard({ onLogout }: DashboardProps) {
  const [view, setView] = useState<ViewType>('games');
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState<number>(0);

  const statsTabs = [
    'PTS', 'AST', 'REB', '3PM', 'PA', 'PR', 'PRA', 'AR', 'DD', 'TD', 'STEAL', 'BLOCKS', 'SB', 'FG2A', 'FG3A'
  ];

  const activeTab = '3PM';

  const games = [
    { id: 1, home: 'Houston Rockets', away: 'Phoenix Suns', time: '22:00', locked: false },
    { id: 2, home: 'Boston Celtics', away: 'Miami Heat', time: '22:30', locked: true },
    { id: 3, home: 'LA Lakers', away: 'GS Warriors', time: '23:00', locked: true },
    { id: 4, home: 'NY Knicks', away: 'PHI 76ers', time: '23:30', locked: true },
  ];

  const players = [
    { id: 1, name: 'Jayson Tatum', team: 'Boston Celtics', pos: 'SF', line: 27.5, stats: { pts: 26.9, reb: 8.1, ast: 4.9, stl: 1.0, blk: 0.6 } },
    { id: 2, name: 'Jaylen Brown', team: 'Boston Celtics', pos: 'SG', line: 22.5, stats: { pts: 23.0, reb: 5.5, ast: 3.6, stl: 1.2, blk: 0.5 } },
    { id: 3, name: 'Jimmy Butler', team: 'Miami Heat', pos: 'SF', line: 21.5, stats: { pts: 20.8, reb: 5.3, ast: 5.0, stl: 1.3, blk: 0.3 } },
    { id: 4, name: 'Bam Adebayo', team: 'Miami Heat', pos: 'C', line: 19.5, stats: { pts: 19.3, reb: 10.4, ast: 3.9, stl: 1.1, blk: 0.9 } },
  ];

  const handleGameClick = (game: any) => {
    if (game.locked) {
      setActiveModal('pro');
      return;
    }
    setSelectedGame(game);
    setView('players');
  };

  const handlePlayerClick = (player: any) => {
    setSelectedPlayer(player);
    setCurrentLine(player.line);
    setView('detail');
  };

  const adjustLine = (amount: number) => {
    setCurrentLine(prev => Math.max(0, prev + amount));
  };

  const navigateTo = (newView: ViewType) => {
    setView(newView);
    window.scrollTo(0, 0);
  };

  const renderHeader = () => {
    const titles: Record<ViewType, string> = {
      games: 'Jogos de Hoje',
      players: `${selectedGame?.away} vs ${selectedGame?.home}`,
      detail: selectedPlayer?.name || 'Detalhes',
      profile: 'Meu Perfil',
      terms: 'Termos de Uso',
      privacy: 'Privacidade'
    };

    return (
      <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 sticky top-0 bg-background/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          {view !== 'games' && (
            <button 
              onClick={() => {
                if (view === 'detail') setView('players');
                else if (view === 'players') setView('games');
                else setView('games');
              }}
              className="btn-ghost"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-[10px] font-black uppercase tracking-widest text-white">
            {titles[view]}
          </h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 border-r border-border pr-4">
            <span className="text-accent font-mono text-[10px] font-bold tracking-widest">LIVE DATA ACTIVE</span>
          </div>
          <button onClick={() => navigateTo('profile')} className="btn-ghost">
            <User className="w-5 h-5" />
          </button>
        </div>
      </header>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        className="hidden md:flex" 
        activeItem={view === 'profile' ? 'perfil' : 'jogos'}
        onNavigate={(item) => {
          if (item === 'perfil') navigateTo('profile');
          if (item === 'jogos') navigateTo('games');
        }}
      />
      
      <main className="flex-1 flex flex-col overflow-y-auto scrollbar-hide">
        {renderHeader()}

        <div className="w-full">
          {view === 'games' && (
            <div className="p-6 md:p-10 max-w-6xl mx-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <div 
                    key={game.id}
                    onClick={() => handleGameClick(game)}
                    className={cn(
                      "p-6 border border-border transition-all cursor-pointer group relative",
                      game.locked ? "opacity-60 grayscale" : "hover:border-accent hover:bg-surface"
                    )}
                  >
                    {game.locked && (
                      <div className="absolute top-4 right-4">
                        <Lock className="w-4 h-4 text-muted" />
                      </div>
                    )}
                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">{game.time}</div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-center flex-1">
                        <div className="w-12 h-12 bg-white/5 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-xs">
                          {game.away.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-xs font-bold truncate">{game.away}</div>
                      </div>
                      <div className="px-4 text-muted text-[10px] font-bold">VS</div>
                      <div className="text-center flex-1">
                        <div className="w-12 h-12 bg-white/5 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-xs">
                          {game.home.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-xs font-bold truncate">{game.home}</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border flex justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        {game.locked ? 'Desbloquear no Pro' : 'Ver Jogadores'} <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'players' && (
            <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tight">Jogadores</h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar jogador..." 
                    className="bg-surface border border-border pl-10 pr-4 py-2 text-xs rounded-full focus:border-accent outline-none w-64"
                  />
                </div>
              </div>
              <div className="technical-grid">
                {players.map((player) => (
                  <div 
                    key={player.id}
                    onClick={() => handlePlayerClick(player)}
                    className="technical-item group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-accent/10 flex items-center justify-center text-accent font-black text-xs border border-accent/20 shrink-0">
                        {player.name.substring(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold group-hover:text-accent transition-colors truncate">{player.name}</div>
                        <div className="text-[10px] text-muted font-bold uppercase tracking-widest truncate">{player.pos} • {player.team}</div>
                      </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8 px-8 border-x border-border">
                      {[
                        { label: 'PTS', val: player.stats.pts },
                        { label: 'REB', val: player.stats.reb },
                        { label: 'AST', val: player.stats.ast },
                        { label: 'STL', val: player.stats.stl },
                        { label: 'BLK', val: player.stats.blk },
                      ].map((s) => (
                        <div key={s.label} className="text-center w-10">
                          <div className="text-[8px] text-muted font-black uppercase tracking-widest mb-1">{s.label}</div>
                          <div className="font-mono font-bold text-xs">{s.val}</div>
                        </div>
                      ))}
                    </div>

                    <div className="text-right pl-6">
                      <div className="text-[8px] text-muted font-black uppercase tracking-widest mb-1">LINE</div>
                      <div className="font-mono font-bold text-lg text-accent">{player.line}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'detail' && (
            <div className="p-6 md:p-10 max-w-6xl mx-auto w-full">
              {/* Stats Tabs */}
              <div className="flex flex-wrap gap-1 mb-12 overflow-x-auto scrollbar-hide pb-2 border-b border-border">
                {statsTabs.map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      "px-4 py-3 text-[10px] font-black tracking-widest transition-all border-b-2",
                      tab === activeTab 
                        ? "border-accent text-accent" 
                        : "border-transparent text-muted hover:text-white"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Player Info */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                <div>
                  <p className="text-muted text-[10px] font-black tracking-[0.2em] uppercase mb-3">
                    {selectedPlayer?.team} • {selectedPlayer?.pos}
                  </p>
                  <h2 className="text-5xl md:text-7xl font-black leading-none mb-4 tracking-tighter">{selectedPlayer?.name}</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20">
                      <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent">Matchup Favorável</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                  <div className="flex items-center gap-6 p-4 bg-surface border border-border">
                    <div className="text-right">
                      <p className="text-muted text-[8px] font-black tracking-widest uppercase mb-1">AJUSTAR LINHA</p>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => adjustLine(-0.5)}
                          className="w-8 h-8 flex items-center justify-center border border-border hover:border-accent hover:text-accent transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <p className="text-3xl font-black text-accent font-mono w-20 text-center">{currentLine.toFixed(1)}</p>
                        <button 
                          onClick={() => adjustLine(0.5)}
                          className="w-8 h-8 flex items-center justify-center border border-border hover:border-accent hover:text-accent transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-12 w-full md:w-auto justify-between md:justify-end border-t border-border pt-8 md:border-none md:pt-0">
                    <div className="text-right">
                      <p className="text-muted text-[10px] font-black tracking-widest uppercase mb-2">OVER</p>
                      <p className="text-5xl font-black font-mono">-115</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-border border border-border mb-12 overflow-hidden">
                {[
                  { label: "25/26", val: "97%", sub: "SEASON" },
                  { label: "H2H", val: "100%", sub: "VS TEAM" },
                  { label: "L5", val: "80%", sub: "LAST 5", highlight: true },
                  { label: "L10", val: "80%", sub: "LAST 10", highlight: true },
                  { label: "L20", val: "90%", sub: "LAST 20", highlight: true },
                  { label: "24/25", val: "88%", sub: "PREV SEASON" },
                ].map((stat, i) => (
                  <div key={i} className="bg-background p-6 text-center">
                    <div className="text-[10px] text-muted font-black tracking-widest mb-1 uppercase">{stat.label}</div>
                    <div className={cn("text-2xl font-black mb-1 font-mono", stat.highlight ? "text-accent" : "text-white")}>{stat.val}</div>
                    <div className="text-[8px] text-muted font-bold tracking-widest uppercase">{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Chart Section */}
              <div className="mt-12 p-8 border border-border bg-surface/30">
                <h3 className="text-[10px] font-black tracking-[0.2em] uppercase mb-10 flex items-center gap-2 text-muted">
                  {activeTab} — ÚLTIMOS JOGOS (L5)
                  <Info className="w-4 h-4" />
                </h3>
                <PlayerChart lineValue={currentLine} />
              </div>
            </div>
          )}

          {view === 'profile' && (
            <ProfileView 
              onLogout={onLogout} 
              onOpenModal={(type) => {
                if (type === 'terms') navigateTo('terms');
                else if (type === 'privacy') navigateTo('privacy');
                else setActiveModal(type);
              }} 
            />
          )}

          {(view === 'terms' || view === 'privacy') && (
            <LegalView type={view as 'terms' | 'privacy'} />
          )}
        </div>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={activeModal === 'faq'} 
        onClose={() => setActiveModal(null)} 
        title="Perguntas Frequentes"
      >
        <div className="space-y-4">
          {[
            { q: "O que é o LinhaCash?", a: "Plataforma de análise de dados da NBA para apostadores. Mostramos estatísticas históricas dos jogadores para te ajudar a tomar decisões mais informadas." },
            { q: "Os dados são em tempo real?", a: "Os dados são atualizados diariamente antes dos jogos. Não exibimos estatísticas ao vivo durante as partidas." },
            { q: "Qual a diferença entre Gratuito e Pro?", a: "Gratuito: todos os jogos visíveis, com 1 jogo liberado por dia. Pro: todos os jogos liberados, todos os jogadores e estatísticas completas." }
          ].map((item, i) => (
            <div key={i} className="border border-border p-4">
              <div className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs font-bold">{item.q}</span>
                <ChevronDown className="w-4 h-4 text-muted group-hover:text-white transition-colors" />
              </div>
              <p className="mt-3 text-xs text-muted leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'support'} 
        onClose={() => setActiveModal(null)} 
        title="Falar com Suporte"
      >
        <div className="space-y-6">
          <div className="bg-accent/5 border border-accent/20 p-4 flex items-center gap-3">
            <Info className="w-4 h-4 text-accent" />
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Tempo médio de resposta: até 24 horas</p>
          </div>
          <div>
            <label>Assunto</label>
            <select className="w-full">
              <option>Dúvida sobre dados</option>
              <option>Problema com pagamento</option>
              <option>Dúvida sobre o plano Pro</option>
            </select>
          </div>
          <div>
            <label>Mensagem</label>
            <textarea className="w-full h-32 resize-none" placeholder="Descreva sua dúvida em detalhes..." />
          </div>
          <button className="btn-primary w-full">Enviar mensagem</button>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'bug'} 
        onClose={() => setActiveModal(null)} 
        title="Reportar Problema"
      >
        <div className="space-y-6">
          <div>
            <label>Tipo de problema</label>
            <select className="w-full">
              <option>Dado incorreto</option>
              <option>Erro na tela</option>
              <option>App travando</option>
            </select>
          </div>
          <div>
            <label>Descrição</label>
            <textarea className="w-full h-32 resize-none" placeholder="O que aconteceu? Descreva o problema com detalhes..." />
          </div>
          <button className="btn-primary w-full">Enviar relatório</button>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'pro'} 
        onClose={() => setActiveModal(null)} 
        title="Assine o Plano Pro"
      >
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-4xl font-black text-accent mb-2">R$ 24,90</h2>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Por mês no plano mensal</p>
          </div>
          <div className="technical-grid">
            {[
              "Todos os jogos da rodada",
              "Todos os jogadores liberados",
              "Estatísticas avançadas (H2H, L20)",
              "Suporte prioritário"
            ].map((feature, i) => (
              <div key={i} className="technical-item cursor-default group">
                <span className="text-xs font-bold">{feature}</span>
                <ChevronRight className="w-4 h-4 text-accent" />
              </div>
            ))}
          </div>
          <button className="btn-primary w-full">Assinar Agora</button>
          <p className="text-center text-[10px] font-black text-muted uppercase tracking-widest">Economize 34% no plano anual</p>
        </div>
      </Modal>
    </div>
  );
}
