import { createClient } from '@supabase/supabase-js'
import LogoutButton from '@/app/components/LogoutButton'
import ReactMarkdown from 'react-markdown'

const markdownComponents = {
  p: ({ children }) => (
    <p className="text-sm text-gray-700 leading-relaxed mb-1 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
}

export const revalidate = 3600

const DEFAULT_SECTIONS = [
  {
    title: '📢 Gamemaster Notice Board',
    body: 'Important decrees from your all-powerful Gamemaster will appear here.'
  },
  {
    title: 'Joining',
    body: 'New user: Create an account by entering your chosen name, your email address, and the join code shared by the organizer. Your name will be visible to all other players.\nExisting user: Log in from any device or browser by entering your email address and the join code. You will be recognized automatically and can continue where you left off.'
  },
  {
    title: 'Placing bets',
    body: 'Submit your score prediction for every match before the first kickoff in each stage. You can update your bet any time before that deadline. After kickoff, bets are locked for the whole stage.'
  },
  {
    title: 'Deadlines for placing bets',
    body: 'Group: June 11 at 21:00 (Oslo time)\nR32: June 28 at 21:00\nR16: July 4 at 19:00\nQF: July 9 at 22:00\nSF: July 14 at 21:00\nFinal: July 18 at 23:00'
  },
  {
    title: 'DNS — did not submit',
    body: 'If you miss the deadline for a stage, you get 0 points (DNS) for all matches in that stage. You can still place bets for the next stage when it opens.'
  },
  {
    title: 'Scoring',
    body: 'Points are based on the result after 90 minutes + stoppage time only. Extra time and penalties in knock-out stages do not count. For example: A draw after 90 min (+ stoppage time) counts as a draw, regardless of what happens after.'
  },
  {
    title: 'Leaderboard & tie-breakers',
    body: 'Sorted by: 1. Total points · 2. Total exact hits · 3. Exact hits by stage in order: Group → R32 → R16 → QF → SF → Final'
  },
  {
    title: 'Credits',
    body: 'Gamemaster: Erik Olsson Standal — mastermind behind the competition and all executive decisions. All complaints go here.\n\nDeveloper: Thomas Rasch Brastad — designed and built this app, powered by coffee and AI.'
  }
]

async function getRulesSections() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'rules')
    .single()

  return data?.value ?? DEFAULT_SECTIONS
}

export default async function RulesPage() {
  const sections = await getRulesSections()

  const scoringIndex = sections.findIndex(s =>
    s.title.toLowerCase().includes('scor')
  )

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#f4f5f7' }}>
      <div className="flex-shrink-0" style={{ background: '#0a5c45' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">📋</span>
            <h1 className="text-xl font-medium text-white tracking-tight">Rules</h1>
          </div>
          <LogoutButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 space-y-5">
        {sections.map((section, i) => (
          <div key={i}>
            {i > 0 && <hr className="mb-5" style={{ borderTopWidth: '1.5px', borderColor: '#d0d0d0' }} />}
            <section>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">
                {section.title}
              </p>
              {i === scoringIndex && (
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-1 rounded-full min-w-[48px] text-center">3 pts</span>
                    <span className="text-sm text-gray-700">Exact hit (correct score prediction)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-full min-w-[48px] text-center">1 pt</span>
                    <span className="text-sm text-gray-700">Correct winner or correct draw</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-gray-200 text-gray-500 text-xs font-medium px-2 py-1 rounded-full min-w-[48px] text-center">0 pts</span>
                    <span className="text-sm text-gray-700">Wrong result or DNS</span>
                  </div>
                </div>
              )}
              {section.body.split('\n').map((line, j) =>
                line
                  ? <ReactMarkdown key={j} components={markdownComponents}>{line}</ReactMarkdown>
                  : <p key={j} className="mb-3" />
              )}
            </section>
          </div>
        ))}
      </div>
    </div>
  )
}
