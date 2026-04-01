export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">

      {/* Top bar */}
      <div className="bg-white px-4 pt-12 pb-3">
        <h1 className="text-lg font-medium text-gray-900">Rules</h1>
      </div>

      <div className="px-4 pt-4 space-y-5">

        <section>
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">Joining</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Enter your alias and the join code shared by the organizer. You are remembered automatically next time you open the app.
          </p>
        </section>

        <hr className="border-gray-200" />

        <section>
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">Placing bets</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Submit your score prediction for every match before the first kickoff in each stage. You can update your bet any time before that deadline. After kickoff, bets are locked for the whole stage.
          </p>
        </section>

        <hr className="border-gray-200" />

        <section>
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">DNS — did not submit</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            If you miss the deadline for a stage, you get 0 points (DNS) for all matches in that stage. You can still place bets for the next stage when it opens.
          </p>
        </section>

        <hr className="border-gray-200" />

        <section>
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">Scoring</p>
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-1 rounded-full min-w-[48px] text-center">3 pts</span>
              <span className="text-sm text-gray-700">Exact score correct</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-full min-w-[48px] text-center">1 pt</span>
              <span className="text-sm text-gray-700">Correct winner or correct draw</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full min-w-[48px] text-center">0 pts</span>
              <span className="text-sm text-gray-700">Wrong result or DNS</span>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            Points are based on the result after 90 minutes + stoppage time only. Extra time and penalties do not count. A draw after 90 min counts as a draw regardless of what happens after.
          </p>
        </section>

        <hr className="border-gray-200" />

        <section>
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">Leaderboard & tie-breakers</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Sorted by: 1. Total points · 2. Total exact hits · 3. Exact hits by stage in order: Group → R32 → R16 → QF → SF → Final
          </p>
        </section>

      </div>
    </div>
  )
}