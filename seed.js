const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function seed() {
  const { data, error } = await supabase
    .from('competitions')
    .insert({
      name: 'World Cup 2026',
      join_code: 'wc26'
    })
    .select()

  if (error) {
    console.error('Feil:', error.message)
  } else {
    console.log('Konkurranse opprettet:', data)
  }
}

seed()