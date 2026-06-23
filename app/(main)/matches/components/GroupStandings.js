'use client'

// FIFA-style 3-letter codes, mirrored from the FLAGS list in matches/page.js
const TEAM_CODES = {
  'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR', 'Czechia': 'CZE',
  'Canada': 'CAN', 'Bosnia-Herzegovina': 'BIH', 'Qatar': 'QAT', 'Switzerland': 'SUI',
  'Brazil': 'BRA', 'Morocco': 'MAR', 'Haiti': 'HAI', 'Scotland': 'SCO',
  'USA': 'USA', 'Paraguay': 'PAR', 'Australia': 'AUS', 'Turkey': 'TUR',
  'Germany': 'GER', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
  'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE', 'Tunisia': 'TUN',
  'Belgium': 'BEL', 'Egypt': 'EGY', 'Iran': 'IRN', 'New Zealand': 'NZL',
  'Spain': 'ESP', 'Cape Verde': 'CPV', 'Saudi Arabia': 'KSA', 'Uruguay': 'URU',
  'France': 'FRA', 'Senegal': 'SEN', 'Iraq': 'IRQ', 'Norway': 'NOR',
  'Argentina': 'ARG', 'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR',
  'Portugal': 'POR', 'DR Congo': 'COD', 'Uzbekistan': 'UZB', 'Colombia': 'COL',
  'England': 'ENG', 'Croatia': 'CRO', 'Ghana': 'GHA', 'Panama': 'PAN',
}

const FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia-Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'USA': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr',
  'Germany': 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
}

// Helper: compute head-to-head stats for a subset of teams, using only
// matches played between those exact teams with a recorded result.
function computeH2H(teamNames, groupMatches) {
  const inGroup = new Set(teamNames)
  const h2h = {}
  for (const t of teamNames) h2h[t] = { pts: 0, gd: 0, gf: 0 }

  for (const m of groupMatches) {
    if (!inGroup.has(m.home_team) || !inGroup.has(m.away_team)) continue
    if (m.result_home === null || m.result_home === undefined ||
        m.result_away === null || m.result_away === undefined) continue

    h2h[m.home_team].gf += m.result_home
    h2h[m.home_team].gd += m.result_home - m.result_away
    h2h[m.away_team].gf += m.result_away
    h2h[m.away_team].gd += m.result_away - m.result_home

    if (m.result_home > m.result_away)      { h2h[m.home_team].pts += 3 }
    else if (m.result_home < m.result_away) { h2h[m.away_team].pts += 3 }
    else { h2h[m.home_team].pts += 1; h2h[m.away_team].pts += 1 }
  }
  return h2h
}

// Helper: sort a set of teams already tied on total points.
// Applies H2H criteria (1-3) first, then overall criteria (4-5) for any
// teams still tied after H2H, then alphabetical as final fallback.
function sortTiedSubgroup(rows, groupMatches) {
  if (rows.length <= 1) return rows

  const h2h = computeH2H(rows.map(r => r.team), groupMatches)

  const sorted = [...rows].sort((a, b) =>
    (h2h[b.team].pts - h2h[a.team].pts) ||
    (h2h[b.team].gd  - h2h[a.team].gd)  ||
    (h2h[b.team].gf  - h2h[a.team].gf)  ||
    (b.gd - a.gd) ||
    (b.gf - a.gf) ||
    a.team.localeCompare(b.team)
  )

  // Find any sub-groups still tied on all three H2H criteria, and sort
  // those sub-groups using only overall criteria (4-5 + alphabetical).
  const result = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length) {
      const ha = h2h[sorted[i].team], hb = h2h[sorted[j].team]
      if (ha.pts === hb.pts && ha.gd === hb.gd && ha.gf === hb.gf) j++
      else break
    }
    if (j - i > 1) {
      const sub = sorted.slice(i, j).sort((a, b) =>
        (b.gd - a.gd) || (b.gf - a.gf) || a.team.localeCompare(b.team)
      )
      result.push(...sub)
    } else {
      result.push(sorted[i])
    }
    i = j
  }
  return result
}

// Main sort: separate teams by total pts first, then apply the full
// FIFA 2026 tiebreaker sequence within each tied group.
function sortGroupStandings(rows, groupMatches) {
  const byPts = [...rows].sort((a, b) => b.pts - a.pts)
  const result = []
  let i = 0
  while (i < byPts.length) {
    let j = i + 1
    while (j < byPts.length && byPts[j].pts === byPts[i].pts) j++
    if (j - i > 1) {
      result.push(...sortTiedSubgroup(byPts.slice(i, j), groupMatches))
    } else {
      result.push(byPts[i])
    }
    i = j
  }
  return result
}

// Computes standings per group from actual match results only (admin-entered
// 90-min scores). Bets are never used here. Matches without a result yet
// (result_home/result_away null) still register the team in the group, but
// don't count toward played/won/drawn/lost/goals.
function computeStandings(matches) {
  const teamsByGroup = {}
  const matchesByGroup = {}
  const stats = {}

  for (const m of matches) {
    const group = m.match_group
    if (!group) continue

    if (!teamsByGroup[group]) { teamsByGroup[group] = new Set(); matchesByGroup[group] = [] }
    matchesByGroup[group].push(m)
    teamsByGroup[group].add(m.home_team)
    teamsByGroup[group].add(m.away_team)

    if (!stats[m.home_team]) stats[m.home_team] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }
    if (!stats[m.away_team]) stats[m.away_team] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }

    const noResultYet = m.result_home === null || m.result_home === undefined
      || m.result_away === null || m.result_away === undefined
    if (noResultYet) continue

    const home = stats[m.home_team]
    const away = stats[m.away_team]
    home.played++; away.played++
    home.gf += m.result_home; home.ga += m.result_away
    away.gf += m.result_away; away.ga += m.result_home

    if (m.result_home > m.result_away) { home.won++; away.lost++ }
    else if (m.result_home < m.result_away) { away.won++; home.lost++ }
    else { home.drawn++; away.drawn++ }
  }

  const standingsByGroup = {}
  for (const [group, teamSet] of Object.entries(teamsByGroup)) {
    const rows = [...teamSet].map(team => {
      const s = stats[team]
      return {
        team,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        gf: s.gf,
        gd: s.gf - s.ga,
        pts: s.won * 3 + s.drawn,
      }
    })
    standingsByGroup[group] = sortGroupStandings(rows, matchesByGroup[group])
  }
  return standingsByGroup
}

export default function GroupStandings({ matches }) {
  const standingsByGroup = computeStandings(matches)
  const groupNames = Object.keys(standingsByGroup).sort((a, b) => a.localeCompare(b))

  const gridCols = '22px 22px 1fr repeat(6, 26px)'

  return (
    <>
      {groupNames.map(group => (
        <div
          key={group}
          style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '11px 10px 9px', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ gridColumn: '1 / 4', fontSize: 14, fontWeight: 600, color: '#111' }}>Group {group}</span>
            {['P', 'W', 'D', 'L', 'GD', 'Pts'].map(label => (
              <span key={label} style={{ fontSize: 9.5, color: '#bbb', fontWeight: 600, textAlign: 'center' }}>{label}</span>
            ))}
          </div>
          {standingsByGroup[group].map((row, i) => {
            const flagCode = FLAGS[row.team]
            const code3 = TEAM_CODES[row.team] || row.team.slice(0, 3).toUpperCase()
            return (
              <div
                key={row.team}
                style={{
                  display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center',
                  padding: '8px 10px', borderBottom: i === standingsByGroup[group].length - 1 ? 'none' : '1px solid #f6f6f6',
                }}
              >
                <span style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>{i + 1}</span>
                {flagCode ? (
                  <img
                    src={`https://flagcdn.com/w40/${flagCode}.png`}
                    alt={row.team}
                    style={{ width: 18, height: 13, borderRadius: 2, objectFit: 'cover' }}
                  />
                ) : <span />}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111', paddingLeft: 6, letterSpacing: '0.02em' }}>
                  {code3}
                </span>
                <span style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>{row.played}</span>
                <span style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>{row.won}</span>
                <span style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>{row.drawn}</span>
                <span style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>{row.lost}</span>
                <span style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                <span style={{ fontSize: 12.5, color: '#111', textAlign: 'center', fontWeight: 700 }}>{row.pts}</span>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}
