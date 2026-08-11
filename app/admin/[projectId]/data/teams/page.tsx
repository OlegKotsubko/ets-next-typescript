'use client'
import { use, useState } from 'react'
import { Box, Divider } from '@mui/material'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { TeamRosterEditor } from '@/components/admin/crud/TeamRosterEditor'
import { teamsApi, useListTeamsQuery } from '@/store/apis/teamsApi'
import { teamsEntityDef } from '@/lib/entities/teams'

export default function TeamsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const { data: teams = [] } = useListTeamsQuery(projectId)

  return (
    <Box>
      <CrudPage projectId={projectId} entityDef={teamsEntityDef} api={teamsApi} />
      <Divider sx={{ my: 3 }} />
      {teams.length > 0 && (
        <Box>
          <select onChange={(e) => setSelectedTeamId(e.target.value || null)} defaultValue="">
            <option value="">Select a team to edit its roster…</option>
            {teams.map((t: { id: string; name: string }) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {selectedTeamId && <TeamRosterEditor projectId={projectId} teamId={selectedTeamId} />}
        </Box>
      )}
    </Box>
  )
}
