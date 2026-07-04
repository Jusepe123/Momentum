import { supabase } from '../lib/supabase'
import type { PendingRun } from './pending'

const UNIQUE_VIOLATION = '23505'

/**
 * Insert the run as an ordinary web-compatible session + cardio detail.
 * Mirrors web useCreateSession (sessions first, then cardio_details, with a
 * compensating delete), plus idempotency: run.id is the client-generated
 * sessions.id, so a retry after a timed-out-but-landed insert hits a unique
 * violation and is treated as already uploaded instead of duplicating the
 * row. unified_load is a DB-generated column — never written.
 */
export async function uploadRun(run: PendingRun): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not authenticated')

  const { error } = await supabase.from('sessions').insert({
    id: run.id,
    user_id: auth.user.id,
    sport: 'run',
    date: run.dateLocal,
    duration_min: Math.max(1, Math.round(run.activeMs / 60000)),
    rpe: run.rpe,
    notes: run.notes.trim() || null,
  })
  if (error && error.code !== UNIQUE_VIOLATION) throw error
  // UNIQUE_VIOLATION: a previous attempt landed server-side after the client
  // gave up. The session row is ours (UUID id) — just make sure details exist.

  const { error: detailError } = await supabase
    .from('cardio_details')
    .insert({ session_id: run.id, distance_m: Math.round(run.distanceM) })
  if (detailError && detailError.code === UNIQUE_VIOLATION) return // fully uploaded earlier

  if (detailError) {
    // Don't leave a half-written session behind.
    const { error: rollbackError } = await supabase.from('sessions').delete().eq('id', run.id)
    if (rollbackError) {
      throw new Error(
        `Saving details failed and the incomplete session could not be removed — please delete it manually. (${detailError.message})`,
      )
    }
    throw detailError
  }
}
