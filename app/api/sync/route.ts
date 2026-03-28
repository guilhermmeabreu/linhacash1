import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import https from 'https';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const API_KEY = process.env.NBA_API_KEY!;
const BASE_URL = 'v2.nba.api-sports.io';
const SEASON = 2025;
const SEASON_STATS = 2024;

const logs: string[] = [];
function log(msg: string) {
  console.log(msg);
  logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`);
}

function apiGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = { hostname: BASE_URL, path, headers: { 'x-apisports-key': API_KEY } };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function fetchGames() {
  const now = new Date();
  const brOffset = -3 * 60 * 60 * 1000;
  const nowBR = new Date(now.getTime() + brOffset);
  const brDate = nowBR.toISOString().split('T')[0];

  // Busca 3 dias UTC para garantir cobertura total
  // (jogos de 21h BRT aparecem como dia seguinte na API UTC)
  const dates = [
    new Date(now.getTime() - 24*60*60*1000).toISOString().split('T')[0],
    now.toISOString().split('T')[0],
    new Date(now.getTime() + 24*60*60*1000).toISOString().split('T')[0]
  ];

  log(`Buscando jogos para ${brDate} BRT (buscando datas UTC: ${dates.join(', ')})`);

  const results = await Promise.all(dates.map((d: string) => apiGet(`/games?date=${d}`)));
  const allGames = results.flatMap((r: any) => r.response || []);

  // Remove duplicatas por ID
  const seen = new Set();
  const unique = allGames.filter((g: any) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  // Filtra jogos cujo horário BRT cai no dia correto
  // Ex: 00:00 UTC = 21:00 BRT do dia anterior
  const filtered = unique.filter((g: any) => {
    const gameTimeBR = new Date(new Date(g.date.start).getTime() + brOffset);
    const gameDateBR = gameTimeBR.toISOString().split('T')[0];
    return gameDateBR === brDate;
  });

  log(`Encontrados ${unique.length} jogos no total, ${filtered.length} são do dia ${brDate} BRT`);

  // Log detalhado para debug
  unique.slice(0, 5).forEach((g: any) => {
    const gameTimeBR = new Date(new Date(g.date.start).getTime() + brOffset);
    const gameDateBR = gameTimeBR.toISOString().split('T')[0];
    const gameHourBR = gameTimeBR.toISOString().slice(11, 16);
    log(`  Jogo: ${g.teams.home.name} vs ${g.teams.visitors.name} | UTC: ${g.date.start} | BRT: ${gameDateBR} ${gameHourBR} | Match: ${gameDateBR === brDate}`);
  });

  if (filtered.length === 0) { log('Nenhum jogo hoje (BR).'); return []; }

  const games = filtered.map((g: any) => ({
    game_date: brDate,
    home_team: g.teams.home.name, away_team: g.teams.visitors.name,
    home_team_id: g.teams.home.id, away_team_id: g.teams.visitors.id,
    home_logo: g.teams.home.logo || null, away_logo: g.teams.visitors.logo || null,
    game_time: g.date.start, status: g.status.long
  }));

  const { error } = await supabase.from('games').upsert(games, { onConflict: 'game_date,home_team,away_team' });
  if (error) log(`Erro jogos: ${error.message}`);
  else log(`${games.length} jogos salvos para ${brDate}!`);
  return filtered;
}

async function fetchPlayers(teamId: number) {
  const data = await apiGet(`/players?team=${teamId}&season=${SEASON_STATS}`);
  if (!data.response || data.response.length === 0) return [];
  const players = data.response.map((p: any) => ({
    api_id: p.id, name: `${p.firstname} ${p.lastname}`,
    team: p.teams?.[0]?.name || '', team_id: teamId,
    position: p.leagues?.standard?.pos || ''
  }));
  await supabase.from('players').upsert(players, { onConflict: 'api_id' });
  log(`${players.length} jogadores time ${teamId} salvos!`);
  return players;
}

async function fetchPlayerStats(playerId: number, apiPlayerId: number) {
  const data = await apiGet(`/players/statistics?id=${apiPlayerId}&season=${SEASON_STATS}`);
  if (!data.response || data.response.length === 0) return;
  const stats = data.response.slice(0, 20).map((s: any) => ({
    player_id: playerId, game_date: s.game?.date || null,
    opponent: s.team?.name || '', is_home: true,
    points: s.points || 0, rebounds: s.totReb || 0,
    assists: s.assists || 0, three_pointers: s.tpm || 0,
    fgm: s.fgm || 0,
    fga: s.fga || 0,
    minutes: parseInt(s.min) || 0
  }));
  await supabase.from('player_stats').upsert(stats);
}

async function calcMetrics(playerId: number) {
  const { data: stats } = await supabase.from('player_stats').select('*')
    .eq('player_id', playerId).order('game_date', { ascending: false }).limit(20);
  if (!stats || stats.length === 0) return;
  const calc = (arr: number[]) => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;
  for (const stat of ['points', 'rebounds', 'assists', 'three_pointers', 'fgm', 'fga']) {
    const all = stats.map((s: any) => s[stat] || 0);
    const home = stats.filter((s: any) => s.is_home).map((s: any) => s[stat] || 0);
    const away = stats.filter((s: any) => !s.is_home).map((s: any) => s[stat] || 0);
    const avg_l5 = calc(all.slice(0, 5)), avg_l10 = calc(all.slice(0, 10));
    const avg_l20 = calc(all), avg_home = calc(home), avg_away = calc(away);
    const line = avg_l10;
    const hit_rate = line > 0 ? parseFloat((all.slice(0, 10).filter((v: number) => v > line).length / Math.min(all.length, 10) * 100).toFixed(1)) : 0;
    await supabase.from('player_metrics').upsert({
      player_id: playerId, stat, avg_l5, avg_l10, avg_l20, avg_home, avg_away,
      avg_minutes_l5: calc(stats.slice(0, 5).map((s: any) => s.minutes)),
      line, updated_at: new Date().toISOString()
    }, { onConflict: 'player_id,stat' });
    await supabase.from('player_props_cache').upsert({
      player_id: playerId, stat, line, avg_l5, avg_l10, avg_l20, avg_home, avg_away,
      hit_rate, updated_at: new Date().toISOString()
    }, { onConflict: 'player_id,stat' });
  }
}

async function saveLog(status: string, games: number, errors: string[]) {
  try {
    await supabase.from('sync_logs').insert({
      status, games_synced: games,
      log: logs.join('\n'),
      errors: errors.join('\n') || null,
      created_at: new Date().toISOString()
    });
  } catch (e) { console.error('Erro ao salvar log:', e); }
}

export async function GET() {
  logs.length = 0;
  const errors: string[] = [];
  let gamesCount = 0;

  try {
    log('=== LinhaCash Sync Iniciado ===');
    const games = await fetchGames();
    gamesCount = games.length;
    if (games.length === 0) {
      await saveLog('no_games', 0, []);
      return NextResponse.json({ message: 'Nenhum jogo hoje', logs });
    }

    const teamIds = new Set<number>();
    games.forEach((g: any) => { teamIds.add(g.teams.home.id); teamIds.add(g.teams.visitors.id); });

    for (const teamId of teamIds) {
      try {
        const players = await fetchPlayers(teamId);
        for (const player of players) {
          try {
            const { data } = await supabase.from('players').select('id').eq('api_id', player.api_id).single();
            if (data) { await fetchPlayerStats(data.id, player.api_id); await calcMetrics(data.id); }
          } catch (e: any) { errors.push(`Jogador ${player.api_id}: ${e.message}`); }
        }
      } catch (e: any) { errors.push(`Time ${teamId}: ${e.message}`); }
    }

    log('=== Sync Completo! ===');
    await saveLog('success', gamesCount, errors);

    // Notifica admin se houve erros
    if (errors.length > 0 && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'LinhaCash Sistema <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL,
          subject: `⚠️ Sync com ${errors.length} erros`,
          html: `<h2>Sync concluído com erros</h2><p>Jogos: ${gamesCount}</p><pre>${errors.join('\n')}</pre>`
        })
      }).catch(() => {});
    }

    return NextResponse.json({ message: 'Sync completo!', games: gamesCount, errors: errors.length, logs });
  } catch (e: any) {
    log(`ERRO CRÍTICO: ${e.message}`);
    await saveLog('error', gamesCount, [e.message]);
    return NextResponse.json({ error: e.message, logs }, { status: 500 });
  }
}
