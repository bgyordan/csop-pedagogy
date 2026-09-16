import { createClient } from '@supabase/supabase-js'

// Service-role клиент — САМО за сървърни actions (никога в браузъра).
// Изисква SUPABASE_SERVICE_ROLE_KEY в env-а на приложението.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
