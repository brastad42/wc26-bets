// Scoring rule mirrored in SQL by get_leaderboard() in supabase/setup.sql —
// if you change this, update both places.
export function calcPoints(match, betHome, betAway) {
  if (match.result_home === null || match.result_away === null) return null
  if (betHome === match.result_home && betAway === match.result_away) return 3
  const resultWinner = Math.sign(match.result_home - match.result_away)
  const betWinner = Math.sign(betHome - betAway)
  if (resultWinner === betWinner) return 1
  return 0
}
