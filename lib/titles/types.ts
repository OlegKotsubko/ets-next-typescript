import { z } from 'zod'
import type { ComponentType } from 'react'

export const titleColorSchema = z.enum(['red', 'green', 'blue', 'yellow'])
export type TitleColor = z.infer<typeof titleColorSchema>

// Author-time presentation. Read from the registry by titleKey — never travels
// in the SSE payload. Media fields are filenames inside the package's
// assets/titles/{videos,backgrounds,previews}/ folders.
export const titleSettingsSchema = z.object({
  title_name: z.string().min(1),
  title_preview: z.string().optional(),
  title_color: titleColorSchema.optional(),
  title_is_full_screen: z.boolean().default(false),
  title_stinger_in: z.string().optional(),
  title_stinger_out: z.string().optional(),
  title_background: z.string().optional(),
  title_video: z.string().optional(),
})

export type TitleSettings = z.infer<typeof titleSettingsSchema>

// A command is fire-and-forget and never snapshotted: a title registers a
// handler, the renderer forwards `command` events matching its itemId.
export type CommandHandler = (action: string, payload?: unknown) => void

export type TitleProps<TData> = {
  data: TData
  onCommand?: (handler: CommandHandler) => void
}

export type TitleEntry = {
  key: string
  packageLabel: string
  Component: ComponentType<TitleProps<never>>
  model: z.ZodTypeAny
  actions: readonly string[]
  settings: TitleSettings
}

export type TitleRegistry = Record<string, TitleEntry>
