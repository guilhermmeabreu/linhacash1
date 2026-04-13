export type ApiSportsGame = {
  id: number;
  date?: { start?: string | null };
  teams?: {
    home?: { id?: number; name?: string; logo?: string | null };
    visitors?: { id?: number; name?: string; logo?: string | null };
  };
  status?: { long?: string | null };
};

export type ApiSportsPlayer = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  photo?: string | null;
  leagues?: { standard?: { pos?: string | null } };
};

export type ApiSportsPlayerStat = {
  game?: { date?: string | null };
  team?: { name?: string | null };
  points?: number | null;
  totReb?: number | null;
  assists?: number | null;
  tpm?: number | null;
  fgm?: number | null;
  fga?: number | null;
  min?: string | null;
  steals?: number | null;
  blocks?: number | null;
  p2a?: number | null;
  p3a?: number | null;
};

type MockTeam = {
  id: number;
  name: string;
  logo: string;
  short: string;
};

const MOCK_TEAMS: MockTeam[] = [
  { id: 1, name: 'Boston Celtics', logo: 'https://cdn.nba.mock/teams/bos.png', short: 'BOS' },
  { id: 2, name: 'Milwaukee Bucks', logo: 'https://cdn.nba.mock/teams/mil.png', short: 'MIL' },
  { id: 3, name: 'Miami Heat', logo: 'https://cdn.nba.mock/teams/mia.png', short: 'MIA' },
  { id: 4, name: 'Philadelphia 76ers', logo: 'https://cdn.nba.mock/teams/phi.png', short: 'PHI' },
  { id: 5, name: 'Denver Nuggets', logo: 'https://cdn.nba.mock/teams/den.png', short: 'DEN' },
  { id: 6, name: 'Los Angeles Lakers', logo: 'https://cdn.nba.mock/teams/lal.png', short: 'LAL' },
  { id: 7, name: 'Golden State Warriors', logo: 'https://cdn.nba.mock/teams/gsw.png', short: 'GSW' },
  { id: 8, name: 'Dallas Mavericks', logo: 'https://cdn.nba.mock/teams/dal.png', short: 'DAL' },
  { id: 9, name: 'New York Knicks', logo: 'https://cdn.nba.mock/teams/nyk.png', short: 'NYK' },
  { id: 10, name: 'Cleveland Cavaliers', logo: 'https://cdn.nba.mock/teams/cle.png', short: 'CLE' },
];

const FIRST_NAMES = ['Jalen', 'Jayson', 'Donovan', 'Nikola', 'Tyrese', 'Stephen', 'Jimmy', 'Anthony', 'Luka', 'Kyrie', 'Jrue', 'Paolo'];
const LAST_NAMES = ['Brown', 'Tatum', 'Mitchell', 'Jokic', 'Maxey', 'Curry', 'Butler', 'Davis', 'Doncic', 'Irving', 'Holiday', 'Banchero'];
const POSITIONS = ['G', 'G', 'G', 'F', 'C', 'F', 'G', 'F', 'C', 'G'];

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function rng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function teamById(teamId: number): MockTeam {
  return MOCK_TEAMS.find((team) => team.id === teamId) || MOCK_TEAMS[0];
}

function createPlayersForTeam(teamId: number): ApiSportsPlayer[] {
  return Array.from({ length: 10 }, (_, index) => {
    const seed = hash(`${teamId}:${index}`);
    const first = FIRST_NAMES[(seed + index) % FIRST_NAMES.length];
    const last = LAST_NAMES[(seed + teamId + index) % LAST_NAMES.length];
    const playerId = teamId * 100 + (index + 1);

    return {
      id: playerId,
      firstname: first,
      lastname: last,
      photo: `https://cdn.nba.mock/players/${playerId}.png`,
      leagues: { standard: { pos: POSITIONS[index % POSITIONS.length] } },
    };
  });
}

function createGamesByDate(date: string): ApiSportsGame[] {
  const daySeed = hash(date);
  const dailyRng = rng(daySeed);
  const shuffledTeams = [...MOCK_TEAMS].sort(() => dailyRng() - 0.5);
  const today = toDateOnly(new Date());

  return Array.from({ length: 5 }, (_, index) => {
    const home = shuffledTeams[index * 2];
    const away = shuffledTeams[index * 2 + 1];
    const gameId = Number(date.replace(/-/g, '')) * 10 + index;
    const status = date < today ? 'Finished' : date > today ? 'Scheduled' : 'In Play';

    return {
      id: gameId,
      date: { start: `${date}T${String(20 + (index % 3)).padStart(2, '0')}:00:00.000Z` },
      teams: {
        home: { id: home.id, name: home.name, logo: home.logo },
        visitors: { id: away.id, name: away.name, logo: away.logo },
      },
      status: { long: status },
    };
  });
}

function createPlayerStats(playerId: number): ApiSportsPlayerStat[] {
  const teamId = Math.floor(playerId / 100);
  const roleIndex = playerId % 10;
  const isGuard = roleIndex <= 3;
  const isBig = roleIndex >= 7;

  const basePoints = isGuard ? 23 : isBig ? 17 : 20;
  const baseRebounds = isBig ? 10 : isGuard ? 4 : 7;
  const baseAssists = isGuard ? 7 : isBig ? 3 : 5;
  const baseMinutes = isBig ? 31 : 34;

  return Array.from({ length: 36 }, (_, gameIndex) => {
    const gameDate = addDays(new Date(), -(gameIndex + 1) * 2);
    const date = toDateOnly(gameDate);
    const random = rng(hash(`${playerId}:${gameIndex}`));

    const opponentPool = MOCK_TEAMS.filter((candidate) => candidate.id !== teamId);
    const opponent = opponentPool[(gameIndex + Math.floor(random() * opponentPool.length)) % opponentPool.length];

    const minutes = clamp(Math.round(baseMinutes + (random() - 0.5) * 10), 18, 40);
    const points = clamp(Math.round(basePoints + (random() - 0.5) * 16), 4, 48);
    const rebounds = clamp(Math.round(baseRebounds + (random() - 0.5) * 8), 0, 22);
    const assists = clamp(Math.round(baseAssists + (random() - 0.5) * 8), 0, 15);
    const steals = clamp(Math.round(1 + random() * 3), 0, 5);
    const blocks = clamp(Math.round((isBig ? 1.5 : 0.6) + random() * 2), 0, 5);
    const p3a = clamp(Math.round((isGuard ? 7 : 4) + (random() - 0.5) * 6), 0, 14);
    const tpm = clamp(Math.round(p3a * (0.26 + random() * 0.28)), 0, p3a);
    const p2a = clamp(Math.round((isBig ? 12 : 8) + (random() - 0.5) * 8), 1, 22);
    const fga = p2a + p3a;
    const fgm = clamp(Math.round(points / 2 + (random() - 0.5) * 3), 1, fga);

    return {
      game: { date: `${date}T00:00:00.000Z` },
      team: { name: opponent.name },
      points,
      totReb: rebounds,
      assists,
      tpm,
      fgm,
      fga,
      min: `${String(minutes).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}`,
      steals,
      blocks,
      p2a,
      p3a,
    };
  });
}

export const nbaMockProvider = {
  async getGamesByDate(date: string): Promise<ApiSportsGame[]> {
    return createGamesByDate(date);
  },

  async getPlayersByTeam(teamId: number): Promise<ApiSportsPlayer[]> {
    return createPlayersForTeam(teamId);
  },

  async getPlayerStatistics(playerId: number): Promise<ApiSportsPlayerStat[]> {
    return createPlayerStats(playerId);
  },

  getTeamName(teamId: number): string {
    return teamById(teamId).name;
  },
};
