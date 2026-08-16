import { z } from 'zod'
import { timerWidget, TimerActions } from '@/models/Timer'

export const { model, fields } = timerWidget()
export const actions = TimerActions
export type Data = z.infer<typeof model>
