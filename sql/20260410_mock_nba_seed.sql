-- Corrected simple seed for /api/games + /api/players + /api/metrics contract
-- Tables: games, players, player_stats

BEGIN;

-- 0) Clean only this seed's own mock rows (rerunnable safely)
-- Remove stats linked to this seed's players
DELETE FROM player_stats
WHERE player_id IN (
  SELECT id
  FROM players
  WHERE api_id BETWEEN 910001 AND 910012
);

-- Remove this seed's players
DELETE FROM players
WHERE api_id BETWEEN 910001 AND 910012;

-- Remove only this seed's two games for today
DELETE FROM games
WHERE game_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND (
    (home_team = 'Los Angeles Lakers' AND away_team = 'Golden State Warriors')
    OR
    (home_team = 'Boston Celtics' AND away_team = 'Milwaukee Bucks')
  );

-- 1) Two games for today (BRT)
INSERT INTO games (
  game_date,
  home_team,
  away_team,
  home_team_id,
  away_team_id,
  game_time,
  status
)
VALUES
  (
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'Los Angeles Lakers',
    'Golden State Warriors',
    14,
    10,
    ((now() AT TIME ZONE 'America/Sao_Paulo')::date + time '20:00') AT TIME ZONE 'America/Sao_Paulo',
    'Scheduled'
  ),
  (
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'Boston Celtics',
    'Milwaukee Bucks',
    2,
    17,
    ((now() AT TIME ZONE 'America/Sao_Paulo')::date + time '22:30') AT TIME ZONE 'America/Sao_Paulo',
    'Scheduled'
  );

-- 2) Players linked directly by team_id to the exact game team ids above
INSERT INTO players (api_id, name, team_id, position)
VALUES
  (910001, 'LeBron James', 14, 'F'),
  (910002, 'Anthony Davis', 14, 'C'),
  (910003, 'Austin Reaves', 14, 'G'),

  (910004, 'Stephen Curry', 10, 'G'),
  (910005, 'Klay Thompson', 10, 'G'),
  (910006, 'Draymond Green', 10, 'F'),

  (910007, 'Jayson Tatum', 2, 'F'),
  (910008, 'Jaylen Brown', 2, 'G-F'),
  (910009, 'Kristaps Porzingis', 2, 'C-F'),

  (910010, 'Giannis Antetokounmpo', 17, 'F'),
  (910011, 'Damian Lillard', 17, 'G'),
  (910012, 'Khris Middleton', 17, 'F');

-- 3) Historical player_stats: 18 rows per player
-- - supports L5/L10/L20/L30/Season
-- - repeated same-opponent rows support H2H behavior
WITH seeded_players AS (
  SELECT id, api_id, team_id
  FROM players
  WHERE api_id BETWEEN 910001 AND 910012
),
profiles AS (
  SELECT * FROM (VALUES
    (910001, 27.0, 7.5, 8.0, 2.4, 35.0),
    (910002, 24.0, 12.0, 3.5, 0.8, 34.0),
    (910003, 16.5, 4.8, 5.3, 2.2, 33.0),
    (910004, 29.5, 5.0, 6.2, 4.6, 34.5),
    (910005, 18.0, 3.7, 2.5, 3.1, 31.5),
    (910006, 9.5, 7.5, 6.8, 1.0, 31.0),
    (910007, 28.0, 8.3, 4.8, 3.2, 36.0),
    (910008, 24.8, 5.8, 3.8, 2.4, 35.0),
    (910009, 20.2, 7.2, 2.1, 2.0, 31.0),
    (910010, 31.0, 11.8, 6.5, 0.6, 35.0),
    (910011, 26.0, 4.6, 7.1, 3.4, 35.5),
    (910012, 16.0, 5.0, 4.7, 2.0, 31.5)
  ) AS p(api_id, pts, reb, ast, tpm, mins)
),
last_n AS (
  SELECT generate_series(1, 18) AS n
)
INSERT INTO player_stats (
  player_id,
  game_date,
  opponent,
  is_home,
  points,
  rebounds,
  assists,
  three_pointers,
  minutes
)
SELECT
  sp.id,
  ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (ln.n || ' days')::interval)::date,
  CASE
    WHEN sp.team_id = 14 THEN CASE WHEN ln.n % 5 IN (0,1,2) THEN 'Golden State Warriors' ELSE 'Phoenix Suns' END
    WHEN sp.team_id = 10 THEN CASE WHEN ln.n % 5 IN (0,1,2) THEN 'Los Angeles Lakers' ELSE 'Sacramento Kings' END
    WHEN sp.team_id = 2 THEN CASE WHEN ln.n % 5 IN (0,1,2) THEN 'Milwaukee Bucks' ELSE 'Miami Heat' END
    WHEN sp.team_id = 17 THEN CASE WHEN ln.n % 5 IN (0,1,2) THEN 'Boston Celtics' ELSE 'Indiana Pacers' END
    ELSE 'NBA Opponent'
  END AS opponent,
  (ln.n % 2 = 0) AS is_home,
  GREATEST(0, ROUND(pr.pts + ((ln.n % 7) - 3) * 1.4 + ((sp.id % 5) - 2) * 0.7))::int AS points,
  GREATEST(0, ROUND(pr.reb + ((ln.n % 6) - 2.5) * 0.7 + ((sp.id % 3) - 1) * 0.5))::int AS rebounds,
  GREATEST(0, ROUND(pr.ast + ((ln.n % 8) - 3.5) * 0.6 + ((sp.id % 4) - 1.5) * 0.3))::int AS assists,
  GREATEST(0, ROUND(pr.tpm + ((ln.n % 5) - 2) * 0.4 + ((sp.id % 2) * 0.2)))::int AS three_pointers,
  GREATEST(20, ROUND(pr.mins + ((ln.n % 6) - 2.5) * 0.9 + ((sp.id % 2) * 0.5), 0))::int AS minutes
FROM seeded_players sp
JOIN profiles pr ON pr.api_id = sp.api_id
CROSS JOIN last_n ln;

COMMIT;
