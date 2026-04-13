-- Hotfix: ensure player_stats.game_id is backfilled and enforced.
-- Safe to run in mock mode and production-like environments.

BEGIN;

-- 1) Backfill NULL game_id using strict player/team/date/opponent matching.
WITH match_candidates AS (
  SELECT
    ps.id AS player_stats_id,
    g.id AS game_id,
    ROW_NUMBER() OVER (PARTITION BY ps.id ORDER BY g.id) AS rn,
    COUNT(*) OVER (PARTITION BY ps.id) AS candidate_count
  FROM public.player_stats ps
  JOIN public.players p
    ON p.id = ps.player_id
  JOIN public.games g
    ON g.game_date = ps.game_date
   AND (
      (p.team_id = g.home_team_id AND lower(coalesce(ps.opponent, '')) = lower(coalesce(g.away_team, '')))
      OR
      (p.team_id = g.away_team_id AND lower(coalesce(ps.opponent, '')) = lower(coalesce(g.home_team, '')))
   )
  WHERE ps.game_id IS NULL
)
UPDATE public.player_stats ps
SET game_id = mc.game_id
FROM match_candidates mc
WHERE ps.id = mc.player_stats_id
  AND mc.rn = 1
  AND mc.candidate_count = 1;

-- 2) Uniqueness: one row per player per game, while allowing many players in same game.
CREATE UNIQUE INDEX IF NOT EXISTS player_stats_player_id_game_id_uidx
  ON public.player_stats (player_id, game_id)
  WHERE game_id IS NOT NULL;

COMMIT;

-- 3) Run this only after count(*) with NULL game_id is zero.
-- ALTER TABLE public.player_stats
--   ALTER COLUMN game_id SET NOT NULL;
