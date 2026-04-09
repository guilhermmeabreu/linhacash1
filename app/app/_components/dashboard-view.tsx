'use client';

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Crown,
  X,
  LayoutDashboard,
  Lock,
  LogOut,
  Minus,
  Plus,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AppShell,
  ContentContainer,
  MobileSidebar,
  Sidebar,
  ThemeToggle,
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
type DashboardViewMode = 'games' | 'players' | 'detail' | 'profile';
type Theme = 'dark' | 'light';

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

type ProfileData = {
  id: string;
  name: string | null;
  email: string | null;
  plan: Plan;
  theme?: Theme | null;
  created_at?: string | null;
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
  { key: 'calendario', label: 'Calendário', href: '/app', icon: CalendarDays, disabled: true, secondary: true },
  { key: 'stats', label: 'Classificação', href: '/app', icon: BarChart3, disabled: true, secondary: true },
  { key: 'perfil', label: 'Meu perfil', href: '/app?view=profile', icon: UserRound },
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

function shortTeamName(name: string) {
  return name
    .split(' ')
    .slice(-1)[0]
    ?.slice(0, 3)
    .toUpperCase();
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

  const [view, setView] = useState<DashboardViewMode>(() => {
    if (searchParams.get('view') === 'profile') return 'profile';
    const playerIdFromQuery = Number(searchParams.get('p'));
    if (Number.isFinite(playerIdFromQuery) && playerIdFromQuery > 0) return 'detail';
    const gameIdFromQuery = Number(searchParams.get('g'));
    if (Number.isFinite(gameIdFromQuery) && gameIdFromQuery > 0) return 'players';
    return 'games';
  });
  const [lineAdjustment, setLineAdjustment] = useState(0);

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
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<'mensal' | 'anual'>('anual');
  const [upgradeCode, setUpgradeCode] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

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

  useEffect(() => {
    if (searchParams.get('open') === 'checkout' && plan !== 'pro') {
      setUpgradeOpen(true);
    }
  }, [plan, searchParams]);

  const oauthQueryError = useMemo(() => {
    const error = searchParams.get('error_description') || searchParams.get('error');
    return error ? 'Não foi possível concluir o login com Google. Tente novamente.' : null;
  }, [searchParams]);

  const syncQueryString = useCallback(
    (nextState: { gameId: number | null; stat: Stat; playerId: number | null; mode: DashboardViewMode }) => {
      const params = new URLSearchParams(searchParams.toString());
      ['status', 'oauth', 'access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'code', 'error', 'error_description', 'type'].forEach((key) => {
        params.delete(key);
      });

      if (nextState.gameId) params.set('g', String(nextState.gameId));
      else params.delete('g');

      params.set('s', nextState.stat);

      if (nextState.playerId) params.set('p', String(nextState.playerId));
      else params.delete('p');

      if (nextState.mode === 'profile') params.set('view', 'profile');
      else params.delete('view');

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
          setProfile(null);
        }
        return;
      }

      const result = await apiFetch<{ profile?: ProfileData }>('/api/profile');
      if (canceled) return;

      if (result.ok) {
        const resolvedPlan = result.data.profile?.plan === 'pro' ? 'pro' : 'free';
        setPlan(resolvedPlan);
        setProfile(result.data.profile ?? null);
      }

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
    syncQueryString({ gameId: selectedGameId, stat: selectedStat, playerId: selectedPlayer ? selectedPlayerId : null, mode: view });
  }, [selectedGameId, selectedPlayer, selectedPlayerId, selectedStat, syncQueryString, view]);

  const authTokenMissing = typeof window !== 'undefined' && !getAuthToken();

  const handleStatChange = useCallback((value: string) => {
    const nextStat = resolveInitialStat(value);
    if (isLockedStat(nextStat, plan)) {
      setUpgradeOpen(true);
      return;
    }
    setSelectedStat(nextStat);
  }, [plan]);

  const openUpgradeSurface = useCallback(() => {
    setUpgradeError(null);
    setUpgradeOpen(true);
  }, []);

  const startCheckout = useCallback(async () => {
    setUpgradeLoading(true);
    setUpgradeError(null);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: upgradePlan, referralCode: upgradeCode.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        setUpgradeError(data?.error || 'Não foi possível iniciar o checkout agora.');
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setUpgradeError('Falha ao iniciar checkout. Tente novamente em instantes.');
    } finally {
      setUpgradeLoading(false);
    }
  }, [upgradeCode, upgradePlan]);

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
    const apiLine = Number.isFinite(lineBase) && lineBase > 0 ? Math.round(lineBase * 2) / 2 : 0.5;
    const line = Math.max(0, apiLine + lineAdjustment);
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
  }, [lineAdjustment, selectedMetricsResource, selectedPlayer]);

  const topTitle = useMemo(() => {
    if (view === 'profile') return 'Meu Perfil';
    if (view === 'detail') return selectedPlayer?.name || 'Detalhe';
    if (view === 'players') return selectedGame ? `${selectedGame.away_team} vs ${selectedGame.home_team}` : 'Jogadores';
    return 'Jogos de Hoje';
  }, [selectedGame, selectedPlayer, view]);

  const canGoBack = view === 'players' || view === 'detail';
  const activeSidebarKey = view === 'profile' ? 'perfil' : 'dashboard';
  const profileSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <AppShell
      sidebar={(
        <Sidebar
          items={sidebarItems}
          activeKey={activeSidebarKey}
          onItemClick={(item) => setView(item.key === 'perfil' ? 'profile' : 'games')}
          footer={(
            <div className={styles.accountSummary}>
              <div className={styles.accountAvatar}>{(profile?.name || 'G').slice(0, 1).toUpperCase()}</div>
              <div className={styles.accountMeta}>
                <strong>{profile?.name || 'Guilherme'}</strong>
                <span>{plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito'}</span>
              </div>
            </div>
          )}
        />
      )}
      mobileSidebar={(
        <MobileSidebar
          items={sidebarItems}
          activeKey={activeSidebarKey}
          onItemClick={(item) => setView(item.key === 'perfil' ? 'profile' : 'games')}
          footer={(
            <div className={styles.accountSummary}>
              <div className={styles.accountAvatar}>{(profile?.name || 'G').slice(0, 1).toUpperCase()}</div>
              <div className={styles.accountMeta}>
                <strong>{profile?.name || 'Guilherme'}</strong>
                <span>{plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito'}</span>
              </div>
            </div>
          )}
        />
      )}
      topbar={
        <TopBar
          showBrand={false}
          context={view === 'games' ? `Hoje · ${formatTodayLabel()}` : topTitle}
          actions={
            <div className={styles.topbarBadges}>
              <ThemeToggle compact />
              {canGoBack ? (
                <Button size="sm" variant="ghost" onClick={() => setView(view === 'detail' ? 'players' : 'games')}>
                  <ArrowLeft size={14} />
                </Button>
              ) : null}
            </div>
          }
        />
      }
    >
      <ContentContainer width="content">
        <div className={styles.dashboardCanvas}>
          {view === 'games' ? (
            <section className={styles.gamesView}>
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

              <div className={`${styles.gameGrid} technical-grid`}>
                {games.map((game, index) => {
                  const locked = plan !== 'pro' && index > 0;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      className={`${styles.gameCard} technical-item ${locked ? styles.gameCardLocked : ''}`}
                      aria-label={`${game.away_team} versus ${game.home_team}`}
                      onClick={() => {
                        if (locked) {
                          openUpgradeSurface();
                          return;
                        }
                        setSelectedGameId(game.id);
                        setSelectedPlayerId(null);
                        setView('players');
                      }}
                    >
                      {locked ? (
                        <div className={styles.gameLockBadge}>
                          <Lock size={12} />
                        </div>
                      ) : null}
                      <div className={styles.gameCardTime}>{formatTipoff(game.game_time)}</div>
                      <div className={styles.gameCardTeams}>
                        <div className={styles.teamBadge}>
                          {game.away_logo ? <img src={game.away_logo} alt={game.away_team} loading="lazy" /> : shortTeamName(game.away_team)}
                        </div>
                        <div className={styles.gameVs}>X</div>
                        <div className={styles.teamBadge}>
                          {game.home_logo ? <img src={game.home_logo} alt={game.home_team} loading="lazy" /> : shortTeamName(game.home_team)}
                        </div>
                      </div>
                      <div className={styles.gameMatchup}>
                        <span>{game.away_team}</span>
                        <span>{game.home_team}</span>
                      </div>
                      <div className={styles.gameCardDivider} />
                      <div className={`${styles.gameCtaButton} ${locked ? styles.gameCtaLocked : ''}`}>
                        {locked ? 'DESBLOQUEAR NO PRO' : 'VER JOGADORES'}
                        {!locked ? <ChevronRight size={14} /> : <Lock size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view === 'players' ? (
            <section className={styles.playersView}>
              <div className={styles.playersTopbar}>
                <h2>Jogadores</h2>
              </div>

              <div className={styles.statsTabsWrap}>
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
                    {marketLocked ? (
                      <Surface className={styles.lockedStateBox}>
                        <div className={styles.lockedTitle}><Lock size={14} /> Este mercado está no plano Pro</div>
                        <p className={styles.stateText}>No fluxo gratuito, mercados ativos: {FREE_STATS.join(' · ')}.</p>
                        <div className={styles.lockedActions}>
                          <Button size="sm" variant="secondary" onClick={() => setSelectedStat('PTS')}>Voltar para PTS</Button>
                          <Button size="sm" onClick={openUpgradeSurface}>Ver planos Pro</Button>
                        </div>
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

                    {!marketLocked ? (
                      <div className={`${styles.playerList} technical-grid`}>
                        {players.map((player) => {
                          const line = metricsByPlayer[player.id]?.[selectedStat]?.metrics?.line;
                          return (
                            <button
                              key={player.id}
                              className={`${styles.playerRow} technical-item`}
                              type="button"
                              onClick={() => {
                                setSelectedPlayerId(player.id);
                                setLineAdjustment(0);
                                setView('detail');
                              }}
                            >
                              <div className={styles.playerMain}>
                                <div className={styles.avatar}>{player.name.slice(0, 1).toUpperCase()}</div>
                                <div>
                                  <p className={styles.playerName}>{player.name}</p>
                                  <p className={styles.playerMeta}>{player.position} • {player.team}</p>
                                </div>
                              </div>
                              <div className={styles.playerLineBlock}>
                                <small>Line</small>
                                <strong>{line ? Number(line).toFixed(1) : '—'}</strong>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </TabsContent>
                </TabsRoot>
              </div>
            </section>
          ) : null}

          {view === 'detail' && selectedPlayer ? (
            <section className={styles.detailView}>
              <div className={styles.detailTabsRow}>
                <TabsRoot value={selectedStat} onValueChange={handleStatChange}>
                  <TabsList className={styles.statsTabs}>
                    {STATS.map((stat) => {
                      const locked = isLockedStat(stat, plan);
                      return (
                        <TabsTrigger key={stat} value={stat} className={locked ? styles.lockedTab : undefined}>
                          {stat}
                          {locked ? <Lock size={11} /> : null}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </TabsRoot>
              </div>

              <div className={styles.playerHero}>
                <div>
                  <p className={styles.playerHeroMeta}>{selectedPlayer.team} • {selectedPlayer.position}</p>
                  <h2 className={styles.playerHeroName}>{selectedPlayer.name}</h2>
                </div>
                <div className={styles.lineAdjustBox}>
                  <p>Ajustar linha</p>
                  <div>
                    <button type="button" onClick={() => setLineAdjustment((value) => Number((value - 0.5).toFixed(1)))}><Minus size={16} /></button>
                    <strong>{playerDetailModel?.line.toFixed(1) ?? '0.0'}</strong>
                    <button type="button" onClick={() => setLineAdjustment((value) => Number((value + 0.5).toFixed(1)))}><Plus size={16} /></button>
                  </div>
                </div>
                <div className={styles.oddsBox}>
                  <div>
                    <span>OVER</span>
                    <strong>{playerDetailModel && playerDetailModel.edge !== null ? `${playerDetailModel.edge > 0 ? '+' : ''}${playerDetailModel.edge}` : 'N/D'}</strong>
                  </div>
                  <div>
                    <span>HIT L10</span>
                    <strong>{playerDetailModel?.windows[1]?.value ?? '—'}</strong>
                  </div>
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
                  <div className={styles.quickStatsGrid}>
                    {playerDetailModel.windows.map((window) => (
                      <div key={window.label}>
                        <span>{window.label}</span>
                        <strong>{window.value}</strong>
                        <small>{window.note}</small>
                      </div>
                    ))}
                    <div>
                      <span>Média</span>
                      <strong>{playerDetailModel.average ?? '—'}</strong>
                      <small>{selectedStat}</small>
                    </div>
                    <div>
                      <span>Edge</span>
                      <strong>{playerDetailModel.edge !== null ? `${playerDetailModel.edge > 0 ? '+' : ''}${playerDetailModel.edge}` : '—'}</strong>
                      <small>{playerDetailModel.edgeLabel}</small>
                    </div>
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <p className={styles.chartTitle}>{selectedStat} · últimos jogos</p>
                      <div className={styles.chartHeaderBadges}>
                        <Badge variant="muted">Linha {playerDetailModel.line}</Badge>
                        <Badge variant="muted">Média {playerDetailModel.average ?? '—'}</Badge>
                      </div>
                    </div>
                    <div className={styles.chartCanvas}>
                      <div className={styles.chartReference} style={{ bottom: `${playerDetailModel.linePct}%` }}>
                        <span>LINE {playerDetailModel.line}</span>
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
            </section>
          ) : null}

          {view === 'profile' ? (
            <section className={styles.profileView}>
              <Surface className={styles.profileHero}>
                <div className={styles.profileHeaderAvatar}>{(profile?.name || 'G').slice(0, 1).toUpperCase()}</div>
                <div className={styles.profileHeaderMeta}>
                  <h2>{profile?.name || 'Guilherme'}</h2>
                  <p>{profile?.email || 'email@linhacash.com.br'}</p>
                </div>
                <Badge variant={plan === 'pro' ? 'success' : 'default'}>{plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito'}</Badge>
              </Surface>

              <div className={styles.profileStack}>
                <Surface className={styles.profileSection}>
                  <div className={styles.profileSectionHeader}>
                    <h3>Planos</h3>
                    {plan !== 'pro' ? <Button size="sm" onClick={openUpgradeSurface}>Fazer upgrade</Button> : null}
                  </div>
                  <div className={styles.profileRows}>
                    <div className={`${styles.profileRow} ${plan === 'free' ? styles.profileRowActive : ''}`}>
                      <span>Free</span>
                      <small>{plan === 'free' ? 'Plano ativo' : 'Disponível'}</small>
                    </div>
                    <div className={`${styles.profileRow} ${plan === 'pro' ? styles.profileRowActive : ''}`}>
                      <span>Pro</span>
                      <small>{plan === 'pro' ? 'Plano ativo' : 'Inclui mercados avançados'}</small>
                    </div>
                  </div>
                </Surface>

                <Surface className={styles.profileSection}>
                  <h3>Conta</h3>
                  <div className={styles.profileRows}>
                    <button type="button" className={styles.profileRow}><span>Editar perfil</span><small>{profileSince ? `Membro desde ${profileSince}` : 'Dados da conta'}</small></button>
                    <button type="button" className={styles.profileRow}><span>Segurança</span><small>Senha e recuperação</small></button>
                    <div className={styles.profileRow}>
                      <span>Tema</span>
                      <div className={styles.profileRowControl}><ThemeToggle compact /></div>
                    </div>
                  </div>
                </Surface>

                <Surface className={styles.profileSection}>
                  <h3>Suporte</h3>
                  <div className={styles.profileRows}>
                    <a className={styles.profileRow} href="mailto:suporte@linhacash.com.br?subject=FAQ%20LinhaCash"><span>Perguntas frequentes</span><small>Respostas rápidas</small></a>
                    <a className={styles.profileRow} href="mailto:suporte@linhacash.com.br"><span>Falar com suporte</span><small>suporte@linhacash.com.br</small></a>
                    <a className={styles.profileRow} href="mailto:suporte@linhacash.com.br?subject=Relatar%20problema"><span>Reportar um problema</span><small>Enviar detalhes do erro</small></a>
                    <Link className={styles.profileRow} href="/termos"><span>Termos de uso</span><small>Condições da plataforma</small></Link>
                    <Link className={styles.profileRow} href="/privacidade"><span>Política de privacidade</span><small>Tratamento de dados</small></Link>
                    <a className={styles.profileRow} href="mailto:suporte@linhacash.com.br?subject=Excluir%20conta%20e%20dados"><span>Excluir minha conta e dados</span><small>Solicitação de remoção</small></a>
                    <button type="button" className={styles.profileRow} onClick={() => window.location.assign('/login')}>
                      <span><LogOut size={14} /> Sair da conta</span><small>Encerrar sessão atual</small>
                    </button>
                  </div>
                </Surface>
              </div>
            </section>
          ) : null}

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

          {upgradeOpen ? (
            <div className={styles.upgradeOverlay} role="dialog" aria-modal="true" aria-label="Assinar plano Pro">
              <Surface className={styles.upgradeModal}>
                <button type="button" className={styles.upgradeClose} onClick={() => setUpgradeOpen(false)} aria-label="Fechar">
                  <X size={16} />
                </button>
                <p className={styles.upgradeKicker}>Desbloquear LinhaCash Pro</p>
                <h3>Escolha seu plano</h3>
                <p className={styles.upgradeSubtitle}>Plano anual com desconto: <strong>R$197/ano</strong> comparado ao mensal.</p>
                <div className={styles.upgradePlans}>
                  <button
                    type="button"
                    className={`${styles.upgradePlanBtn} ${upgradePlan === 'mensal' ? styles.isSelected : ''}`}
                    onClick={() => setUpgradePlan('mensal')}
                  >
                    <span>Mensal</span>
                    <strong>R$24,90/mês</strong>
                  </button>
                  <button
                    type="button"
                    className={`${styles.upgradePlanBtn} ${upgradePlan === 'anual' ? styles.isSelected : ''}`}
                    onClick={() => setUpgradePlan('anual')}
                  >
                    <span>Anual · Melhor custo</span>
                    <strong>R$197/ano</strong>
                    <small>Desconto aplicado no ciclo anual</small>
                  </button>
                </div>
                <label className={styles.upgradeField}>
                  Código de indicação / cupom
                  <input
                    value={upgradeCode}
                    onChange={(event) => setUpgradeCode(event.target.value.toUpperCase())}
                    placeholder="Opcional"
                    maxLength={20}
                  />
                </label>
                {upgradeError ? <p className={styles.upgradeError}>{upgradeError}</p> : null}
                <Button size="lg" onClick={startCheckout} disabled={upgradeLoading}>
                  {upgradeLoading ? 'Abrindo checkout...' : 'Continuar para pagamento'}
                </Button>
              </Surface>
            </div>
          ) : null}
        </div>
      </ContentContainer>
    </AppShell>
  );
}
