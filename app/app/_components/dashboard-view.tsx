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
import { type FocusEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  captureAuthSessionFromUrl,
  clearAuthSession,
  ensureValidAccessToken,
  readStoredAuthSession,
  refreshAuthSession,
} from '@/lib/auth/client-session';
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
type Stat = (typeof STATS)[number];
const SPLITS = ['L5', 'L10', 'L20', 'L30', 'Season', 'H2H'] as const;
type Split = (typeof SPLITS)[number];
type MetricsWindow = 'L5' | 'L10' | 'L20' | 'L30' | 'SEASON' | 'CURRENT_SEASON' | 'PREV_SEASON';

type Plan = 'free' | 'pro';
type UpgradePlan = 'monthly' | 'annual' | 'playoff';
type DashboardViewMode = 'games' | 'players' | 'detail' | 'profile';
type Theme = 'dark' | 'light';
type SupportSurface = 'faq' | 'support' | 'bug' | 'delete' | null;
const SUPPORT_SUBJECT_OPTIONS = ['Assinatura / cobrança', 'Acesso / conta', 'Erro técnico', 'Sugestão / melhoria', 'Outro'] as const;

type Game = {
  id: number;
  game_date?: string | null;
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

type PlayerAvatarProps = {
  playerName: string;
};

type PlayerMetrics = {
  player_id: number;
  stat: Stat;
  avg_l5?: number | null;
  avg_l10?: number | null;
  avg_l20?: number | null;
  avg_l30?: number | null;
  avg_season?: number | null;
  selected_avg?: number | null;
  avg_home?: number | null;
  avg_away?: number | null;
  hit_rate_l10?: number | null;
  selected_hit_rate?: number | null;
  sample_size?: number | null;
  season_sample_size?: number | null;
  line?: number | null;
};

type PlayerGameSample = {
  date: string | null;
  value: number | null;
  minutes: number | null;
};

type MetricsPayload = {
  metrics: PlayerMetrics | null;
  games: PlayerGameSample[];
};
type TimedCacheEntry<T> = {
  payload: T;
  expiresAt: number;
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

type ChartBarTone = 'hit' | 'miss';

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
  const session = readStoredAuthSession();
  return session?.accessToken ?? null;
}

async function apiFetch<T>(path: string): Promise<ApiResult<T>> {
  const token = await ensureValidAccessToken();
  const request = async (nextToken: string | null) => fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
    },
  });
  let response = await request(token);
  if (response.status === 401) {
    const refreshed = await refreshAuthSession();
    if (refreshed) {
      response = await request(refreshed);
    }
  }

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

function getSaoPauloDateParts(date: Date): { year: number; month: number; day: number; hour: number } | null {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour)) {
    return null;
  }

  return { year, month, day, hour };
}

function toCalendarKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getNBADayKey(date: Date): string {
  const localParts = getSaoPauloDateParts(date);
  if (!localParts) return '';

  if (localParts.hour >= 6) {
    return toCalendarKey(localParts.year, localParts.month, localParts.day);
  }

  const previousDay = new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day - 1));
  return toCalendarKey(previousDay.getUTCFullYear(), previousDay.getUTCMonth() + 1, previousDay.getUTCDate());
}

function parseGameTime(gameTime: string): Date | null {
  const value = gameTime?.trim();
  if (!value) return null;

  const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);
  const normalized = !hasTimezone && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;

  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function buildGameDateTime(game: Game): Date | null {
  return parseGameTime(game.game_time);
}

function parseCalendarDate(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatCalendarDateLabel(value: string | null | undefined): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) return '—';
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}`;
}

function compareCalendarDateDesc(a: string | null | undefined, b: string | null | undefined): number {
  const parsedA = parseCalendarDate(a);
  const parsedB = parseCalendarDate(b);
  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;
  const normalizedA = parsedA.year * 10000 + parsedA.month * 100 + parsedA.day;
  const normalizedB = parsedB.year * 10000 + parsedB.month * 100 + parsedB.day;
  return normalizedB - normalizedA;
}

function resolveInitialStat(value: string | null): Stat {
  return STATS.includes(value as Stat) ? (value as Stat) : 'PTS';
}

function isLockedStat(stat: Stat, plan: Plan) {
  return plan !== 'pro' && !FREE_STATS.includes(stat as (typeof FREE_STATS)[number]);
}

function resolveMetricsWindow(split: Split): MetricsWindow {
  if (split === 'L5' || split === 'L10' || split === 'L20' || split === 'L30') return split;
  if (split === 'Season') return 'CURRENT_SEASON';
  return 'SEASON';
}

function resolveH2HOpponentContext(
  game: Game | null,
  player: Player | null,
): { opponent: string | null; opponentTeamId: number | null; gameId: number | null } | null {
  if (!game || !player) return null;

  const playerTeamId = Number(player.team_id || 0);
  const playerTeamName = player.team?.trim().toLowerCase() || '';

  const homeTeamName = game.home_team.trim().toLowerCase();
  const awayTeamName = game.away_team.trim().toLowerCase();

  // 1. Try by ID (ideal)
  if (playerTeamId > 0) {
    if (playerTeamId === game.home_team_id) {
      return { opponent: game.away_team, opponentTeamId: game.away_team_id, gameId: game.id };
    }
    if (playerTeamId === game.away_team_id) {
      return { opponent: game.home_team, opponentTeamId: game.home_team_id, gameId: game.id };
    }
  }

  // 2. Fallback by name (CRUCIAL FIX)
  if (playerTeamName) {
    if (playerTeamName === homeTeamName) {
      return { opponent: game.away_team, opponentTeamId: game.away_team_id, gameId: game.id };
    }
    if (playerTeamName === awayTeamName) {
      return { opponent: game.home_team, opponentTeamId: game.home_team_id, gameId: game.id };
    }
  }

  // 3. Safe fallback
  return { opponent: null, opponentTeamId: null, gameId: game.id };
}

function buildMetricsScope(split: Split, game: Game | null, player: Player | null) {
  const window = resolveMetricsWindow(split);
  const h2hContext = split === 'H2H' ? resolveH2HOpponentContext(game, player) : null;
  const opponent = h2hContext?.opponent ?? null;
  const opponentTeamId = h2hContext?.opponentTeamId ?? null;
  const scopeKey = `${split}:${window}:${opponentTeamId || 0}:${opponent?.trim().toLowerCase() || 'all'}`;
  return { split, window, opponent, opponentTeamId, gameId: null, scopeKey };
}

function buildMetricsCacheKey(playerId: number, stat: Stat, scopeKey: string) {
  return `${playerId}:${stat}:${scopeKey}`;
}

function PlayerAvatar({ playerName }: PlayerAvatarProps) {
  const initials = playerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
  return (
    <div className={styles.avatar}>
      {initials}
    </div>
  );
}

const SPLIT_CARD_ORDER: Split[] = ['Season', 'L5', 'L10', 'L20', 'L30', 'H2H'];
const PLAYERS_CACHE_TTL_MS = 5 * 60 * 1000;
const METRICS_CACHE_TTL_MS = 3 * 60 * 1000;

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
  const [metricsBySelection, setMetricsBySelection] = useState<Record<string, MetricsPayload>>({});
  const [metricsStatusBySelection, setMetricsStatusBySelection] = useState<Record<string, ResourceStatus>>({});
  const [metricsErrorBySelection, setMetricsErrorBySelection] = useState<Record<string, string | null>>({});
  const [plan, setPlan] = useState<Plan>('free');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isDesktopCheckoutViewport, setIsDesktopCheckoutViewport] = useState(false);
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
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [checkoutReturnStatus, setCheckoutReturnStatus] = useState('');
  const [authBootstrapped, setAuthBootstrapped] = useState(false);

  const gamesRequestRef = useRef(0);
  const playersRequestRef = useRef<Record<number, number>>({});
  const metricsRequestRef = useRef<Record<string, number>>({});
  const playersStatusRef = useRef<Record<number, ResourceStatus>>({});
  const playersCacheRef = useRef<Record<number, TimedCacheEntry<Player[]>>>({});
  const playersInFlightRef = useRef<Record<number, Promise<void> | null>>({});
  const metricsStatusRef = useRef<Record<string, ResourceStatus>>({});
  const metricsCacheRef = useRef<Record<string, TimedCacheEntry<MetricsPayload>>>({});
  const metricsInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const consumedStripeReturnRef = useRef<string | null>(null);
  const consumedCheckoutStatusRef = useRef<string | null>(null);

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
  const showDesktopCheckoutView = upgradeOpen && isDesktopCheckoutViewport;

  const refreshBillingState = useCallback(async (): Promise<{ ok: boolean; hasPro: boolean }> => {
    const result = await apiFetch<{ profile?: ProfileData; user?: ProfileData; billing?: BillingData }>('/api/auth');
    if (!result.ok) return { ok: false, hasPro: false };

    const nextProfile = result.data.profile ?? result.data.user ?? null;
    const resolvedPlan = nextProfile?.plan === 'pro' ? 'pro' : 'free';
    setPlan(resolvedPlan);
    setProfile(nextProfile);
    setBilling(result.data.billing ?? null);
    return { ok: true, hasPro: resolvedPlan === 'pro' || Boolean(result.data.billing?.hasProAccess) };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktopCheckoutViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const selectedGamePlayersStatus = selectedGameId ? playersStatusByGame[selectedGameId] ?? 'idle' : 'idle';
  const selectedGamePlayersError = selectedGameId ? playersErrorByGame[selectedGameId] ?? null : null;
  const selectedMetricsScope = useMemo(
    () => buildMetricsScope(selectedSplit, selectedGame, selectedPlayer),
    [selectedGame, selectedPlayer, selectedSplit],
  );
  const splitScopes = useMemo(
    () => Object.fromEntries(SPLITS.map((split) => [split, buildMetricsScope(split, selectedGame, selectedPlayer)])) as Record<Split, ReturnType<typeof buildMetricsScope>>,
    [selectedGame, selectedPlayer],
  );
  const selectedMetricsKey = selectedPlayerId
    ? buildMetricsCacheKey(selectedPlayerId, selectedStat, selectedMetricsScope.scopeKey)
    : null;
  const selectedMetricsResource = selectedMetricsKey ? metricsBySelection[selectedMetricsKey] ?? null : null;
  const selectedMetricsFallbackResource = useMemo(() => {
    if (selectedMetricsResource || !selectedPlayerId) return selectedMetricsResource;
    const fallbackScope = buildMetricsScope(selectedSplit, selectedGame, selectedPlayer);
    const fallbackKey = buildMetricsCacheKey(selectedPlayerId, selectedStat, fallbackScope.scopeKey);
    return metricsBySelection[fallbackKey] ?? null;
  }, [metricsBySelection, selectedGame, selectedMetricsResource, selectedPlayer, selectedPlayerId, selectedSplit, selectedStat]);
  const selectedMetricsStatus = selectedMetricsKey ? metricsStatusBySelection[selectedMetricsKey] ?? 'idle' : 'idle';
  const selectedMetricsError = selectedMetricsKey ? metricsErrorBySelection[selectedMetricsKey] ?? null : null;
  const selectedMetricsWindow = selectedMetricsScope.window;
  const selectedMetricsOpponent = selectedMetricsScope.opponent;
  const selectedMetricsOpponentTeamId = selectedMetricsScope.opponentTeamId;
  const selectedMetricsGameId = selectedMetricsScope.gameId;
  const selectedMetricsScopeKey = selectedMetricsScope.scopeKey;
  const marketLocked = isLockedStat(selectedStat, plan);

  useEffect(() => {
    metricsStatusRef.current = metricsStatusBySelection;
  }, [metricsStatusBySelection]);

  useEffect(() => {
    const nowTs = Date.now();
    Object.entries(playersCacheRef.current).forEach(([key, entry]) => {
      if (entry.expiresAt <= nowTs) {
        delete playersCacheRef.current[Number(key)];
      }
    });
    Object.entries(metricsCacheRef.current).forEach(([key, entry]) => {
      if (entry.expiresAt <= nowTs) {
        delete metricsCacheRef.current[key];
      }
    });
  }, [selectedGameId, selectedPlayerId, selectedStat, selectedSplit]);

  useEffect(() => {
    if (searchParams.get('open') === 'checkout' && plan !== 'pro') {
      setUpgradeOpen(true);
    }
  }, [plan, searchParams]);

  useEffect(() => {
    const stripeCheckoutStatus = (searchParams.get('checkout') || '').toLowerCase();
    if (!stripeCheckoutStatus) return;

    if (consumedStripeReturnRef.current === stripeCheckoutStatus) {
      return;
    }

    if (stripeCheckoutStatus === 'success') {
      setCheckoutNotice('Pagamento recebido. Estamos confirmando sua assinatura Pro agora.');
    } else if (stripeCheckoutStatus === 'cancelled') {
      setCheckoutNotice('Pagamento cancelado. Sua sessão continua ativa e você pode tentar novamente quando quiser.');
    } else {
      setCheckoutNotice(null);
    }

    consumedStripeReturnRef.current = stripeCheckoutStatus;
    setCheckoutReturnStatus(stripeCheckoutStatus);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('checkout');
    params.delete('plan');
    const nextQuery = params.toString();
    const nextUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [pathname, searchParams]);

  useEffect(() => {
    const checkoutStatus = (searchParams.get('status') || '').toLowerCase();
    if (!checkoutStatus) return;
    if (consumedCheckoutStatusRef.current === checkoutStatus) return;

    if (checkoutStatus === 'success') {
      setCheckoutNotice('Pagamento recebido. Estamos confirmando sua assinatura Pro agora.');
      setCheckoutReturnStatus('success');
    } else if (checkoutStatus === 'pending') {
      setCheckoutNotice('Pagamento pendente. Assim que for confirmado, seu acesso será atualizado.');
      setCheckoutReturnStatus('pending');
    } else if (checkoutStatus === 'failure') {
      setCheckoutNotice('Pagamento não concluído. Você pode tentar novamente quando quiser.');
      setCheckoutReturnStatus('failure');
    } else {
      setCheckoutNotice(null);
      setCheckoutReturnStatus('');
    }
    consumedCheckoutStatusRef.current = checkoutStatus;
  }, [searchParams]);


  const dismissCheckoutNotice = useCallback(() => {
    setCheckoutNotice(null);
    setCheckoutReturnStatus('');
  }, []);

  useEffect(() => {
    if (checkoutReturnStatus !== 'success') return;
    let cancelled = false;

    const reconcile = async () => {
      const maxAttempts = 6;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const refreshed = await refreshBillingState();
        if (cancelled) return;
        if (refreshed.ok && refreshed.hasPro) {
          setCheckoutNotice('Pagamento confirmado e plano Pro ativado.');
          return;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      }

      if (!cancelled) {
        setCheckoutNotice('Pagamento recebido, mas a confirmação ainda está em processamento. Atualize em alguns instantes.');
      }
    };

    void reconcile();

    return () => {
      cancelled = true;
    };
  }, [checkoutReturnStatus, refreshBillingState]);

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
      const cachedPlayers = playersCacheRef.current[game.id];
      const hasFreshCache = Boolean(cachedPlayers && cachedPlayers.expiresAt > Date.now());

      if (!options?.force) {
        if (hasFreshCache) {
          const payload = cachedPlayers?.payload ?? [];
          const nextStatus = payload.length ? 'ready' : 'empty';
          playersStatusRef.current[game.id] = nextStatus;
          setPlayersByGame((prev) => (prev[game.id] === payload ? prev : { ...prev, [game.id]: payload }));
          setPlayersStatusByGame((prev) => (prev[game.id] === nextStatus ? prev : { ...prev, [game.id]: nextStatus }));
          return;
        }
        if (existingStatus === 'loading' || existingStatus === 'ready' || existingStatus === 'empty' || existingStatus === 'error') {
          return;
        }
        if (playersInFlightRef.current[game.id]) return;
      }

      const requestId = (playersRequestRef.current[game.id] ?? 0) + 1;
      playersRequestRef.current[game.id] = requestId;

      playersStatusRef.current[game.id] = 'loading';
      setPlayersStatusByGame((prev) => (prev[game.id] === 'loading' ? prev : { ...prev, [game.id]: 'loading' }));
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

        playersCacheRef.current[game.id] = {
          payload: mappedPlayers,
          expiresAt: Date.now() + PLAYERS_CACHE_TTL_MS,
        };
        const nextStatus = mappedPlayers.length ? 'ready' : 'empty';
        playersStatusRef.current[game.id] = nextStatus;
        setPlayersByGame((prev) => (prev[game.id] === mappedPlayers ? prev : { ...prev, [game.id]: mappedPlayers }));
        setPlayersStatusByGame((prev) => (prev[game.id] === nextStatus ? prev : { ...prev, [game.id]: nextStatus }));
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
    async (playerId: number, stat: Stat, options?: { force?: boolean; split?: Split; game?: Game | null; player?: Player | null; scope?: ReturnType<typeof buildMetricsScope> }) => {
      const resolvedSplit = options?.split ?? options?.scope?.split ?? 'L10';
      const scope = options?.scope ?? buildMetricsScope(resolvedSplit, options?.game ?? null, options?.player ?? null);
      const key = buildMetricsCacheKey(playerId, stat, scope.scopeKey);
      const existingStatus = metricsStatusRef.current[key];
      const cachedMetrics = metricsCacheRef.current[key];
      const hasFreshCache = Boolean(cachedMetrics && cachedMetrics.expiresAt > Date.now());
      const shouldFetch = options?.force || !(hasFreshCache || existingStatus === 'ready' || existingStatus === 'empty');

      if (!shouldFetch || existingStatus === 'loading') return;
      if (metricsInFlightRef.current[key]) return;

      const requestId = (metricsRequestRef.current[key] ?? 0) + 1;
      metricsRequestRef.current[key] = requestId;
      const query = new URLSearchParams({ playerId: String(playerId), stat, window: scope.window });
      if (scope.split === 'H2H') {
        if (!scope.opponent) {
          metricsStatusRef.current[key] = 'empty';
          setMetricsStatusBySelection((prev) => ({ ...prev, [key]: 'empty' }));
          setMetricsBySelection((prev) => ({ ...prev, [key]: { metrics: null, games: [] } }));
          return;
        }
        query.set('opponent', scope.opponent);
      } else if (scope.opponent) {
        query.set('opponent', scope.opponent);
      }
      if (scope.opponentTeamId) query.set('opponentTeamId', String(scope.opponentTeamId));
      if (scope.gameId) query.set('gameId', String(scope.gameId));

      metricsStatusRef.current[key] = 'loading';
      setMetricsStatusBySelection((prev) => (prev[key] === 'loading' ? prev : { ...prev, [key]: 'loading' }));
      setMetricsErrorBySelection((prev) => (prev[key] === null ? prev : { ...prev, [key]: null }));

      const request = (async () => {
        const result = await apiFetch<{ metrics: PlayerMetrics | null; games: PlayerGameSample[] }>(`/api/metrics?${query.toString()}`);

        if (metricsRequestRef.current[key] !== requestId) return;

        if (!result.ok) {
          metricsStatusRef.current[key] = 'error';
          setMetricsStatusBySelection((prev) => ({ ...prev, [key]: 'error' }));
          setMetricsErrorBySelection((prev) => ({ ...prev, [key]: result.message }));
          return;
        }

        const payload = {
          metrics: result.data.metrics ?? null,
          games: Array.isArray(result.data.games) ? result.data.games : [],
        };

        const nextStatus = payload.games.length || payload.metrics ? 'ready' : 'empty';
        metricsCacheRef.current[key] = {
          payload,
          expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
        };
        metricsStatusRef.current[key] = nextStatus;
        setMetricsBySelection((prev) => ({ ...prev, [key]: payload }));
        setMetricsStatusBySelection((prev) => ({ ...prev, [key]: nextStatus }));
      })();

      metricsInFlightRef.current[key] = request;
      try {
        await request;
      } finally {
        metricsInFlightRef.current[key] = null;
      }
    },
    [],
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
    const todayKey = getNBADayKey(new Date());
    const gamesForNBADay = nextGames.filter((game) => {
      const gameDateTime = buildGameDateTime(game);
      if (!gameDateTime) return false;
      const gameKey = getNBADayKey(gameDateTime);
      return gameKey === todayKey;
    });

    setGames(gamesForNBADay);

    if (!gamesForNBADay.length) {
      setSelectedGameId(null);
      setSelectedPlayerId(null);
      setGamesStatus('empty');
      return;
    }

    setSelectedGameId((current) => {
      if (current && gamesForNBADay.some((game) => game.id === current)) return current;
      if (initialGameId && gamesForNBADay.some((game) => game.id === initialGameId)) return initialGameId;
      return gamesForNBADay[0].id;
    });

    setGamesStatus('ready');
  }, [initialGameId]);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const queryParams = currentUrl.searchParams;
    const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
    const authMarkers = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'code', 'error', 'error_description', 'type'];
    captureAuthSessionFromUrl(currentUrl);

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
    if (!authBootstrapped) return;
    void loadGames();
  }, [authBootstrapped, loadGames]);

  useEffect(() => {
    let canceled = false;

    async function loadPlan() {
      const token = await ensureValidAccessToken();
      if (!token) {
        if (!canceled) {
          setPlan('free');
          setProfile(null);
          setBilling(null);
        }
        if (!canceled) setAuthBootstrapped(true);
        return;
      }

      if (!canceled) setAuthBootstrapped(true);

      const result = await apiFetch<{ profile?: ProfileData; billing?: BillingData }>('/api/profile');
      if (canceled) return;

      if (result.ok) {
        const resolvedPlan = result.data.profile?.plan === 'pro' ? 'pro' : 'free';
        setPlan(resolvedPlan);
        setProfile(result.data.profile ?? null);
        setBilling(result.data.billing ?? null);
        return;
      }

      if (checkoutReturnStatus === 'cancelled' || checkoutReturnStatus === 'success' || checkoutReturnStatus === 'pending') {
        await refreshBillingState();
      }

    }

    loadPlan();

    return () => {
      canceled = true;
    };
  }, [checkoutReturnStatus, refreshBillingState]);

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
      void loadMetricsForPlayer(selectedPlayerId, selectedStat, {
        scope: {
          split: selectedSplit,
          window: selectedMetricsWindow,
          opponent: selectedMetricsOpponent,
          opponentTeamId: selectedMetricsOpponentTeamId,
          gameId: selectedMetricsGameId,
          scopeKey: selectedMetricsScopeKey,
        },
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    loadMetricsForPlayer,
    marketLocked,
    selectedPlayerId,
    selectedStat,
    selectedSplit,
    selectedMetricsWindow,
    selectedMetricsOpponent,
    selectedMetricsOpponentTeamId,
    selectedMetricsGameId,
    selectedMetricsScopeKey,
  ]);

  useEffect(() => {
    if (!selectedPlayerId || marketLocked || view !== 'detail') return;
    const timer = window.setTimeout(() => {
      SPLITS.forEach((split) => {
        const scope = splitScopes[split];
        if (!scope) return;
        void loadMetricsForPlayer(selectedPlayerId, selectedStat, { scope });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMetricsForPlayer, marketLocked, selectedPlayerId, selectedStat, splitScopes, view]);

  useEffect(() => {
    syncQueryString({ gameId: selectedGameId, stat: selectedStat, playerId: selectedPlayer ? selectedPlayerId : null, mode: view });
  }, [selectedGameId, selectedPlayer, selectedPlayerId, selectedStat, syncQueryString, view]);

  const authTokenMissing = typeof window !== 'undefined' && !readStoredAuthSession()?.accessToken;

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
      const token = await ensureValidAccessToken();
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
      const token = await ensureValidAccessToken();
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
      const token = await ensureValidAccessToken();
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
      const token = await ensureValidAccessToken();
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

  const handleReferralInputFocus = useCallback((event: FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    window.setTimeout(() => {
      input.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  }, []);

  const getSplitPctClassName = useCallback((value: string) => {
    const pct = Number.parseInt(value.replace('%', ''), 10);
    if (!Number.isFinite(pct)) return '';
    if (pct >= 50) return styles.splitPctHigh;
    return styles.splitPctLow;
  }, []);

  const showChartValueLabels = useMemo(() => {
    if (selectedSplit === 'Season') return false;
    if (!isDesktopCheckoutViewport && selectedSplit === 'L30') return false;
    return true;
  }, [isDesktopCheckoutViewport, selectedSplit]);
  const hideChartDateLabels = useMemo(() => {
    if (isDesktopCheckoutViewport) return selectedSplit === 'Season';
    return selectedSplit === 'L20' || selectedSplit === 'L30' || selectedSplit === 'Season';
  }, [isDesktopCheckoutViewport, selectedSplit]);

  const playerDetailModel = useMemo(() => {
    if (!selectedPlayer) return null;
    const payload = selectedMetricsResource ?? selectedMetricsFallbackResource;
    const scopedGames = (payload?.games ?? []).map((sample) => ({
      date: sample.date,
      value: Number(sample.value ?? 0),
      minutes: Number(sample.minutes ?? 0),
    }))
      .sort((a, b) => compareCalendarDateDesc(a.date, b.date));
    const games = scopedGames;
    const values = games.map((sample) => sample.value);
    const lineBase = Number(payload?.metrics?.line ?? payload?.metrics?.avg_l10 ?? 0);
    const apiLine = Number.isFinite(lineBase) && lineBase > 0 ? Math.round(lineBase * 2) / 2 : 0.5;
    const line = Math.max(0, apiLine + lineAdjustment);
    const selectedAverage = Number(payload?.metrics?.selected_avg);
    const average = Number.isFinite(selectedAverage)
      ? selectedAverage
      : values.length
        ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1))
        : null;
    const bars: PlayerDetailChartBar[] = games.slice().reverse().map((sample) => {
      const tone: ChartBarTone = sample.value >= line ? 'hit' : 'miss';
      const label = formatCalendarDateLabel(sample.date);
      return { ...sample, tone, label };
    });
    const splitMetrics: PlayerDetailSplitMetric[] = SPLITS.map((split) => {
      if (!selectedPlayerId) return { label: split, value: '—', note: 'Sem dados' };
      const scope = splitScopes[split];
      const cacheKey = buildMetricsCacheKey(selectedPlayerId, selectedStat, scope.scopeKey);
      const splitPayload = metricsBySelection[cacheKey];
      const gamesForSplit = (splitPayload?.games ?? [])
        .map((sample) => Number(sample.value ?? 0))
        .filter((value) => Number.isFinite(value));
      const sampleSizeFromMetrics = Number(splitPayload?.metrics?.sample_size);
      const sampleSize = Number.isFinite(sampleSizeFromMetrics) && sampleSizeFromMetrics > 0
        ? Math.round(sampleSizeFromMetrics)
        : gamesForSplit.length;
      if (sampleSize > 0) {
        const hitsFromGames = gamesForSplit.filter((value) => value >= line).length;
        const selectedHitRate = Number(splitPayload?.metrics?.selected_hit_rate);
        const hits = gamesForSplit.length === sampleSize
          ? hitsFromGames
          : Number.isFinite(selectedHitRate)
            ? Math.round((selectedHitRate / 100) * sampleSize)
            : hitsFromGames;
        const safeHits = Math.max(0, Math.min(sampleSize, hits));
        const hitRate = Math.round((safeHits / sampleSize) * 100);
        return { label: split, value: `${hitRate}%`, note: `${safeHits}/${sampleSize}` };
      }
      return { label: split, value: '—', note: 'Sem dados' };
    });
    const summaryMetricMap: Record<string, PlayerDetailSplitMetric> = {};
    splitMetrics.forEach((metric) => {
      summaryMetricMap[metric.label] = metric;
    });
    const summaryMetrics: PlayerDetailSplitMetric[] = SPLIT_CARD_ORDER.map((split) =>
      summaryMetricMap[split] ?? { label: split, value: '—', note: 'Sem dados' });
    return {
      allGames: scopedGames,
      games,
      line,
      average,
      bars,
      summaryMetrics,
      metrics: payload?.metrics ?? null,
      splitMetrics,
    };
  }, [lineAdjustment, metricsBySelection, selectedMetricsFallbackResource, selectedMetricsResource, selectedPlayer, selectedPlayerId, selectedStat, splitScopes]);

  const topTitle = useMemo(() => {
    if (view === 'profile') return 'Meu Perfil';
    if (view === 'detail') return null;
    if (view === 'players') return selectedGame ? `${selectedGame.away_team} vs ${selectedGame.home_team}` : 'Jogadores';
    return 'Jogos de Hoje';
  }, [selectedGame, view]);

  const canGoBack = view === 'players' || view === 'detail';
  const activeSidebarKey = view === 'profile' ? 'perfil' : 'dashboard';
  const profileSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const profileName = profile?.name?.trim() || 'Usuário';
  const profileEmail = profile?.email?.trim() || 'E-mail não disponível';
  const profileInitial = profileName.slice(0, 1).toUpperCase();
  const profilePlanLabel = plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito';
  const canManageSubscription = plan === 'pro';

  const handleLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      const token = getAuthToken();
      if (token) {
        void fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'logout' }),
        });
      }
      clearAuthSession();
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
            <button type="button" className={styles.accountSummary} data-close-mobile-sidebar="true" onClick={() => setView('profile')}>
              <div className={styles.accountAvatar}>{profileInitial}</div>
              <div className={styles.accountMeta}>
                <strong>{profileName}</strong>
                <span>{profilePlanLabel}</span>
              </div>
            </button>
          )}
        />
      )}
      mobileSidebar={(
        <MobileSidebar
          items={sidebarItems}
          activeKey={activeSidebarKey}
          onItemClick={(item) => setView(item.key === 'perfil' ? 'profile' : 'games')}
          footer={(
            <button type="button" className={styles.accountSummary} data-close-mobile-sidebar="true" onClick={() => setView('profile')}>
              <div className={styles.accountAvatar}>{profileInitial}</div>
              <div className={styles.accountMeta}>
                <strong>{profileName}</strong>
                <span>{profilePlanLabel}</span>
              </div>
            </button>
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
          {view === 'games' && !showDesktopCheckoutView ? (
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
                        <div className={styles.teamColumn}>
                          <div className={styles.teamBadge}>
                            {game.away_logo ? <img src={game.away_logo} alt={game.away_team} loading="lazy" /> : shortTeamName(game.away_team)}
                          </div>
                          <span>{game.away_team}</span>
                        </div>
                        <div className={styles.gameVs}>X</div>
                        <div className={styles.teamColumn}>
                          <div className={styles.teamBadge}>
                            {game.home_logo ? <img src={game.home_logo} alt={game.home_team} loading="lazy" /> : shortTeamName(game.home_team)}
                          </div>
                          <span>{game.home_team}</span>
                        </div>
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

          {view === 'players' && !showDesktopCheckoutView ? (
            <section className={`${styles.playersView} ${styles.viewPanel}`}>
              <div className={styles.playersTopbar}>
                <h2>Jogadores</h2>
              </div>

              <div className={styles.detailTabsRow}>
                <TabsRoot value={selectedStat} onValueChange={handleStatChange}>
                  <div className={styles.statsTabsScroller}>
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
                        {players.map((player) => (
                          <button
                            key={player.id}
                            className={styles.playerRow}
                            type="button"
                            onClick={() => {
                              setSelectedPlayerId(player.id);
                              setLineAdjustment(0);
                              setView('detail');
                            }}
                          >
                            <div className={styles.playerRowMobile}>
                              <div className={styles.playerMobileLeft}>
                                <PlayerAvatar playerName={player.name} />
                                <div className={styles.playerMobileIdentity}>
                                  <p className={styles.playerName}>{player.name}</p>
                                  <p className={styles.playerMeta}>{player.position} • {player.team}</p>
                                </div>
                              </div>
                            </div>

                            <div className={styles.playerRowDesktop}>
                              <div className={styles.playerMain}>
                                <div className={styles.playerIdentityWrap}>
                                  <PlayerAvatar playerName={player.name} />
                                  <div className={styles.playerIdentity}>
                                    <p className={styles.playerName}>{player.name}</p>
                                    <p className={styles.playerMeta}>{player.position} • {player.team}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </TabsContent>
                </TabsRoot>
              </div>
            </section>
          ) : null}

          {view === 'detail' && selectedPlayer && !showDesktopCheckoutView ? (
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
                <div className={styles.playerIdentityWrap}>
                  <div>
                    <p className={styles.playerHeroMeta}>{selectedPlayer.team} • {selectedPlayer.position}</p>
                    <h2 className={styles.playerHeroName}>{selectedPlayer.name}</h2>
                  </div>
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

              {selectedMetricsStatus === 'loading' && !playerDetailModel ? (
                <Surface className={styles.statePanelInline}><p className={styles.stateText}>Carregando métricas e histórico...</p></Surface>
              ) : null}
              {selectedMetricsStatus === 'loading' && playerDetailModel ? (
                <Surface className={styles.statePanelInline}><p className={styles.stateText}>Atualizando dados...</p></Surface>
              ) : null}
              {selectedMetricsStatus === 'error' ? (
                <EmptyState
                  heading="Não foi possível carregar o detalhe do jogador"
                  description={selectedMetricsError || 'Tente novamente em instantes.'}
                  action={selectedPlayerId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => loadMetricsForPlayer(selectedPlayerId, selectedStat, { force: true, split: selectedSplit, game: selectedGame, player: selectedPlayer })}
                    >
                      <RefreshCw size={14} /> Recarregar
                    </Button>
                  ) : null}
                />
              ) : null}
              {selectedMetricsStatus === 'empty' ? (
                <Surface className={styles.statePanelInline}><p className={styles.stateText}>Sem histórico suficiente para este mercado.</p></Surface>
              ) : null}

              {playerDetailModel ? (
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
                            <XAxis
                              dataKey="label"
                              hide={hideChartDateLabels}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: 'var(--lc-muted)', fontSize: 11 }}
                            />
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
                              content={() => null}
                              wrapperStyle={{ display: 'none' }}
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
                              {showChartValueLabels ? (
                                <LabelList dataKey="value" position="insideBottom" offset={14} fill="#000000" fontSize={10} />
                              ) : null}
                              {playerDetailModel.bars.map((bar, index) => (
                                <Cell
                                  key={`${bar.label}-${index}`}
                                  fill={bar.tone === 'hit' ? '#24e880' : '#d7263d'}
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

          {view === 'profile' && !showDesktopCheckoutView ? (
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

          {(errorMessage || oauthQueryError) && !showDesktopCheckoutView ? (
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
          {checkoutNotice && !showDesktopCheckoutView ? (
            <Surface className={`${styles.errorBox} ${styles.infoBanner}`}>
              <div className={styles.errorContent}>
                <Crown size={16} />
                <p>{checkoutNotice}</p>
              </div>
              {checkoutNotice ? (
                <Button variant="secondary" size="sm" onClick={dismissCheckoutNotice} aria-label="Fechar aviso de checkout">
                  Fechar
                </Button>
              ) : null}
            </Surface>
          ) : null}

          {upgradeOpen ? (
            <>
              <Surface className={styles.upgradeDesktopInline}>
                <button type="button" className={styles.upgradeCloseInline} onClick={() => setUpgradeOpen(false)} aria-label="Fechar">
                  <X size={16} />
                </button>
                <header className={styles.upgradeDesktopHeader}>
                  <p className={styles.upgradeKicker}>Checkout Pro</p>
                  <h3>SEJA PRO</h3>
                  <p className={styles.upgradeSubtitle}>Assinatura técnica para leitura completa da rodada NBA.</p>
                </header>
                {plan === 'pro' ? (
                  <div className={styles.upgradeDesktopPro}>
                    <p className={styles.upgradeSubtitle}>
                      {billing?.playoffPackActive
                        ? 'Plano atual: Pack Playoff ativo.'
                        : billing?.isPaidPro
                          ? 'Plano atual: PRO pago ativo.'
                          : 'Plano atual: PRO ativo.'}
                    </p>
                    {canManageSubscription ? (
                      <Button size="lg" onClick={handleManageSubscription} disabled={manageLoading}>
                        {manageLoading ? 'Abrindo portal...' : 'Gerenciar assinatura'}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <section className={styles.upgradePlansDesktopGrid}>
                      <button type="button" className={`${styles.upgradePlanBtn} ${upgradePlan === 'monthly' ? styles.isSelected : ''}`} onClick={() => setUpgradePlan('monthly')}>
                        <span>Mensal</span>
                        <strong>R$24,90/mês</strong>
                        <small>2 dias de teste grátis no mensal.</small>
                      </button>
                      <button type="button" className={`${styles.upgradePlanBtn} ${styles.upgradePlanAnnual} ${upgradePlan === 'annual' ? styles.isSelected : ''}`} onClick={() => setUpgradePlan('annual')}>
                        <span>Anual</span>
                        <strong>R$197/ano</strong>
                        <small>Equivale a R$16,41/mês · melhor custo-benefício.</small>
                        <em className={styles.upgradePopular}>Mais popular</em>
                      </button>
                      <button type="button" className={`${styles.upgradePlanBtn} ${upgradePlan === 'playoff' ? styles.isSelected : ''}`} onClick={() => setUpgradePlan('playoff')}>
                        <span>Pack Playoff</span>
                        <strong>R$ 29,90</strong>
                        <small>Compra única para o período decisivo dos playoffs.</small>
                      </button>
                    </section>

                    <section className={styles.upgradeDesktopLower}>
                      <div className={styles.upgradeBenefits}>
                        <p>Recursos liberados</p>
                        <ul className={styles.upgradeBenefitsGrid}>
                          <li><span>Todos os jogos da rodada</span><ChevronRight size={14} /></li>
                          <li><span>Todos os jogadores liberados</span><ChevronRight size={14} /></li>
                          <li><span>Estatísticas avançadas (H2H, L20)</span><ChevronRight size={14} /></li>
                          <li><span>Ajuste de linha</span><ChevronRight size={14} /></li>
                          <li><span>Suporte prioritário</span><ChevronRight size={14} /></li>
                        </ul>
                      </div>
                      <div className={styles.upgradeDesktopSide}>
                        <section className={styles.upgradeReferral}>
                          <p>Código de indicação <small>(opcional)</small></p>
                          <label className={styles.upgradeField}>
                            <input
                              value={upgradeCode}
                              onChange={(event) => setUpgradeCode(event.target.value.toUpperCase())}
                              onFocus={handleReferralInputFocus}
                              placeholder="Digite seu código"
                              maxLength={20}
                            />
                          </label>
                        </section>
                        <section className={styles.upgradeSecurity}>
                          <small>Segurança</small>
                          <p>Checkout seguro com confirmação automática de acesso após pagamento.</p>
                        </section>
                        <footer className={styles.upgradeFooterDesktop}>
                          <Button size="lg" onClick={startCheckout} disabled={upgradeLoading}>
                            {upgradeLoading ? 'Abrindo checkout...' : 'ASSINAR AGORA'}
                          </Button>
                          <p className={styles.upgradeSupportLine}>ECONOMIZE 34% NO PLANO ANUAL</p>
                        </footer>
                      </div>
                    </section>
                  </>
                )}
                {upgradeError ? <p className={styles.upgradeError}>{upgradeError}</p> : null}
              </Surface>

              <div
                className={styles.upgradeOverlay}
                role="dialog"
                aria-modal="true"
                aria-label="Assinar plano Pro"
                onClick={() => setUpgradeOpen(false)}
              >
                <Surface className={styles.upgradeModal} onClick={(event) => event.stopPropagation()}>
                  <button type="button" className={styles.upgradeClose} onClick={() => setUpgradeOpen(false)} aria-label="Fechar">
                    <X size={16} />
                  </button>
                  {plan === 'pro' ? (
                    <div className={styles.upgradeSheet}>
                      <header className={styles.upgradeSheetHeader}>
                        <p className={styles.upgradeKicker}>LinhaCash Pro</p>
                        <h3>PRO ativo</h3>
                        <p className={styles.upgradeSubtitle}>
                          {billing?.playoffPackActive
                            ? 'Plano atual: Pack Playoff ativo.'
                            : billing?.isPaidPro
                              ? 'Plano atual: PRO pago ativo.'
                              : 'Plano atual: PRO ativo.'}
                        </p>
                      </header>
                      <footer className={styles.upgradeFooter}>
                        {canManageSubscription ? (
                          <Button size="lg" onClick={handleManageSubscription} disabled={manageLoading}>
                            {manageLoading ? 'Abrindo portal...' : 'Gerenciar assinatura'}
                          </Button>
                        ) : null}
                      </footer>
                    </div>
                  ) : (
                    <div className={styles.upgradeSheet}>
                      <header className={styles.upgradeSheetHeader}>
                        <p className={styles.upgradeKicker}>LinhaCash Pro</p>
                        <h3>SEJA PRO</h3>
                        <p className={styles.upgradeSubtitle}>Assinatura técnica para leitura completa da rodada NBA.</p>
                      </header>

                      <div className={styles.upgradeSheetBody}>
                        <section className={styles.upgradePlanSelector}>
                          <label className={`${styles.upgradePlanChip} ${upgradePlan === 'monthly' ? styles.isSelected : ''}`}>
                            <input
                              type="radio"
                              name="upgrade-plan-mobile"
                              checked={upgradePlan === 'monthly'}
                              onChange={() => setUpgradePlan('monthly')}
                            />
                            <span>Mensal</span>
                          </label>
                          <label className={`${styles.upgradePlanChip} ${styles.upgradePlanChipAnnual} ${upgradePlan === 'annual' ? styles.isSelected : ''}`}>
                            <input
                              type="radio"
                              name="upgrade-plan-mobile"
                              checked={upgradePlan === 'annual'}
                              onChange={() => setUpgradePlan('annual')}
                            />
                            <span>Anual</span>
                            <em className={styles.upgradePopular}>Mais popular</em>
                          </label>
                          <label className={`${styles.upgradePlanChip} ${upgradePlan === 'playoff' ? styles.isSelected : ''}`}>
                            <input
                              type="radio"
                              name="upgrade-plan-mobile"
                              checked={upgradePlan === 'playoff'}
                              onChange={() => setUpgradePlan('playoff')}
                            />
                            <span>Pack Playoff</span>
                          </label>
                        </section>

                      <section className={styles.upgradePriceHighlight}>
                        <small>{upgradePlan === 'monthly' ? 'PLANO MENSAL PRO' : upgradePlan === 'annual' ? 'PLANO ANUAL PRO' : 'PACK PLAYOFF'}</small>
                        <strong>{upgradePlan === 'monthly' ? 'R$ 24,90' : upgradePlan === 'annual' ? 'R$ 197,00' : 'R$ 29,90'}</strong>
                        <p>{upgradePlan === 'monthly' ? '2 dias de teste grátis no mensal.' : upgradePlan === 'annual' ? 'Equivale a R$16,41/mês · melhor custo-benefício.' : 'Compra única para o período decisivo dos playoffs.'}</p>
                      </section>

                      <section className={styles.upgradeBenefits}>
                        <p>Recursos liberados</p>
                        <ul className={styles.upgradeBenefitsGrid}>
                          <li><span>Todos os jogos da rodada</span><ChevronRight size={14} /></li>
                          <li><span>Todos os jogadores liberados</span><ChevronRight size={14} /></li>
                          <li><span>Estatísticas avançadas (H2H, L20)</span><ChevronRight size={14} /></li>
                          <li><span>Ajuste de linha</span><ChevronRight size={14} /></li>
                          <li><span>Suporte prioritário</span><ChevronRight size={14} /></li>
                        </ul>
                      </section>

                      <section className={styles.upgradeReferral}>
                        <p>Código de indicação <small>(opcional)</small></p>
                        <label className={styles.upgradeField}>
                          <input
                            value={upgradeCode}
                            onChange={(event) => setUpgradeCode(event.target.value.toUpperCase())}
                            onFocus={handleReferralInputFocus}
                            placeholder="Digite seu código"
                            maxLength={20}
                          />
                        </label>
                      </section>
                      </div>

                      <footer className={styles.upgradeFooter}>
                        <Button size="lg" onClick={startCheckout} disabled={upgradeLoading}>
                          {upgradeLoading ? 'Abrindo checkout...' : 'ASSINAR AGORA'}
                        </Button>
                        <p className={styles.upgradeSupportLine}>ECONOMIZE 34% NO PLANO ANUAL</p>
                      </footer>
                    </div>
                  )}
                  {upgradeError ? <p className={styles.upgradeError}>{upgradeError}</p> : null}
                </Surface>
              </div>
            </>
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
