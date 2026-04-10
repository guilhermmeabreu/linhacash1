-- Simple mock seed for current Supabase tables (no upsert, no schema changes)
-- Inserts only into: games, players, player_stats

BEGIN;

-- 1) Games (2 today in BRT)
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

-- 2) Players (12 total, only teams from the 2 games)
INSERT INTO players (api_id, name, team_id, position)
VALUES
  (100001, 'LeBron James', 14, 'F'),
  (100002, 'Anthony Davis', 14, 'C'),
  (100003, 'Austin Reaves', 14, 'G'),
  (100004, 'Stephen Curry', 10, 'G'),
  (100005, 'Klay Thompson', 10, 'G'),
  (100006, 'Draymond Green', 10, 'F'),
  (100007, 'Jayson Tatum', 2, 'F'),
  (100008, 'Jaylen Brown', 2, 'G-F'),
  (100009, 'Kristaps Porzingis', 2, 'C-F'),
  (100010, 'Giannis Antetokounmpo', 17, 'F'),
  (100011, 'Damian Lillard', 17, 'G'),
  (100012, 'Khris Middleton', 17, 'F');

-- 3) Historical player_stats (18 rows per player = supports L5/L10/L20/L30/Season)
WITH player_pool AS (
  SELECT id, api_id, team_id
  FROM players
  WHERE api_id BETWEEN 100001 AND 100012
),
base_profile AS (
  SELECT * FROM (VALUES
    (100001, 27.0, 7.5, 8.0, 2.4, 35.0),
    (100002, 24.0, 12.0, 3.5, 0.8, 34.0),
    (100003, 16.5, 4.8, 5.3, 2.2, 33.0),
    (100004, 29.5, 5.0, 6.2, 4.6, 34.5),
    (100005, 18.0, 3.7, 2.5, 3.1, 31.5),
    (100006, 9.5, 7.5, 6.8, 1.0, 31.0),
    (100007, 28.0, 8.3, 4.8, 3.2, 36.0),
    (100008, 24.8, 5.8, 3.8, 2.4, 35.0),
    (100009, 20.2, 7.2, 2.1, 2.0, 31.0),
    (100010, 31.0, 11.8, 6.5, 0.6, 35.0),
    (100011, 26.0, 4.6, 7.1, 3.4, 35.5),
    (100012, 16.0, 5.0, 4.7, 2.0, 31.5)
  ) AS t(api_id, pts, reb, ast, tpm, mins)
),
seq AS (
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
  p.id AS player_id,
  ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (s.n || ' days')::interval)::date AS game_date,
  CASE
    WHEN p.team_id = 14 THEN CASE WHEN s.n % 5 IN (0,1,2) THEN 'Golden State Warriors' ELSE 'Phoenix Suns' END
    WHEN p.team_id = 10 THEN CASE WHEN s.n % 5 IN (0,1,2) THEN 'Los Angeles Lakers' ELSE 'Sacramento Kings' END
    WHEN p.team_id = 2 THEN CASE WHEN s.n % 5 IN (0,1,2) THEN 'Milwaukee Bucks' ELSE 'Miami Heat' END
    WHEN p.team_id = 17 THEN CASE WHEN s.n % 5 IN (0,1,2) THEN 'Boston Celtics' ELSE 'Indiana Pacers' END
    ELSE 'NBA Opponent'
  END AS opponent,
  (s.n % 2 = 0) AS is_home,
  GREATEST(0, ROUND(b.pts + ((s.n % 7) - 3) * 1.4 + ((p.id % 5) - 2) * 0.7))::int AS points,
  GREATEST(0, ROUND(b.reb + ((s.n % 6) - 2.5) * 0.7 + ((p.id % 3) - 1) * 0.5))::int AS rebounds,
  GREATEST(0, ROUND(b.ast + ((s.n % 8) - 3.5) * 0.6 + ((p.id % 4) - 1.5) * 0.3))::int AS assists,
  GREATEST(0, ROUND(b.tpm + ((s.n % 5) - 2) * 0.4 + ((p.id % 2) * 0.2)))::int AS three_pointers,
  GREATEST(20, ROUND(b.mins + ((s.n % 6) - 2.5) * 0.9 + ((p.id % 2) * 0.5), 0))::int AS minutes
FROM player_pool p
JOIN base_profile b ON b.api_id = p.api_id
CROSS JOIN seq s;

COMMIT;
