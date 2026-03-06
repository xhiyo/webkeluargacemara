import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ixnsyjuzhtpoqthefxmz.supabase.co'
const supabaseKey = 'sb_publishable_yHoESi9GdKxurbg02wF4eg_ahk_SQpK'

export const supabase = createClient(supabaseUrl, supabaseKey)
