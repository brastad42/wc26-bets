'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]))
  })
}

export default function CsvImport() {
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState('')

  // Fetch the competition ID we created in the seed step
  async function getCompetitionId() {
    const { data } = await supabase
      .from('competitions')
      .select('id')
      .single()
    return data?.id
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result)
      setPreview(rows)
      setResult('')
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    setResult('')

    const competitionId = await getCompetitionId()

    const rows = preview.map(row => ({
      competition_id: competitionId,
      match_no: parseInt(row.match_no),
      stage: row.stage,
      match_group: row.match_group || null,
      home_team: row.home_team,
      away_team: row.away_team,
      match_time: new Date(row.match_time).toISOString()
    }))

    const { error } = await supabase
      .from('matches')
      .upsert(rows, { onConflict: 'match_no' })

    if (error) {
      setResult('Error: ' + error.message)
    } else {
      setResult(`${rows.length} matches imported successfully.`)
      setPreview([])
    }
    setImporting(false)
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Import matches (CSV)
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        onClick={(e) => { e.target.value = null }}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current.click()}
        className="w-full h-9 border border-emerald-400 text-emerald-700 rounded-lg text-sm font-medium bg-transparent"
      >
        Choose CSV file ↑
      </button>

      {preview.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-2">{preview.length} matches ready to import:</p>
          <div className="bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto">
            {preview.map((row, i) => (
              <div key={i} className="text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                {row.stage} · {row.home_team} vs {row.away_team} · {row.match_time}
              </div>
            ))}
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full h-9 mt-3 bg-emerald-500 text-emerald-900 font-medium rounded-lg text-sm disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Confirm import'}
          </button>
        </div>
      )}

      {result && (
        <p className="text-xs text-emerald-600 mt-2">{result}</p>
      )}
    </div>
  )
}