import { createClient } from '@supabase/supabase-js'

const fallbackSupabaseUrl = 'https://ixnsyjuzhtpoqthefxmz.supabase.co'
const fallbackSupabaseKey = 'sb_publishable_yHoESi9GdKxurbg02wF4eg_ahk_SQpK'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? fallbackSupabaseUrl
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? fallbackSupabaseKey

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
	console.warn(
		'Using fallback Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file for a stable connection.',
	)
}

export const supabase = createClient(supabaseUrl, supabaseKey)
export { supabaseKey, supabaseUrl }
