import { LowerThirdFields, LowerThirdActions } from '@/models/LowerThird'

// This package uses the shared contract unchanged.
export const model = LowerThirdFields
export const actions = LowerThirdActions
export type Data = typeof model._output
