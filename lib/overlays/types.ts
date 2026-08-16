import type { ComponentType } from 'react'
import type { ZodTypeAny } from 'zod'
import type { FieldDescriptor } from './widget-schema'

export type OverlaySettings = {
  model: string
  preview?: Record<string, string>
  color: number // 1..7 UI tag color
  isFullscreen: boolean
  widgetName?: string // default operator label
  allowedParticipantType?: 'team' | 'player'
}

export type OverlayData = { widget: Record<string, unknown> } & Record<string, unknown>
export type OverlayComponent = ComponentType<{ data: OverlayData }>
export type OverlayAnimation = (root: HTMLElement) => unknown // returns a gsap Timeline; callers don't need the type

export type CatalogEntry = {
  model: string
  category: string
  template: string
  widgetName: string
  preview?: Record<string, string>
  color: number
  isFullscreen: boolean
  allowedParticipantType?: 'team' | 'player'
  zodModel: ZodTypeAny
  fields: FieldDescriptor[]
  actions: readonly string[]
}
