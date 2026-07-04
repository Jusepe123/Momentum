import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import type { Exercise } from '../sessions/hooks'

export type RoutineSet = Tables<'routine_sets'> & { exercise: Exercise | null }
export type RoutineWithSets = Tables<'routines'> & { routine_sets: RoutineSet[] }

/** One round trip for routines + their sets, same pattern as SESSION_SELECT. */
const ROUTINE_SELECT = '*, routine_sets(*, exercise:exercises(*))'

export function useRoutines() {
  return useQuery({
    queryKey: ['routines'],
    queryFn: async (): Promise<RoutineWithSets[]> => {
      const { data, error } = await supabase
        .from('routines')
        .select(ROUTINE_SELECT)
        .order('name')
      if (error) throw error
      return data as RoutineWithSets[]
    },
  })
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: ['routines', id],
    enabled: !!id,
    queryFn: async (): Promise<RoutineWithSets> => {
      const { data, error } = await supabase
        .from('routines')
        .select(ROUTINE_SELECT)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as RoutineWithSets
    },
  })
}

export interface RoutineSetDraft {
  exerciseId: string
  /** target weight is optional in a template */
  weightKg: number | null
  reps: number
}

export interface RoutineDraft {
  name: string
  sets: RoutineSetDraft[]
}

export function useCreateRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: RoutineDraft) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Not authenticated')
      const { data: routine, error } = await supabase
        .from('routines')
        .insert({ user_id: auth.user.id, name: draft.name.trim() })
        .select()
        .single()
      if (error) throw error
      if (draft.sets.length > 0) {
        const { error: setsError } = await supabase.from('routine_sets').insert(
          draft.sets.map((s, i) => ({
            routine_id: routine.id,
            exercise_id: s.exerciseId,
            weight_kg: s.weightKg,
            reps: s.reps,
            set_order: i + 1,
          })),
        )
        if (setsError) {
          // Don't leave a half-written routine behind.
          const { error: rollbackError } = await supabase
            .from('routines')
            .delete()
            .eq('id', routine.id)
          if (rollbackError) {
            throw new Error(
              `Saving sets failed and the incomplete routine could not be removed — please delete it manually. (${setsError.message})`,
            )
          }
          throw setsError
        }
      }
      return routine
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}

export function useUpdateRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: RoutineDraft }) => {
      const { error } = await supabase
        .from('routines')
        .update({ name: draft.name.trim() })
        .eq('id', id)
      if (error) throw error

      // Atomic replace via DB function (migration 0003): a failed edit can't
      // wipe the routine's previously saved sets.
      const { error: rpcError } = await supabase.rpc('replace_routine_sets', {
        p_routine_id: id,
        p_sets: draft.sets.map((s) => ({
          exercise_id: s.exerciseId,
          weight_kg: s.weightKg,
          reps: s.reps,
        })),
      })
      if (rpcError) throw rpcError
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['routines'] })
      qc.invalidateQueries({ queryKey: ['routines', id] })
    },
  })
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routines').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}
