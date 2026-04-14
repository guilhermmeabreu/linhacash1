'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Crown,
  FileText,
  HelpCircle,
  LogOut,
  X,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './dashboard-view.module.css';

const STATS = ['PTS', 'AST', 'REB', '3PM', 'PA', 'PR', 'PRA', 'AR', 'DD', 'TD', 'STEAL', 'BLOCKS', 'SB', 'FG2A', 'FG3A'] as const;
const FREE_STATS = ['PTS', '3PM'] as const;
const PLAYER_ROW_STATS = [
  { label: 'PTS', stat: 'PTS' },
  { label: 'REB', stat: 'REB' },
  { label: 'AST', stat: 'AST' },
  { label: 'STL', stat: 'STEAL' },
  { label: 'BLK', stat: 'BLOCKS' },
] as const;

type Stat = (typeof STATS)[number];
const SPLITS = ['24/25', 'L5', 'L10', 'L20', 'L30', 'Season', 'H2H'] as const;
type Split = (typeof SPLITS)[number];

type Plan = 'free' | 'pro';
type UpgradePlan = 'monthly' | 'annual' | 'playoff';
type DashboardViewMode = 'games' | 'players' | 'detail' | 'profile';
type Theme = 'dark' | 'light';
type SupportSurface = 'faq' | 'support' | 'bug' | 'delete' | null;
const SUPPORT_SUBJECT_OPTIONS = ['Assinatura / cobrança', 'Acesso / conta', 'Erro técnico', 'Sugestão / melhoria', 'Outro'] as const;

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

type BillingData = {
  hasProAccess?: boolean;
  isPaidPro?: boolean;
  isManualPro?: boolean;
  playoffPackActive?: boolean;
  planSource?: string | null;
  subscriptionStatus?: string | null;
};

type ChartBarTone = 'hit' | 'miss' | 'tie';

type PlayerDetailChartBar = {
  date: string | null;
  value: number;
  minutes: number;
  tone: ChartBarTone;
  label: string;
};

type PlayerDetailSplitMetric = {
  label: string;
  value: string;
  note: string;
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
  const [playersRateLimitedByGame, setPlayersRateLimitedByGame] = useState<Record<number, boolean>>({});
  const [selectedGameId, setSelectedGameId] = useState<number | null>(initialGameId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(() => {
    const value = searchParams.get('p');
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [selectedStat, setSelectedStat] = useState<Stat>(() => resolveInitialStat(searchParams.get('s')));
  const [selectedSplit, setSelectedSplit] = useState<Split>('L10');
  const [gamesStatus, setGamesStatus] = useState<ResourceStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metricsByPlayer, setMetricsByPlayer] = useState<Record<number, Partial<Record<Stat, { metrics: PlayerMetrics | null; games: PlayerGameSample[] }>>>>({});
  const [metricsStatusByPlayer, setMetricsStatusByPlayer] = useState<Record<number, Partial<Record<Stat, ResourceStatus>>>>({});
  const [metricsErrorByPlayer, setMetricsErrorByPlayer] = useState<Record<number, Partial<Record<Stat, string | null>>>>({});
  const [plan, setPlan] = useState<Plan>('free');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<UpgradePlan>('annual');
  const [upgradeCode, setUpgradeCode] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [supportSurface, setSupportSurface] = useState<SupportSurface>(null);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportFeedback, setSupportFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);

  const gamesRequestRef = useRef(0);
  const playersRequestRef = useRef<Record<number, number>>({});
  const metricsRequestRef = useRef<Record<string, number>>({});
  const playersStatusRef = useRef<Record<number, ResourceStatus>>({});
  const playersCacheRef = useRef<Record<number, Player[]>>({});
  const playersInFlightRef = useRef<Record<number, Promise<void> | null>>({});

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
    const stripeCheckoutStatus = (searchParams.get('checkout') || '').toLowerCase();
    if (stripeCheckoutStatus === 'success') return 'Pagamento confirmado! Seu plano Pro será liberado em instantes.';
    if (stripeCheckoutStatus === 'cancelled') return 'Pagamento cancelado. Sua sessão continua ativa e você pode tentar novamente quando quiser.';
    const checkoutStatus = (searchParams.get('status') || '').toLowerCase();
    if (checkoutStatus === 'success') return 'Pagamento confirmado! Seu plano Pro será liberado em instantes.';
    if (checkoutStatus === 'pending') return 'Pagamento pendente. Assim que for confirmado, seu acesso será atualizado.';
    if (checkoutStatus === 'failure') return 'Pagamento não concluído. Você pode tentar novamente quando quiser.';
    return null;
  }, [searchParams]);
  const checkoutReturnStatus = useMemo(() => (searchParams.get('checkout') || '').toLowerCase(), [searchParams]);

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
      const existingStatus = playersStatusRef.current[game.id] ?? 'idle';
      const hasCachedPayload = Object.prototype.hasOwnProperty.call(playersCacheRef.current, game.id);

      if (!options?.force) {
        if (hasCachedPayload || existingStatus === 'loading' || existingStatus === 'ready' || existingStatus === 'empty' || existingStatus === 'error') {
          return;
        }
        if (playersInFlightRef.current[game.id]) return;
      }

      const requestId = (playersRequestRef.current[game.id] ?? 0) + 1;
      playersRequestRef.current[game.id] = requestId;

      playersStatusRef.current[game.id] = 'loading';
      setPlayersStatusByGame((prev) => ({ ...prev, [game.id]: 'loading' }));
      setPlayersErrorByGame((prev) => ({ ...prev, [game.id]: null }));
      setPlayersRateLimitedByGame((prev) => ({ ...prev, [game.id]: false }));

      const request = (async () => {
        const result = await apiFetch<{ players: Array<{ id: number; name: string; team_id: number; position: string; jersey: string | number | null }> }>(
          `/api/players?gameId=${game.id}`,
        );

        if (playersRequestRef.current[game.id] !== requestId) return;

        if (!result.ok) {
          playersStatusRef.current[game.id] = 'error';
          setPlayersStatusByGame((prev) => ({ ...prev, [game.id]: 'error' }));
          setPlayersErrorByGame((prev) => ({ ...prev, [game.id]: result.message }));
          setPlayersRateLimitedByGame((prev) => ({ ...prev, [game.id]: result.status === 429 }));
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

        playersCacheRef.current[game.id] = mappedPlayers;
        const nextStatus = mappedPlayers.length ? 'ready' : 'empty';
        playersStatusRef.current[game.id] = nextStatus;
        setPlayersByGame((prev) => ({ ...prev, [game.id]: mappedPlayers }));
        setPlayersStatusByGame((prev) => ({ ...prev, [game.id]: nextStatus }));
      })();

      playersInFlightRef.current[game.id] = request;
      try {
        await request;
      } finally {
        playersInFlightRef.current[game.id] = null;
      }
    },
    [],
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
      if (!authBootstrapped) return;
      void loadGames();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authBootstrapped, loadGames]);

  useEffect(() => {
    let canceled = false;

    async function loadPlan() {
      const token = getAuthToken();
      if (!token) {
        if (!canceled) {
          setPlan('free');
          setProfile(null);
          setBilling(null);
        }
        if (!canceled) setAuthBootstrapped(true);
        return;
      }

      const result = await apiFetch<{ profile?: ProfileData; billing?: BillingData }>('/api/profile');
      if (canceled) return;

      if (result.ok) {
        const resolvedPlan = result.data.profile?.plan === 'pro' ? 'pro' : 'free';
        setPlan(resolvedPlan);
        setProfile(result.data.profile ?? null);
        setBilling(result.data.billing ?? null);
        if (!canceled) setAuthBootstrapped(true);
        return;
      }

      if (checkoutReturnStatus === 'cancelled' || checkoutReturnStatus === 'success') {
        const revalidated = await apiFetch<{ user?: ProfileData; billing?: BillingData }>('/api/auth');
        if (!canceled && revalidated.ok) {
          const resolvedPlan = revalidated.data.user?.plan === 'pro' ? 'pro' : 'free';
          setPlan(resolvedPlan);
          setProfile(revalidated.data.user ?? null);
          setBilling(revalidated.data.billing ?? null);
        }
      }

      if (!canceled) setAuthBootstrapped(true);
    }

    loadPlan();

    return () => {
      canceled = true;
    };
  }, [checkoutReturnStatus]);

  useEffect(() => {
    if (!selectedGameId) return;
    const game = games.find((item) => item.id === selectedGameId);
    if (!game) return;
    const timer = window.setTimeout(() => {
      void loadPlayersForGame(game);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [games, loadPlayersForGame, selectedGameId]);

  useEffect(() => {
    if (!selectedPlayerId || marketLocked) return;
    const timer = window.setTimeout(() => {
      void loadMetricsForPlayer(selectedPlayerId, selectedStat);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMetricsForPlayer, marketLocked, selectedPlayerId, selectedStat]);

  useEffect(() => {
    if (view !== 'players' || marketLocked) return;
    const hotPlayers = players.slice(0, 12);
    if (!hotPlayers.length) return;
    const statsToWarm = Array.from(new Set<Stat>([selectedStat, ...PLAYER_ROW_STATS.map((item) => item.stat)]));
    const timer = window.setTimeout(() => {
      hotPlayers.forEach((player) => {
        statsToWarm.forEach((stat) => {
          void loadMetricsForPlayer(player.id, stat);
        });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMetricsForPlayer, marketLocked, players, selectedStat, view]);

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

  const handleManageSubscription = useCallback(async () => {
    setManageLoading(true);
    setUpgradeError(null);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      const portalUrl = data?.data?.url;
      if (!response.ok || !portalUrl) {
        setUpgradeError(data?.error?.message || 'Não foi possível abrir o portal de assinatura.');
        return;
      }
      window.location.href = portalUrl as string;
    } catch {
      setUpgradeError('Falha ao abrir o portal. Tente novamente em instantes.');
    } finally {
      setManageLoading(false);
    }
  }, []);

  const openSupportSurface = useCallback((surface: Exclude<SupportSurface, null>) => {
    setSupportFeedback(null);
    setDeleteFeedback(null);
    if (surface === 'support') {
      setSupportSubject(SUPPORT_SUBJECT_OPTIONS[0]);
      setSupportMessage('');
    }
    if (surface === 'bug') {
      setSupportSubject(SUPPORT_SUBJECT_OPTIONS[2]);
      setSupportMessage('');
    }
    if (surface === 'delete') {
      setDeleteConfirmValue('');
    }
    setSupportSurface(surface);
  }, []);

  const submitSupport = useCallback(async () => {
    if (!supportSurface || supportSurface === 'faq' || supportSurface === 'delete') return;
    setSupportSubmitting(true);
    setSupportFeedback(null);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: supportSurface === 'bug' ? 'bug' : 'support',
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSupportFeedback({
          tone: 'error',
          text: payload?.error || 'Não foi possível enviar agora. Tente novamente em instantes.',
        });
        return;
      }
      setSupportFeedback({
        tone: 'success',
        text: 'Mensagem enviada com sucesso. Nosso time vai retornar pelo canal cadastrado.',
      });
      setSupportMessage('');
    } catch {
      setSupportFeedback({
        tone: 'error',
        text: 'Falha de conexão no envio. Verifique a internet e tente novamente.',
      });
    } finally {
      setSupportSubmitting(false);
    }
  }, [supportMessage, supportSubject, supportSurface]);

  const submitDeleteAccount = useCallback(async () => {
    setDeleteSubmitting(true);
    setDeleteFeedback(null);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirmation: deleteConfirmValue.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteFeedback({
          tone: 'error',
          text: payload?.error || 'Não foi possível concluir a exclusão agora.',
        });
        return;
      }
      setDeleteFeedback({
        tone: 'success',
        text: 'Conta excluída com sucesso. Você será redirecionado para o login.',
      });
      setTimeout(() => {
        window.location.assign('/login');
      }, 900);
    } catch {
      setDeleteFeedback({
        tone: 'error',
        text: 'Falha de conexão. Tente novamente em instantes.',
      });
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteConfirmValue]);

  const startCheckout = useCallback(async () => {
    setUpgradeLoading(true);
    setUpgradeError(null);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: upgradePlan }),
      });
      const data = await response.json().catch(() => ({}));
      const checkoutUrl = data?.data?.url;
      if (!response.ok || !checkoutUrl) {
        setUpgradeError(data?.error?.message || 'Não foi possível iniciar o checkout agora.');
        return;
      }
      window.location.href = checkoutUrl as string;
    } catch {
      setUpgradeError('Falha ao iniciar checkout. Tente novamente em instantes.');
    } finally {
      setUpgradeLoading(false);
    }
  }, [upgradePlan]);

  const getSplitPctClassName = useCallback((value: string) => {
    const pct = Number.parseInt(value.replace('%', ''), 10);
    if (!Number.isFinite(pct)) return '';
    if (pct >= 80) return styles.splitPctHigh;
    if (pct >= 50) return styles.splitPctMid;
    return styles.splitPctLow;
  }, []);

  const playerDetailModel = useMemo(() => {
    if (!selectedPlayer) return null;
    const payload = selectedMetricsResource;
    const allGames = (payload?.games ?? []).map((sample) => ({
      date: sample.date,
      value: Number(sample.value ?? 0),
      minutes: Number(sample.minutes ?? 0),
    }));
    const splitGames = (() => {
      if (selectedSplit === 'Season') return allGames;
      if (selectedSplit === '24/25') {
        return allGames.filter((sample) => {
          if (!sample.date) return false;
          const date = new Date(sample.date);
          const start = new Date('2024-07-01');
          const end = new Date('2025-06-30');
          return date >= start && date <= end;
        });
      }
      if (selectedSplit === 'H2H') return allGames.slice(0, 4);
      const sampleSizeMap: Record<Extract<Split, 'L5' | 'L10' | 'L20' | 'L30'>, number> = { L5: 5, L10: 10, L20: 20, L30: 30 };
      return allGames.slice(0, sampleSizeMap[selectedSplit as Extract<Split, 'L5' | 'L10' | 'L20' | 'L30'>]);
    })();
    const games = splitGames.length ? splitGames : allGames;
    const values = games.map((sample) => sample.value);
    const lineBase = Number(payload?.metrics?.line ?? payload?.metrics?.avg_l10 ?? 0);
    const apiLine = Number.isFinite(lineBase) && lineBase > 0 ? Math.round(lineBase * 2) / 2 : 0.5;
    const line = Math.max(0, apiLine + lineAdjustment);
    const average = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1)) : null;
    const bars: PlayerDetailChartBar[] = games.slice().reverse().map((sample) => {
      const tone: ChartBarTone = sample.value > line ? 'hit' : sample.value === line ? 'tie' : 'miss';
      const date = sample.date ? new Date(sample.date) : null;
      const label = date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` : '—';
      return { ...sample, tone, label };
    });
    const splitMetrics: PlayerDetailSplitMetric[] = SPLITS.map((split) => {
      const scopedGames = split === 'Season'
        ? allGames
        : split === '24/25'
          ? allGames.filter((sample) => sample.date && new Date(sample.date) >= new Date('2024-07-01') && new Date(sample.date) <= new Date('2025-06-30'))
          : split === 'H2H'
            ? allGames.slice(0, 4)
            : allGames.slice(0, Number(split.slice(1)));
      if (!scopedGames.length) return { label: split, value: '—', note: 'Sem dados' };
      const hits = scopedGames.filter((sample) => sample.value >= line).length;
      const pct = Math.round((hits / scopedGames.length) * 100);
      return { label: split, value: `${pct}%`, note: `${hits}/${scopedGames.length}` };
    });
    const summaryMetricMap: Record<string, PlayerDetailSplitMetric> = {};
    splitMetrics.forEach((metric) => {
      summaryMetricMap[metric.label] = metric;
    });
    const summaryMetrics: PlayerDetailSplitMetric[] = [
      summaryMetricMap.Season ?? { label: 'Season', value: '—', note: 'Sem dados' },
      summaryMetricMap.H2H ?? { label: 'H2H', value: '—', note: 'Sem dados' },
      summaryMetricMap.L5 ?? { label: 'L5', value: '—', note: 'Sem dados' },
      summaryMetricMap.L10 ?? { label: 'L10', value: '—', note: 'Sem dados' },
      summaryMetricMap.L20 ?? { label: 'L20', value: '—', note: 'Sem dados' },
      summaryMetricMap.L30 ?? { label: 'L30', value: '—', note: 'Sem dados' },
      summaryMetricMap['24/25'] ?? { label: '24/25', value: '—', note: 'Sem dados' },
    ];
    return {
      allGames,
      games,
      line,
      average,
      bars,
      summaryMetrics,
      metrics: payload?.metrics ?? null,
      splitMetrics,
    };
  }, [lineAdjustment, selectedMetricsResource, selectedPlayer, selectedSplit]);

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
  const profileName = profile?.name?.trim() || 'Usuário';
  const profileEmail = profile?.email?.trim() || 'E-mail não disponível';
  const profileInitial = profileName.slice(0, 1).toUpperCase();
  const profilePlanLabel = plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito';

  const handleLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  }, []);

  return (
    <AppShell
      sidebar={(
        <Sidebar
          items={sidebarItems}
          activeKey={activeSidebarKey}
          onItemClick={(item) => setView(item.key === 'perfil' ? 'profile' : 'games')}
          footer={(
            <div className={styles.accountSummary}>
              <div className={styles.accountAvatar}>{profileInitial}</div>
              <div className={styles.accountMeta}>
                <strong>{profileName}</strong>
                <span>{profilePlanLabel}</span>
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
              <div className={styles.accountAvatar}>{profileInitial}</div>
              <div className={styles.accountMeta}>
                <strong>{profileName}</strong>
                <span>{profilePlanLabel}</span>
              </div>
            </div>
          )}
        />
      )}
      topbar={view === 'profile' ? null : (
        <TopBar
          className={view === 'players' ? styles.playersTopbarCompact : undefined}
          showBrand={false}
          context={view === 'games' ? null : topTitle}
          leading={canGoBack ? (
            <Button size="sm" variant="ghost" onClick={() => setView(view === 'detail' ? 'players' : 'games')}>
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          actions={
            <div className={styles.topbarBadges}>
              <ThemeToggle compact />
            </div>
          }
        />
      )}
    >
      <ContentContainer width="content">
        <div className={styles.dashboardCanvas}>
          {view === 'games' ? (
            <section className={`${styles.gamesView} ${styles.viewPanel}`}>
              <p className={styles.gamesDateLine}>Hoje · {formatTodayLabel()}</p>
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
            <section className={`${styles.playersView} ${styles.viewPanel}`}>
              <div className={styles.playersTopbar}>
                <h2>Jogadores</h2>
              </div>

              <div className={styles.statsTabsWrap}>
                <TabsRoot value={selectedStat} onValueChange={handleStatChange}>
                  <div className={`${styles.statsTabsScroller} ${styles.playersStatsTabsScroller} ${styles.playersTabsViewport}`}>
                    <TabsList className={`${styles.statsTabs} ${styles.playersTabsRow}`}>
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
                  </div>
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
                        description={
                          playersRateLimitedByGame[selectedGameId ?? -1]
                            ? 'Muitas tentativas em pouco tempo (429). Aguarde alguns segundos e tente novamente.'
                            : selectedGamePlayersError || 'Tente novamente.'
                        }
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
                              <div className={styles.playerQuickStats}>
                                {PLAYER_ROW_STATS.map((entry) => (
                                  <span key={`${player.id}-${entry.label}`}>
                                    <small>{entry.label}</small>
                                    <strong>{metricsByPlayer[player.id]?.[entry.stat]?.metrics?.avg_l10?.toFixed(1) ?? '—'}</strong>
                                  </span>
                                ))}
                                <span className={styles.playerQuickStatLine}>
                                  <small>LINE</small>
                                  <strong>{line ? Number(line).toFixed(1) : '—'}</strong>
                                </span>
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
            <section className={`${styles.detailView} ${styles.viewPanel}`}>
              <div className={styles.detailTabsRow}>
                <TabsRoot value={selectedStat} onValueChange={handleStatChange}>
                  <div className={styles.statsTabsScroller}>
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
                  </div>
                </TabsRoot>
              </div>
              <div className={styles.playerHero}>
                <div>
                  <p className={styles.playerHeroMeta}>{selectedPlayer.team} • {selectedPlayer.position}</p>
                  <h2 className={styles.playerHeroName}>{selectedPlayer.name}</h2>
                </div>
                <div className={`${styles.lineAdjustBox} ${styles.lineAdjustDesktop}`}>
                  <p>Ajustar linha</p>
                  <div className={styles.lineAdjustControls}>
                    <button type="button" onClick={() => setLineAdjustment((value) => Number((value - 0.5).toFixed(1)))}><Minus size={16} /></button>
                    <strong>{playerDetailModel?.line.toFixed(1) ?? '0.0'}</strong>
                    <button type="button" onClick={() => setLineAdjustment((value) => Number((value + 0.5).toFixed(1)))}><Plus size={16} /></button>
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
                    {playerDetailModel.summaryMetrics.map((metric) => (
                      <div key={metric.label}>
                        <span>{metric.label}</span>
                        <strong className={getSplitPctClassName(metric.value)}>{metric.value}</strong>
                        <small>{metric.note}</small>
                      </div>
                    ))}
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <p className={styles.chartTitle}>{selectedStat} · {selectedSplit}</p>
                      <div className={styles.chartHeaderBadges}>
                        <Badge variant="muted">Linha {playerDetailModel.line}</Badge>
                        <Badge variant="muted">Média {playerDetailModel.average ?? '—'}</Badge>
                      </div>
                    </div>
                    <div className={styles.chartCanvas}>
                      {playerDetailModel.bars.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={playerDetailModel.bars}
                            margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
                            barCategoryGap={playerDetailModel.bars.length <= 5 ? '6%' : playerDetailModel.bars.length <= 10 ? '8%' : playerDetailModel.bars.length <= 20 ? '10%' : '12%'}
                          >
                            <CartesianGrid stroke="color-mix(in srgb, var(--lc-border) 55%, transparent)" strokeDasharray="2 4" vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--lc-muted)', fontSize: 11 }} />
                            <YAxis
                              hide
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: 'var(--lc-muted)', fontSize: 11 }}
                              width={0}
                              domain={[0, (max: number) => Math.max(max + 1, playerDetailModel.line + 1)]}
                            />
                            <Tooltip
                              cursor={false}
                              contentStyle={{
                                border: '1px solid var(--lc-border)',
                                background: 'color-mix(in srgb, var(--lc-surface) 92%, var(--lc-bg) 8%)',
                                color: 'var(--lc-text)',
                                borderRadius: 8,
                                boxShadow: '0 8px 20px rgba(0,0,0,.28)',
                                fontSize: '12px',
                              }}
                            />
                            <ReferenceLine
                              y={playerDetailModel.line}
                              stroke="var(--lc-accent)"
                              strokeDasharray="4 4"
                            />
                            <Bar
                              dataKey="value"
                              radius={[1, 1, 0, 0]}
                              isAnimationActive={false}
                              maxBarSize={
                                playerDetailModel.bars.length <= 5
                                  ? 66
                                  : playerDetailModel.bars.length <= 10
                                    ? 50
                                    : playerDetailModel.bars.length <= 20
                                      ? 34
                                      : 28
                              }
                            >
                              <LabelList dataKey="value" position="top" fill="var(--lc-text)" fontSize={10} />
                              {playerDetailModel.bars.map((bar, index) => (
                                <Cell
                                  key={`${bar.label}-${index}`}
                                  fill={bar.tone === 'hit' ? '#26d07c' : bar.tone === 'tie' ? '#8d8d8d' : '#ff6e6e'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className={styles.stateText}>Dados recentes indisponíveis para o gráfico.</p>
                      )}
                    </div>
                  </div>

                  <TabsRoot value={selectedSplit} onValueChange={(value) => setSelectedSplit((SPLITS.includes(value as Split) ? value : 'L10') as Split)}>
                    <TabsList className={styles.splitTabs}>
                      {SPLITS.map((split) => (
                        <TabsTrigger key={split} value={split}>{split}</TabsTrigger>
                      ))}
                    </TabsList>
                  </TabsRoot>

                  <div className={`${styles.lineAdjustBox} ${styles.lineAdjustMobile}`}>
                    <p>Ajustar linha</p>
                    <div className={styles.lineAdjustControls}>
                      <button type="button" onClick={() => setLineAdjustment((value) => Number((value - 0.5).toFixed(1)))}><Minus size={16} /></button>
                      <strong>{playerDetailModel?.line.toFixed(1) ?? '0.0'}</strong>
                      <button type="button" onClick={() => setLineAdjustment((value) => Number((value + 0.5).toFixed(1)))}><Plus size={16} /></button>
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {view === 'profile' ? (
            <section className={`${styles.profileView} ${styles.viewPanel}`}>
              <div className={styles.profileTopHeader}>
                <div className={styles.profileTopHeaderMain}>
                  <Button size="sm" variant="ghost" className={styles.profileBackButton} onClick={() => setView('games')} aria-label="Voltar para jogos do dia">
                    <ArrowLeft size={16} />
                  </Button>
                  <h1>Meu Perfil</h1>
                </div>
                <ThemeToggle compact />
              </div>
              <Surface className={styles.profileHero}>
                <div className={styles.profileHeroGlow} aria-hidden />
                <div className={styles.profileHeaderAvatar}>{profileInitial}</div>
                <div className={styles.profileHeaderMeta}>
                  <h2>{profileName}</h2>
                  <p>{profileEmail}</p>
                  {profileSince ? <small>Membro desde {profileSince}</small> : null}
                </div>
                <Badge variant={plan === 'pro' ? 'success' : 'default'}>{profilePlanLabel}</Badge>
              </Surface>

              <div className={styles.profileGrid}>
                <Surface className={styles.profileSection}>
                  <div className={styles.profileSectionHeader}>
                    <h3>Planos</h3>
                  </div>
                  <div className={`${styles.profileRows} technical-grid`}>
                    <div className={`${styles.profileRow} technical-item ${plan === 'free' ? styles.profileRowActive : ''}`}>
                      <div className={styles.profileRowContent}>
                        <span>Gratuito</span>
                        <small>Todos os jogos visíveis · Acesso parcial às estatísticas</small>
                      </div>
                      {plan === 'free' ? <Badge variant="success">Ativo</Badge> : <ChevronRight size={14} />}
                    </div>
                    <button type="button" className={`${styles.profileRow} technical-item ${plan === 'pro' ? styles.profileRowActive : ''}`} onClick={openUpgradeSurface}>
                      <div className={styles.profileRowContent}>
                        <span>Pro</span>
                        <small>
                          {plan === 'pro'
                            ? `PRO ativo${billing?.isPaidPro ? ' · assinatura Stripe' : billing?.isManualPro ? ' · acesso concedido' : ''}`
                            : 'R$24,90/mês · R$197/ano com desconto'}
                        </small>
                      </div>
                      {plan === 'pro' ? <Badge variant="success">Ativo</Badge> : <ChevronRight size={14} />}
                    </button>
                  </div>
                </Surface>

                <Surface className={styles.profileSection}>
                  <h3>Conta</h3>
                  <div className={`${styles.profileRows} technical-grid`}>
                    <a className={`${styles.profileRow} technical-item`} href="mailto:suporte@linhacash.com.br?subject=Atualiza%C3%A7%C3%A3o%20de%20perfil">
                      <div className={styles.profileRowContent}>
                        <span><UserRound size={14} /> Editar perfil</span>
                      </div>
                      <ChevronRight size={14} />
                    </a>
                    <a className={`${styles.profileRow} technical-item`} href="/forgot-password">
                      <div className={styles.profileRowContent}>
                        <span><Shield size={14} /> Segurança</span>
                      </div>
                      <ChevronRight size={14} />
                    </a>
                    <div className={`${styles.profileRow} technical-item`}>
                      <div className={styles.profileRowContent}>
                        <span>{profile?.theme === 'light' ? <Sun size={14} /> : <Moon size={14} />} Tema</span>
                      </div>
                      <div className={styles.profileRowControl}><ThemeToggle compact /></div>
                    </div>
                  </div>
                </Surface>
              </div>

              <Surface className={styles.profileSection}>
                <h3>Suporte</h3>
                <div className={`${styles.profileRows} technical-grid`}>
                  <button type="button" className={`${styles.profileRow} technical-item`} onClick={() => openSupportSurface('faq')}>
                    <div className={styles.profileRowContent}>
                      <span><HelpCircle size={14} /> Perguntas frequentes</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                  <button type="button" className={`${styles.profileRow} technical-item`} onClick={() => openSupportSurface('support')}>
                    <div className={styles.profileRowContent}>
                      <span><MessageSquare size={14} /> Falar com suporte</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                  <button type="button" className={`${styles.profileRow} technical-item`} onClick={() => openSupportSurface('bug')}>
                    <div className={styles.profileRowContent}>
                      <span><AlertTriangle size={14} /> Reportar um problema</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                  <Link className={`${styles.profileRow} technical-item`} href="/termos">
                    <div className={styles.profileRowContent}>
                      <span><FileText size={14} /> Termos de uso</span>
                    </div>
                    <ChevronRight size={14} />
                  </Link>
                  <Link className={`${styles.profileRow} technical-item`} href="/privacidade">
                    <div className={styles.profileRowContent}>
                      <span><Lock size={14} /> Política de privacidade</span>
                    </div>
                    <ChevronRight size={14} />
                  </Link>
                  <button type="button" className={`${styles.profileRow} ${styles.profileRowDanger} technical-item`} onClick={() => openSupportSurface('delete')}>
                    <div className={styles.profileRowContent}>
                      <span><Trash2 size={14} /> Excluir minha conta e dados</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </Surface>

              <div className={styles.profileLogoutWrap}>
                <Button type="button" size="lg" variant="secondary" className={styles.profileLogoutButton} onClick={handleLogout}>
                  <LogOut size={14} />
                  Sair da conta
                </Button>
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
                {plan === 'pro' ? (
                  <>
                    <p className={styles.upgradeKicker}>LinhaCash Pro</p>
                    <h3>PRO ativo</h3>
                    <p className={styles.upgradeSubtitle}>
                      {billing?.playoffPackActive
                        ? 'Plano atual: Pack Playoff ativo.'
                        : billing?.isPaidPro
                          ? 'Plano atual: PRO pago ativo.'
                          : 'Plano atual: PRO ativo.'}
                    </p>
                    {billing?.isPaidPro ? (
                      <Button size="lg" onClick={handleManageSubscription} disabled={manageLoading}>
                        {manageLoading ? 'Abrindo portal...' : 'Gerenciar assinatura'}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className={styles.upgradeKicker}>Desbloquear LinhaCash Pro</p>
                    <h3>Escolha seu plano</h3>
                    <p className={styles.upgradeSubtitle}>Acesso completo a todos os recursos, com melhor custo no ciclo anual.</p>
                    <div className={styles.upgradePlans}>
                      <button
                        type="button"
                        className={`${styles.upgradePlanBtn} ${upgradePlan === 'monthly' ? styles.isSelected : ''}`}
                        onClick={() => setUpgradePlan('monthly')}
                      >
                        <span>Mensal</span>
                        <strong>R$24,90/mês</strong>
                        <small>Flexível para começar</small>
                      </button>
                      <button
                        type="button"
                        className={`${styles.upgradePlanBtn} ${upgradePlan === 'annual' ? styles.isSelected : ''}`}
                        onClick={() => setUpgradePlan('annual')}
                      >
                        <span>Anual · Mais vantajoso</span>
                        <em className={styles.upgradePopular}>Mais popular</em>
                        <strong>R$197/ano</strong>
                        <small>Equivalente a R$16,41/mês · desconto no ciclo anual</small>
                      </button>
                      <button
                        type="button"
                        className={`${styles.upgradePlanBtn} ${upgradePlan === 'playoff' ? styles.isSelected : ''}`}
                        onClick={() => setUpgradePlan('playoff')}
                      >
                        <span>Pack Playoff</span>
                        <strong>Acesso especial</strong>
                        <small>Compra única para o período de playoffs</small>
                      </button>
                    </div>
                    <label className={styles.upgradeField}>
                      Código de indicação
                      <input
                        value={upgradeCode}
                        onChange={(event) => setUpgradeCode(event.target.value.toUpperCase())}
                        placeholder="Opcional"
                        maxLength={20}
                      />
                    </label>
                    <Button size="lg" onClick={startCheckout} disabled={upgradeLoading}>
                      {upgradeLoading ? 'Abrindo checkout...' : 'Continuar para pagamento'}
                    </Button>
                  </>
                )}
                {upgradeError ? <p className={styles.upgradeError}>{upgradeError}</p> : null}
              </Surface>
            </div>
          ) : null}

          {supportSurface ? (
            <div className={styles.supportOverlay} role="dialog" aria-modal="true" aria-label="Central de suporte LinhaCash">
              <Surface className={styles.supportModal}>
                <button type="button" className={styles.supportClose} onClick={() => setSupportSurface(null)} aria-label="Fechar">
                  <X size={16} />
                </button>

                {supportSurface === 'faq' ? (
                  <>
                    <p className={styles.supportKicker}>Central de ajuda</p>
                    <h3>Perguntas frequentes</h3>
                    <div className={styles.faqList}>
                      <article>
                        <strong>O que é o LinhaCash?</strong>
                        <p>É uma plataforma de análise esportiva para apoiar leitura de jogos e desempenho.</p>
                      </article>
                      <article>
                        <strong>O LinhaCash atualiza ao vivo?</strong>
                        <p>As informações são atualizadas conforme os dados oficiais ficam disponíveis no sistema.</p>
                      </article>
                      <article>
                        <strong>O LinhaCash é uma casa de aposta?</strong>
                        <p>Não. O produto é informativo e não intermedeia apostas.</p>
                      </article>
                      <article>
                        <strong>O que muda do grátis para o Pro?</strong>
                        <p>O Pro libera todos os mercados e recursos avançados da plataforma.</p>
                      </article>
                      <article>
                        <strong>Como excluir minha conta?</strong>
                        <p>Use a opção “Excluir minha conta e dados” na seção Suporte e confirme com EXCLUIR.</p>
                      </article>
                    </div>
                  </>
                ) : supportSurface === 'delete' ? (
                  <>
                    <p className={`${styles.supportKicker} ${styles.deleteKicker}`}>Ação destrutiva</p>
                    <h3>Excluir conta e dados</h3>
                    <p className={styles.supportSubtitle}>Esta ação remove seu acesso e dados pessoais da plataforma. Para confirmar, digite EXCLUIR no campo abaixo.</p>
                    <label className={styles.upgradeField}>
                      Confirmação
                      <input
                        value={deleteConfirmValue}
                        onChange={(event) => setDeleteConfirmValue(event.target.value.toUpperCase())}
                        placeholder="Digite EXCLUIR"
                        maxLength={20}
                      />
                    </label>
                    {deleteFeedback ? (
                      <p className={deleteFeedback.tone === 'success' ? styles.supportSuccess : styles.upgradeError}>{deleteFeedback.text}</p>
                    ) : null}
                    <Button
                      size="lg"
                      variant="danger"
                      onClick={submitDeleteAccount}
                      disabled={deleteSubmitting || deleteConfirmValue.trim().toUpperCase() !== 'EXCLUIR'}
                    >
                      {deleteSubmitting ? 'Excluindo conta...' : 'Excluir permanentemente'}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className={styles.supportKicker}>{supportSurface === 'bug' ? 'Relatório técnico' : 'Atendimento'}</p>
                    <h3>{supportSurface === 'bug' ? 'Reportar um problema' : 'Falar com suporte'}</h3>
                    <p className={styles.supportSubtitle}>As mensagens são enviadas para suporte@linhacash.com.br via fluxo interno da plataforma.</p>
                    <label className={styles.upgradeField}>
                      Assunto
                      <select
                        className={styles.supportSelect}
                        value={supportSubject}
                        onChange={(event) => setSupportSubject(event.target.value)}
                      >
                        {SUPPORT_SUBJECT_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.upgradeField}>
                      Mensagem
                      <textarea
                        className={styles.supportTextarea}
                        value={supportMessage}
                        onChange={(event) => setSupportMessage(event.target.value)}
                        placeholder={supportSurface === 'bug' ? 'Descreva etapas, horário e comportamento esperado.' : 'Conte para nosso time como podemos ajudar.'}
                        maxLength={2000}
                      />
                    </label>
                    {supportFeedback ? (
                      <p className={supportFeedback.tone === 'success' ? styles.supportSuccess : styles.upgradeError}>{supportFeedback.text}</p>
                    ) : null}
                    <Button size="lg" onClick={submitSupport} disabled={supportSubmitting}>
                      {supportSubmitting ? 'Enviando...' : 'Enviar mensagem'}
                    </Button>
                  </>
                )}
              </Surface>
            </div>
          ) : null}
        </div>
      </ContentContainer>
    </AppShell>
  );
}
