import { defineWidget, number, text } from '@/lib/overlays/widget-schema'

// Shared field + action contract for timer-style overlays.
export const TimerFields = {
  duration: number({ label: 'Duration (s)', default: 300, canLiveUpdate: true }),
  label: text({ label: 'Label', default: 'STARTS IN', canLiveUpdate: true }),
}
export const TimerActions = ['start', 'stop', 'reset'] as const
export const timerWidget = () => defineWidget(TimerFields)
