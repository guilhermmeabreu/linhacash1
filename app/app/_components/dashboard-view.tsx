'use client';

import { BarChart3, CalendarDays, LayoutDashboard, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppShell,
  ContentContainer,
  MobileSidebar,
  Sidebar,
  TopBar,
} from '@/components/layout';
import {
  Badge,
  Button,
  Surface,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from '@/components/ui';
import styles from './dashboard-view.module.css';

const STATS = ['PTS', 'AST', 'REB', '3PM', 'PA', 'PR', 'PRA', 'AR', 'DD', 'TD', 'STEAL', 'BLOCKS', 'SB', 'FG2A', 'FG3A'] as const;

type Stat = (typeof STATS)[number];

type Game = {
  id: number;
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  home_logo: string | null;
  away_logo: string | null;
  game_time: string;
};

type Player = {
  id: number;
  name: string;
  team_id: number;
  team: string;
  position: string;
  jersey: string | number | null;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const sidebarItems = [
  { key: 'dashboard', label: 'Jogos do dia', href: '/app', icon: LayoutDashboard },
  { key: 'calendario', label: 'Calendário', href: '/app', icon: CalendarDays, disabled: true },
  { key: 'stats', label: 'Classificação', href: '/app', icon: BarChart3, disabled: true },
  { key: 'perfil', label: 'Meu perfil', href: '/app', icon: UserRound, disabled: true },
];

function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('lc_token');
}

async function apiFetch<T>(path: string): Promise<ApiResult<T>> {
  const token = getAuthToken();
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: payload?.error || 'Erro ao carregar dados do dashboard.',
    };
  }

  return { ok: true, data: payload as T };
}

function formatTipoff(gameTime: string) {
  const date = new Date(gameTime);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatTodayLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function DashboardView() {
  const [games, setGames] = useState<Game[]>([]);
  const [playersByGame, setPlayersByGame] = useState<Record<number, Player[]>>({});
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<Stat>('PTS');
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  );

  const players = selectedGameId ? playersByGame[selectedGameId] ?? [] : [];

  const loadPlayersForGame = useCallback(
    async (game: Game) => {
      if (playersByGame[game.id]) return;
      setIsLoadingPlayers(true);
      const result = await apiFetch<{ players: Array<{ id: number; name: string; team_id: number; position: string; jersey: string | number | null }> }>(
        `/api/players?gameId=${game.id}`,
      );
      if (!result.ok) {
        setErrorMessage(result.message);
        setIsLoadingPlayers(false);
        return;
      }

      const mappedPlayers = (result.data.players || []).map((player) => ({
        id: player.id,
        name: player.name || 'Jogador',
        team_id: Number(player.team_id || 0),
        team:
          Number(player.team_id) === game.home_team_id
            ? game.home_team
            : Number(player.team_id) === game.away_team_id
              ? game.away_team
              : 'Time não informado',
        position: player.position || 'N/A',
        jersey: player.jersey || null,
      }));

      setPlayersByGame((prev) => ({ ...prev, [game.id]: mappedPlayers }));
      setIsLoadingPlayers(false);
    },
    [playersByGame],
  );

  useEffect(() => {
    let canceled = false;

    async function loadGames() {
      setIsLoadingGames(true);
      setErrorMessage(null);

      const result = await apiFetch<{ games: Game[] }>('/api/games');
      if (canceled) return;

      if (!result.ok) {
        setErrorMessage(result.message);
        setIsLoadingGames(false);
        return;
      }

      const nextGames = Array.isArray(result.data.games) ? result.data.games : [];
      setGames(nextGames);

      if (nextGames.length > 0) {
        const nextId = nextGames[0].id;
        setSelectedGameId((current) => current ?? nextId);
      }

      setIsLoadingGames(false);
    }

    loadGames();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedGame) return;
    loadPlayersForGame(selectedGame);
  }, [loadPlayersForGame, selectedGame]);

  const authTokenMissing = typeof window !== 'undefined' && !getAuthToken();

  return (
    <AppShell
      sidebar={<Sidebar items={sidebarItems} activeKey="dashboard" footer={<Badge variant="success">Beta React UI</Badge>} />}
      mobileSidebar={<MobileSidebar items={sidebarItems} activeKey="dashboard" footer={<Badge variant="success">Beta React UI</Badge>} />}
      topbar={
        <TopBar
          title="Dashboard"
          context={selectedGame ? `${selectedGame.away_team} vs ${selectedGame.home_team}` : 'Selecione um jogo'}
          actions={<Badge variant="muted">Hoje · {formatTodayLabel()}</Badge>}
        />
      }
    >
      <ContentContainer width="content">
        <div className={styles.dashboardGrid}>
          <Surface elevated className={styles.gamesColumn}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Jogos</h2>
              <Badge variant="default">{games.length}</Badge>
            </div>

            {isLoadingGames ? <p className={styles.stateText}>Carregando jogos...</p> : null}
            {!isLoadingGames && !games.length ? <p className={styles.stateText}>Sem jogos disponíveis no momento.</p> : null}

            <div className={styles.gameList}>
              {games.map((game) => {
                const isActive = game.id === selectedGameId;
                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`${styles.gameCard} ${isActive ? styles.gameCardActive : ''}`}
                    onClick={() => setSelectedGameId(game.id)}
                  >
                    <div className={styles.gameCardTop}>
                      <span>{formatTipoff(game.game_time)}</span>
                      {isActive ? <Badge variant="success">Selecionado</Badge> : null}
                    </div>
                    <p className={styles.matchup}>{game.away_team} vs {game.home_team}</p>
                  </button>
                );
              })}
            </div>
          </Surface>

          <Surface elevated className={styles.playersColumn}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Jogadores</h2>
              <Badge variant="default">{players.length}</Badge>
            </div>

            <TabsRoot value={selectedStat} onValueChange={(value) => setSelectedStat(value as Stat)}>
              <TabsList className={styles.statsTabs}>
                {STATS.map((stat) => (
                  <TabsTrigger key={stat} value={stat}>
                    {stat}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={selectedStat} className={styles.playersTabContent}>
                {selectedGame ? (
                  <p className={styles.stateText}>Mercado ativo: {selectedStat}</p>
                ) : (
                  <p className={styles.stateText}>Selecione um jogo para ver os jogadores.</p>
                )}

                {isLoadingPlayers ? <p className={styles.stateText}>Carregando jogadores...</p> : null}
                {!isLoadingPlayers && selectedGame && !players.length ? <p className={styles.stateText}>Nenhum jogador disponível para este jogo.</p> : null}

                <div className={styles.playerList}>
                  {players.map((player) => (
                    <div key={player.id} className={styles.playerRow}>
                      <div>
                        <p className={styles.playerName}>{player.name}</p>
                        <p className={styles.playerMeta}>{player.position} · {player.team}</p>
                      </div>
                      {player.jersey ? <Badge variant="muted">#{player.jersey}</Badge> : null}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </TabsRoot>
          </Surface>
        </div>

        {errorMessage ? (
          <Surface className={styles.errorBox}>
            <p>{errorMessage}</p>
            {authTokenMissing ? (
              <Button variant="secondary" size="sm" onClick={() => window.location.assign('/app.html')}>
                Abrir fluxo legado
              </Button>
            ) : null}
          </Surface>
        ) : null}
      </ContentContainer>
    </AppShell>
  );
}
