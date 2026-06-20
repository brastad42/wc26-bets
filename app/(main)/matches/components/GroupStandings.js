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

// Computes standings per group from actual match results only (admin-entered
// 90-min scores). Bets are never used here. Matches without a result yet
// (result_home/result_away null) still register the team in the group, but
// don't count toward played/won/drawn/lost/goals.
function computeStandings(matches) {
  const teamsByGroup = {}
  const stats = {}

  for (const m of matches) {
    const group = m.match_group
    if (!group) continue

    if (!teamsByGroup[group]) teamsByGroup[group] = new Set()
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
    // Pts → GD → goals scored → alphabetical (final fallback when fully tied)
    rows.sort((a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
    )
    standingsByGroup[group] = rows
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
