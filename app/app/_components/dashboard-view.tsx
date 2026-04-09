'use client';

import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Crown,
  LayoutDashboard,
  Lock,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  EmptyState,
  Surface,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from '@/components/ui';
import styles from './dashboard-view.module.css';

const STATS = ['PTS', 'AST', 'REB', '3PM', 'PA', 'PR', 'PRA', 'AR', 'DD', 'TD', 'STEAL', 'BLOCKS', 'SB', 'FG2A', 'FG3A'] as const;
const FREE_STATS = ['PTS', '3PM'] as const;

type Stat = (typeof STATS)[number];

type Plan = 'free' | 'pro';

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

type PlayerMetrics = {
  player_id: number;
  stat: Stat;
  avg_l5?: number | null;
  avg_l10?: number | null;
  avg_l20?: number | null;
  avg_l30?: number | null;
  avg_home?: number | null;
  avg_away?: number | null;
  hit_rate_l10?: number | null;
  line?: number | null;
};

type PlayerGameSample = {
  date: string | null;
  value: number | null;
  minutes: number | null;
};

type ChartBarTone = 'hit' | 'miss' | 'tie';

type PlayerDetailChartBar = {
  date: string | null;
  value: number;
  minutes: number;
  tone: ChartBarTone;
  heightPct: number;
  label: string;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

type ResourceStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

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

function resolveInitialStat(value: string | null): Stat {
  return STATS.includes(value as Stat) ? (value as Stat) : 'PTS';
}

function isLockedStat(stat: Stat, plan: Plan) {
  return plan !== 'pro' && !FREE_STATS.includes(stat as (typeof FREE_STATS)[number]);
}

export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialGameId = useMemo(() => {
    const value = searchParams.get('g');
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const [games, setGames] = useState<Game[]>([]);
  const [playersByGame, setPlayersByGame] = useState<Record<number, Player[]>>({});
  const [playersStatusByGame, setPlayersStatusByGame] = useState<Record<number, ResourceStatus>>({});
  const [playersErrorByGame, setPlayersErrorByGame] = useState<Record<number, string | null>>({});
  const [selectedGameId, setSelectedGameId] = useState<number | null>(initialGameId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(() => {
    const value = searchParams.get('p');
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [selectedStat, setSelectedStat] = useState<Stat>(() => resolveInitialStat(searchParams.get('s')));
  const [gamesStatus, setGamesStatus] = useState<ResourceStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metricsByPlayer, setMetricsByPlayer] = useState<Record<number, Partial<Record<Stat, { metrics: PlayerMetrics | null; games: PlayerGameSample[] }>>>>({});
  const [metricsStatusByPlayer, setMetricsStatusByPlayer] = useState<Record<number, Partial<Record<Stat, ResourceStatus>>>>({});
  const [metricsErrorByPlayer, setMetricsErrorByPlayer] = useState<Record<number, Partial<Record<Stat, string | null>>>>({});
  const [plan, setPlan] = useState<Plan>('free');
  const [planLoaded, setPlanLoaded] = useState(false);

  const gamesRequestRef = useRef(0);
  const playersRequestRef = useRef<Record<number, number>>({});
  const metricsRequestRef = useRef<Record<string, number>>({});

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  );

  const players = useMemo(
    () => (selectedGameId ? playersByGame[selectedGameId] ?? [] : []),
    [playersByGame, selectedGameId],
  );
  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const selectedGamePlayersStatus = selectedGameId ? playersStatusByGame[selectedGameId] ?? 'idle' : 'idle';
  const selectedGamePlayersError = selectedGameId ? playersErrorByGame[selectedGameId] ?? null : null;
  const selectedMetricsResource = selectedPlayerId ? metricsByPlayer[selectedPlayerId]?.[selectedStat] : null;
  const selectedMetricsStatus = selectedPlayerId ? metricsStatusByPlayer[selectedPlayerId]?.[selectedStat] ?? 'idle' : 'idle';
  const selectedMetricsError = selectedPlayerId ? metricsErrorByPlayer[selectedPlayerId]?.[selectedStat] ?? null : null;
  const marketLocked = isLockedStat(selectedStat, plan);
  const checkoutNotice = useMemo(() => {
    const checkoutStatus = (searchParams.get('status') || '').toLowerCase();
    if (checkoutStatus === 'success') return 'Pagamento confirmado! Seu plano Pro será liberado em instantes.';
    if (checkoutStatus === 'pending') return 'Pagamento pendente. Assim que for confirmado, seu acesso será atualizado.';
    if (checkoutStatus === 'failure') return 'Pagamento não concluído. Você pode tentar novamente quando quiser.';
    return null;
  }, [searchParams]);
  const oauthQueryError = useMemo(() => {
    const error = searchParams.get('error_description') || searchParams.get('error');
    return error ? 'Não foi possível concluir o login com Google. Tente novamente.' : null;
  }, [searchParams]);

  const syncQueryString = useCallback(
    (nextState: { gameId: number | null; stat: Stat; playerId: number | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      ['status', 'oauth', 'access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'code', 'error', 'error_description', 'type'].forEach((key) => {
        params.delete(key);
      });

      if (nextState.gameId) params.set('g', String(nextState.gameId));
      else params.delete('g');

      params.set('s', nextState.stat);

      if (nextState.playerId) params.set('p', String(nextState.playerId));
      else params.delete('p');

      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadPlayersForGame = useCallback(
    async (game: Game, options?: { force?: boolean }) => {
      const existingStatus = playersStatusByGame[game.id];
      if (!options?.force && (existingStatus === 'ready' || existingStatus === 'loading')) return;

      const requestId = (playersRequestRef.current[game.id] ?? 0) + 1;
      playersRequestRef.current[game.id] = requestId;

      setPlayersStatusByGame((prev) => ({ ...prev, [game.id]: 'loading' }));
      setPlayersErrorByGame((prev) => ({ ...prev, [game.id]: null }));

      const result = await apiFetch<{ players: Array<{ id: number; name: string; team_id: number; position: string; jersey: string | number | null }> }>(
        `/api/players?gameId=${game.id}`,
      );

      if (playersRequestRef.current[game.id] !== requestId) return;

      if (!result.ok) {
        setPlayersStatusByGame((prev) => ({ ...prev, [game.id]: 'error' }));
        setPlayersErrorByGame((prev) => ({ ...prev, [game.id]: result.message }));
        setErrorMessage(result.message);
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
      setPlayersStatusByGame((prev) => ({ ...prev, [game.id]: mappedPlayers.length ? 'ready' : 'empty' }));
    },
    [playersStatusByGame],
  );

  const loadMetricsForPlayer = useCallback(
    async (playerId: number, stat: Stat, options?: { force?: boolean }) => {
      const existingStatus = metricsStatusByPlayer[playerId]?.[stat];
      if (!options?.force && (existingStatus === 'ready' || existingStatus === 'loading')) return;

      const key = `${playerId}:${stat}`;
      const requestId = (metricsRequestRef.current[key] ?? 0) + 1;
      metricsRequestRef.current[key] = requestId;

      setMetricsStatusByPlayer((prev) => ({
        ...prev,
        [playerId]: { ...(prev[playerId] ?? {}), [stat]: 'loading' },
      }));
      setMetricsErrorByPlayer((prev) => ({
        ...prev,
        [playerId]: { ...(prev[playerId] ?? {}), [stat]: null },
      }));

      const result = await apiFetch<{ metrics: PlayerMetrics | null; games: PlayerGameSample[] }>(`/api/metrics?playerId=${playerId}&stat=${stat}`);

      if (metricsRequestRef.current[key] !== requestId) return;

      if (!result.ok) {
        setMetricsStatusByPlayer((prev) => ({
          ...prev,
          [playerId]: { ...(prev[playerId] ?? {}), [stat]: 'error' },
        }));
        setMetricsErrorByPlayer((prev) => ({
          ...prev,
          [playerId]: { ...(prev[playerId] ?? {}), [stat]: result.message },
        }));
        return;
      }

      const payload = {
        metrics: result.data.metrics ?? null,
        games: Array.isArray(result.data.games) ? result.data.games : [],
      };

      setMetricsByPlayer((prev) => ({
        ...prev,
        [playerId]: { ...(prev[playerId] ?? {}), [stat]: payload },
      }));
      setMetricsStatusByPlayer((prev) => ({
        ...prev,
        [playerId]: { ...(prev[playerId] ?? {}), [stat]: payload.games.length || payload.metrics ? 'ready' : 'empty' },
      }));
    },
    [metricsStatusByPlayer],
  );

  const loadGames = useCallback(async () => {
    gamesRequestRef.current += 1;
    const requestId = gamesRequestRef.current;

    setGamesStatus('loading');
    setErrorMessage(null);

    const result = await apiFetch<{ games: Game[] }>('/api/games');
    if (gamesRequestRef.current !== requestId) return;

    if (!result.ok) {
      setGamesStatus('error');
      setErrorMessage(result.message);
      return;
    }

    const nextGames = Array.isArray(result.data.games) ? result.data.games : [];
    setGames(nextGames);

    if (!nextGames.length) {
      setSelectedGameId(null);
      setSelectedPlayerId(null);
      setGamesStatus('empty');
      return;
    }

    setSelectedGameId((current) => {
      if (current && nextGames.some((game) => game.id === current)) return current;
      if (initialGameId && nextGames.some((game) => game.id === initialGameId)) return initialGameId;
      return nextGames[0].id;
    });

    setGamesStatus('ready');
  }, [initialGameId]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authMarkers = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'code', 'error', 'error_description', 'type'];
    const accessToken = hashParams.get('access_token') || queryParams.get('access_token');

    if (accessToken) {
      window.localStorage.setItem('lc_token', accessToken);
    }

    const shouldCleanHash = authMarkers.some((key) => hashParams.has(key));
    const shouldCleanQuery = ['status', 'oauth', ...authMarkers].some((key) => queryParams.has(key));
    if (shouldCleanHash || shouldCleanQuery) {
      const cleanParams = new URLSearchParams(queryParams.toString());
      ['status', 'oauth', ...authMarkers].forEach((key) => cleanParams.delete(key));
      const nextQuery = cleanParams.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGames();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadGames]);

  useEffect(() => {
    let canceled = false;

    async function loadPlan() {
      const token = getAuthToken();
      if (!token) {
        if (!canceled) {
          setPlan('free');
          setPlanLoaded(true);
        }
        return;
      }

      const result = await apiFetch<{ profile?: { plan?: Plan } }>('/api/profile');
      if (canceled) return;

      if (result.ok) {
        const resolvedPlan = result.data.profile?.plan === 'pro' ? 'pro' : 'free';
        setPlan(resolvedPlan);
      }

      setPlanLoaded(true);
    }

    loadPlan();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedGame) return;
    const timer = window.setTimeout(() => {
      void loadPlayersForGame(selectedGame);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlayersForGame, selectedGame]);

  useEffect(() => {
    if (!selectedPlayerId || marketLocked) return;
    const timer = window.setTimeout(() => {
      void loadMetricsForPlayer(selectedPlayerId, selectedStat);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMetricsForPlayer, marketLocked, selectedPlayerId, selectedStat]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    const availableStats = plan === 'pro' ? STATS : FREE_STATS;
    if (typeof window === 'undefined') return;
    const schedule = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 120));
    const handle = schedule(() => {
      availableStats.forEach((stat) => {
        if (stat === selectedStat) return;
        void loadMetricsForPlayer(selectedPlayerId, stat);
      });
    });
    return () => {
      if ('cancelIdleCallback' in window && typeof window.cancelIdleCallback === 'function' && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle as number);
      }
    };
  }, [loadMetricsForPlayer, plan, selectedPlayerId, selectedStat]);

  useEffect(() => {
    syncQueryString({ gameId: selectedGameId, stat: selectedStat, playerId: selectedPlayer ? selectedPlayerId : null });
  }, [selectedGameId, selectedPlayer, selectedPlayerId, selectedStat, syncQueryString]);

  const authTokenMissing = typeof window !== 'undefined' && !getAuthToken();

  const handleStatChange = useCallback((value: string) => {
    const nextStat = resolveInitialStat(value);
    if (isLockedStat(nextStat, plan)) return;
    setSelectedStat(nextStat);
  }, [plan]);

  const handleSelectGame = useCallback((gameId: number) => {
    setSelectedGameId(gameId);
    setSelectedPlayerId(null);
  }, []);

  const getChartBarClassName = useCallback((tone: ChartBarTone) => {
    if (tone === 'hit') return `${styles.chartBar} ${styles.chartBarHit}`;
    if (tone === 'tie') return `${styles.chartBar} ${styles.chartBarTie}`;
    return `${styles.chartBar} ${styles.chartBarMiss}`;
  }, []);

  const playerDetailModel = useMemo(() => {
    if (!selectedPlayer) return null;
    const payload = selectedMetricsResource;
    const games = (payload?.games ?? []).map((sample) => ({
      date: sample.date,
      value: Number(sample.value ?? 0),
      minutes: Number(sample.minutes ?? 0),
    }));
    const values = games.map((sample) => sample.value);
    const lineBase = Number(payload?.metrics?.line ?? payload?.metrics?.avg_l10 ?? 0);
    const line = Number.isFinite(lineBase) && lineBase > 0 ? Math.round(lineBase * 2) / 2 : 0.5;
    const average = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1)) : null;
    const chartBase = Math.max(line, ...values, 1);
    const bars: PlayerDetailChartBar[] = games.slice(0, 12).reverse().map((sample) => {
      const pct = Math.max(8, Math.round((sample.value / chartBase) * 100));
      const tone: ChartBarTone = sample.value > line ? 'hit' : sample.value === line ? 'tie' : 'miss';
      const date = sample.date ? new Date(sample.date) : null;
      const label = date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` : '—';
      return { ...sample, tone, heightPct: pct, label };
    });
    const linePct = Math.min(96, Math.max(4, (line / chartBase) * 100));
    const windows = [5, 10, 20, 30].map((size) => {
      const window = games.slice(0, size);
      if (!window.length) return { label: `L${size}`, value: '—', note: 'Sem dados' };
      const hits = window.filter((sample) => sample.value >= line).length;
      const pct = Math.round((hits / window.length) * 100);
      return { label: `L${size}`, value: `${pct}%`, note: `${hits}/${window.length}` };
    });
    const edge = average === null ? null : Number((average - line).toFixed(1));
    const edgeLabel = edge === null ? 'N/D' : edge >= 0 ? 'Over lean' : 'Under lean';
    return { games, line, average, bars, linePct, windows, edge, edgeLabel, metrics: payload?.metrics ?? null };
  }, [selectedMetricsResource, selectedPlayer]);

  return (
    <AppShell
      sidebar={<Sidebar items={sidebarItems} activeKey="dashboard" footer={<Badge variant="success">Beta React UI</Badge>} />}
      mobileSidebar={<MobileSidebar items={sidebarItems} activeKey="dashboard" footer={<Badge variant="success">Beta React UI</Badge>} />}
      topbar={
        <TopBar
          title="Dashboard"
          context={selectedGame ? `${selectedGame.away_team} vs ${selectedGame.home_team}` : 'Selecione um jogo'}
          actions={
            <div className={styles.topbarBadges}>
              <Badge variant="muted">Hoje · {formatTodayLabel()}</Badge>
              {planLoaded ? (
                <Badge variant={plan === 'pro' ? 'success' : 'default'}>
                  {plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito'}
                </Badge>
              ) : null}
            </div>
          }
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

            {gamesStatus === 'loading' ? (
              <Surface className={styles.statePanelInline}><p className={styles.stateText}>Carregando jogos...</p></Surface>
            ) : null}
            {gamesStatus === 'error' ? (
              <EmptyState
                heading="Não foi possível carregar os jogos"
                description={errorMessage || 'Tente novamente em instantes.'}
                action={<Button variant="secondary" size="sm" onClick={loadGames}>Tentar novamente</Button>}
              />
            ) : null}
            {gamesStatus === 'empty' ? (
              <EmptyState
                heading="Sem jogos disponíveis"
                description="Estamos aguardando a próxima atualização automática."
              />
            ) : null}

            <div className={styles.gameList}>
              {games.map((game) => {
                const isActive = game.id === selectedGameId;
                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`${styles.gameCard} ${isActive ? styles.gameCardActive : ''}`}
                    onClick={() => handleSelectGame(game.id)}
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
              <div className={styles.playersHeaderBadges}>
                <Badge variant="default">{players.length}</Badge>
                {plan === 'pro' ? (
                  <Badge variant="success"><Crown size={12} /> Pro liberado</Badge>
                ) : (
                  <Badge variant="muted">Gratuito · Mercado completo no Pro</Badge>
                )}
              </div>
            </div>

            <TabsRoot value={selectedStat} onValueChange={handleStatChange}>
              <TabsList className={styles.statsTabs}>
                {STATS.map((stat) => {
                  const locked = isLockedStat(stat, plan);
                  return (
                    <TabsTrigger
                      key={stat}
                      value={stat}
                      className={locked ? styles.lockedTab : undefined}
                      title={locked ? 'Disponível no plano Pro' : undefined}
                    >
                      {stat}
                      {locked ? <Lock size={11} /> : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={selectedStat} className={styles.playersTabContent}>
                {selectedGame ? (
                  <Surface className={styles.statePanelInline}><p className={styles.stateText}>Mercado ativo: {selectedStat}</p></Surface>
                ) : (
                  <Surface className={styles.statePanelInline}><p className={styles.stateText}>Selecione um jogo para ver os jogadores.</p></Surface>
                )}

                {marketLocked ? (
                  <Surface className={styles.lockedStateBox}>
                    <div className={styles.lockedTitle}><Lock size={14} /> Este mercado está no plano Pro</div>
                    <p className={styles.stateText}>No fluxo React, mercados gratuitos: {FREE_STATS.join(' · ')}.</p>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedStat('PTS')}>Voltar para PTS</Button>
                  </Surface>
                ) : null}

                {selectedGamePlayersStatus === 'loading' ? (
                  <Surface className={styles.statePanelInline}><p className={styles.stateText}>Carregando jogadores...</p></Surface>
                ) : null}
                {selectedGamePlayersStatus === 'error' ? (
                  <EmptyState
                    heading="Falha ao carregar jogadores"
                    description={selectedGamePlayersError || 'Tente novamente.'}
                    action={selectedGame ? (
                      <Button size="sm" variant="secondary" onClick={() => loadPlayersForGame(selectedGame, { force: true })}>
                        <RefreshCw size={14} /> Recarregar
                      </Button>
                    ) : null}
                  />
                ) : null}
                {selectedGamePlayersStatus === 'empty' ? (
                  <Surface className={styles.statePanelInline}><p className={styles.stateText}>Nenhum jogador disponível para este jogo.</p></Surface>
                ) : null}

                {!marketLocked ? (
                  <div className={styles.playerList}>
                    {players.map((player) => (
                      <div key={player.id} className={styles.playerRow}>
                        <div>
                          <p className={styles.playerName}>{player.name}</p>
                          <p className={styles.playerMeta}>{player.position} · {player.team}</p>
                        </div>

                        <div className={styles.playerActions}>
                          {player.jersey ? <Badge variant="muted">#{player.jersey}</Badge> : null}
                          <Button size="sm" variant="secondary" onClick={() => setSelectedPlayerId(player.id)}>
                            Ver detalhe
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedPlayer ? (
                  <Surface className={styles.playerDetailPanel}>
                    <div className={styles.playerDetailHeader}>
                      <div>
                        <p className={styles.playerDetailTitle}>{selectedPlayer.name}</p>
                        <p className={styles.playerMeta}>{selectedPlayer.position} · {selectedPlayer.team}</p>
                      </div>
                      <div className={styles.playerDetailActions}>
                        <Badge variant="default">{selectedStat}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedPlayerId(null)}>Voltar</Button>
                      </div>
                    </div>

                    {selectedMetricsStatus === 'loading' ? (
                      <Surface className={styles.statePanelInline}><p className={styles.stateText}>Carregando métricas e histórico...</p></Surface>
                    ) : null}
                    {selectedMetricsStatus === 'error' ? (
                      <EmptyState
                        heading="Não foi possível carregar o detalhe do jogador"
                        description={selectedMetricsError || 'Tente novamente em instantes.'}
                        action={selectedPlayerId ? (
                          <Button size="sm" variant="secondary" onClick={() => loadMetricsForPlayer(selectedPlayerId, selectedStat, { force: true })}>
                            <RefreshCw size={14} /> Recarregar
                          </Button>
                        ) : null}
                      />
                    ) : null}
                    {selectedMetricsStatus === 'empty' ? (
                      <Surface className={styles.statePanelInline}><p className={styles.stateText}>Sem histórico suficiente para este mercado.</p></Surface>
                    ) : null}

                    {playerDetailModel && selectedMetricsStatus === 'ready' ? (
                      <>
                        <div className={styles.summaryStrip}>
                          {playerDetailModel.windows.map((window) => (
                            <div key={window.label} className={styles.summaryCard}>
                              <span>{window.label}</span>
                              <strong>{window.value}</strong>
                              <small>{window.note}</small>
                            </div>
                          ))}
                        </div>

                        <div className={styles.chartCard}>
                          <div className={styles.chartHeader}>
                            <p className={styles.chartTitle}>{selectedStat} · Últimos jogos</p>
                            <div className={styles.chartHeaderBadges}>
                              <Badge variant="muted">Linha {playerDetailModel.line}</Badge>
                              <Badge variant="muted">Média {playerDetailModel.average ?? '—'}</Badge>
                              <Badge variant={playerDetailModel.edge !== null && playerDetailModel.edge >= 0 ? 'success' : 'default'}>
                                {playerDetailModel.edgeLabel}
                              </Badge>
                            </div>
                          </div>
                          <div className={styles.chartCanvas}>
                            <div className={styles.chartReference} style={{ bottom: `${playerDetailModel.linePct}%` }}>
                              <span>Linha {playerDetailModel.line}</span>
                            </div>
                            {playerDetailModel.bars.length ? playerDetailModel.bars.map((bar, index) => (
                              <div key={`${bar.label}-${index}`} className={styles.chartColumn}>
                                <div className={getChartBarClassName(bar.tone)} style={{ height: `${bar.heightPct}%` }}>
                                  <span>{bar.value}</span>
                                </div>
                                <small>{bar.label}</small>
                              </div>
                            )) : (
                              <p className={styles.stateText}>Dados recentes indisponíveis para o gráfico.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </Surface>
                ) : null}
              </TabsContent>
            </TabsRoot>
          </Surface>
        </div>

        {(errorMessage || oauthQueryError) ? (
          <Surface className={`${styles.errorBox} ${styles.infoBanner}`}>
            <div className={styles.errorContent}>
              <AlertCircle size={16} />
              <p>{errorMessage || oauthQueryError}</p>
            </div>
            {authTokenMissing ? (
              <Button variant="secondary" size="sm" onClick={() => window.location.assign('/login')}>
                Ir para login
              </Button>
            ) : null}
          </Surface>
        ) : null}
        {checkoutNotice ? (
          <Surface className={`${styles.errorBox} ${styles.infoBanner}`}>
            <div className={styles.errorContent}>
              <Crown size={16} />
              <p>{checkoutNotice}</p>
            </div>
          </Surface>
        ) : null}
      </ContentContainer>
    </AppShell>
  );
}
