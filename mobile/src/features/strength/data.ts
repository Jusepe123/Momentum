import { supabase } from '../../lib/supabase'
import { todayLocalISO } from '../../lib/dates'
import type { Tables } from '../../lib/database.types'

export type Exercise = Tables<'exercises'>
export type RoutineSet = Tables<'routine_sets'> & { exercise: Exercise | null }
export type RoutineWithSets = Tables<'routines'> & { routine_sets: RoutineSet[] }

/** Global seed exercises (user_id NULL) + the user's own, in one query. RLS
 *  returns exactly the rows this user may reference. */
export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('name')
  if (error) throw error
  return data
}

/** Routines with their sets (+ each set's exercise) in one round trip — same
 *  embedded-resource pattern as the web ROUTINE_SELECT. */
export async function fetchRoutines(): Promise<RoutineWithSets[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('*, routine_sets(*, exercise:exercises(*))')
    .order('name')
  if (error) throw error
  return (data as RoutineWithSets[]).map((r) => ({
    ...r,
    routine_sets: [...r.routine_sets].sort((a, b) => a.set_order - b.set_order),
  }))
}

export interface StrengthSetDraft {
  exerciseId: string
  /** kg; 0 is valid (bodyweight). strength_sets.weight_kg is NOT NULL. */
  weightKg: number
  reps: number
}

export interface StrengthDraft {
  durationMin: number
  rpe: number
  notes: string
  sets: StrengthSetDraft[]
}

/**
 * Insert a strength session + its sets, mirroring the web useCreateSession:
 * insert the session (Postgres mints the id), then set its sets through the
 * transactional `replace_session_details` RPC (migration 0002); if that fails,
 * a compensating delete removes the just-created session so a retry can't leave
 * an empty orphaned session behind. Unlike the GPS run upload, strength is a
 * foreground one-shot — there's no snapshot to resurrect, so a client-minted id
 * isn't needed. unified_load is a DB-generated column — never written.
 */
export async function uploadStrength(draft: StrengthDraft): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not authenticated')

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: auth.user.id,
      sport: 'strength',
      date: todayLocalISO(),
      duration_min: draft.durationMin,
      rpe: draft.rpe,
      notes: draft.notes.trim() || null,
    })
    .select()
    .single()
  if (error) throw error

  const { error: rpcError } = await supabase.rpc('replace_session_details', {
    p_session_id: session.id,
    p_sets: draft.sets.map((s) => ({
      exercise_id: s.exerciseId,
      weight_kg: s.weightKg,
      reps: s.reps,
    })),
  })
  if (rpcError) {
    // Don't leave a half-written session behind.
    const { error: rollbackError } = await supabase.from('sessions').delete().eq('id', session.id)
    if (rollbackError) {
      throw new Error(
        `Saving sets failed and the incomplete session could not be removed — please delete it manually. (${rpcError.message})`,
      )
    }
    throw rpcError
  }
}
