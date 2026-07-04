import { supabase } from '../lib/supabase'
import type { PendingRun } from './pending'

/**
 * Insert the run as an ordinary web-compatible session + cardio detail.
 * Mirrors web useCreateSession: sessions first, then cardio_details, with a
 * compensating delete so no half-written session survives a failure.
 * unified_load is a DB-generated column — never written.
 */
export async function uploadRun(run: PendingRun): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not authenticated')

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: auth.user.id,
      sport: 'run',
      date: run.dateLocal,
      duration_min: Math.max(1, Math.round(run.activeMs / 60000)),
      rpe: run.rpe,
      notes: run.notes.trim() || null,
    })
    .select()
    .single()
  if (error) throw error

  const { error: detailError } = await supabase
    .from('cardio_details')
    .insert({ session_id: session.id, distance_m: Math.round(run.distanceM) })

  if (detailError) {
    // Don't leave a half-written session behind.
    const { error: rollbackError } = await supabase.from('sessions').delete().eq('id', session.id)
    if (rollbackError) {
      throw new Error(
        `Saving details failed and the incomplete session could not be removed — please delete it manually. (${detailError.message})`,
      )
    }
    throw detailError
  }
}
