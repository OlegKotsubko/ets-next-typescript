import type { BracketRound } from '@/db/schemas/brackets'

const ROUND_NAMES: Record<number, string> = {
  1: 'Final', 2: 'Semifinal', 4: 'Quarterfinal', 8: 'Round of 16', 16: 'Round of 32',
}

export function generateSingleElim(participantCount: number): BracketRound[] {
  const rounds: BracketRound[] = []
  let matchesInRound = participantCount / 2
  while (matchesInRound >= 1) {
    const label = ROUND_NAMES[matchesInRound] ?? `Round of ${matchesInRound * 2}`
    rounds.push({
      name: label,
      matches: Array.from({ length: matchesInRound }, (_, i) => ({
        id: crypto.randomUUID(),
        name: `${label} ${i + 1}`,
        scheduledAt: null,
        leftParticipantId: null,
        rightParticipantId: null,
        scoreLeft: 0,
        scoreRight: 0,
        status: 'scheduled' as const,
        matchType: 'bo1' as const,
        placeholderLeft: '',
        placeholderRight: '',
        winnerId: null,
        extra: {},
      })),
    })
    matchesInRound /= 2
  }
  return rounds
}
