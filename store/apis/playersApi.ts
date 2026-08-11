import { createEntityApi } from './createEntityApi'
import type { Player } from '@/lib/entities/players'
import type { CreatePlayerInput, UpdatePlayerInput } from '@/db/schemas/players'

const { api } = createEntityApi<Player, CreatePlayerInput, UpdatePlayerInput>({
  reducerPath: 'playersApi',
  tagType: 'Player',
  basePath: 'players',
})

export const playersApi = api

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hooks = api as any
export const useListPlayersQuery = hooks.useListPlayersQuery
export const useGetPlayerQuery = hooks.useGetPlayerQuery
export const useCreatePlayerMutation = hooks.useCreatePlayerMutation
export const useUpdatePlayerMutation = hooks.useUpdatePlayerMutation
export const useDeletePlayerMutation = hooks.useDeletePlayerMutation
