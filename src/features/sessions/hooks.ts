import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import type { Sport } from './sportMeta'

export type Exercise = Tables<'exercises'>
export type StrengthSet = Tables<'strength_sets'> & { exercise: Exercise | null }
export type SessionWithDetails = Tables<'sessions'> & {
  strength_sets: StrengthSet[]
  cardio_details: Tables<'cardio_details'> | null
}

/**
 * One round trip for the whole list (sets + cardio embedded) — never one
 * query per session. unified_load is a DB-generated column: read it, never
 * write it.
 */
const SESSION_SELECT = '*, strength_sets(*, exercise:exercises(*)), cardio_details(*)'

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<SessionWithDetails[]> => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SessionWithDetails[]
    },
  })
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['sessions', id],
    enabled: !!id,
    queryFn: async (): Promise<SessionWithDetails> => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as SessionWithDetails
    },
  })
}

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase.from('exercises').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export interface SetDraft {
  exerciseId: string
  weightKg: number
  reps: number
}

export interface SessionDraft {
  sport: Sport
  date: string
  durationMin: number
  rpe: number
  notes: string
  /** strength only */
  sets: SetDraft[]
  /** run/bike only, metres */
  distanceM: number | null
}

async function insertDetails(sessionId: string, draft: SessionDraft) {
  if (draft.sport === 'strength') {
    if (draft.sets.length > 0) {
      const { error } = await supabase.from('strength_sets').insert(
        draft.sets.map((s, i) => ({
          session_id: sessionId,
          exercise_id: s.exerciseId,
          weight_kg: s.weightKg,
          reps: s.reps,
          set_order: i + 1,
        })),
      )
      if (error) throw error
    }
  } else if (draft.distanceM !== null) {
    const { error } = await supabase
      .from('cardio_details')
      .insert({ session_id: sessionId, distance_m: draft.distanceM })
    if (error) throw error
  }
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: SessionDraft) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Not authenticated')
      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          user_id: auth.user.id,
          sport: draft.sport,
          date: draft.date,
          duration_min: draft.durationMin,
          rpe: draft.rpe,
          notes: draft.notes.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      try {
        await insertDetails(session.id, draft)
      } catch (detailError) {
        // Don't leave a half-written session behind.
        const { error: rollbackError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', session.id)
        if (rollbackError) {
          throw new Error(
            `Saving details failed and the incomplete session could not be removed — please delete it manually. (${
              detailError instanceof Error ? detailError.message : detailError
            })`,
          )
        }
        throw detailError
      }
      return session
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SessionDraft }) => {
      const { error } = await supabase
        .from('sessions')
        .update({
          date: draft.date,
          duration_min: draft.durationMin,
          rpe: draft.rpe,
          notes: draft.notes.trim() || null,
        })
        .eq('id', id)
      if (error) throw error

      // Atomic replace via DB function: if anything fails, the transaction
      // rolls back and the previously saved details survive.
      const { error: rpcError } = await supabase.rpc('replace_session_details', {
        p_session_id: id,
        p_sets:
          draft.sport === 'strength'
            ? draft.sets.map((s) => ({
                exercise_id: s.exerciseId,
                weight_kg: s.weightKg,
                reps: s.reps,
              }))
            : [],
        // omitted for strength → the function's `default null` applies
        p_distance_m: draft.sport === 'strength' ? undefined : (draft.distanceM ?? undefined),
      })
      if (rpcError) throw rpcError
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions', id] })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<Exercise> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('exercises')
        .insert({ name: name.trim(), user_id: auth.user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}
