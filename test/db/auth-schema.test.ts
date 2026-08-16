import { describe, it, expect } from 'vitest'
import { getTableName, getTableColumns } from 'drizzle-orm'
import { users, sessions, accounts, verifications, rundowns } from '@/db/schema'

describe('better-auth tables', () => {
  it('use plural table names matching usePlural', () => {
    expect(getTableName(users)).toBe('users')
    expect(getTableName(sessions)).toBe('sessions')
    expect(getTableName(accounts)).toBe('accounts')
    expect(getTableName(verifications)).toBe('verifications')
  })
  it('users has the better-auth core columns', () => {
    const cols = Object.keys(getTableColumns(users))
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt']),
    )
  })
  it('sessions has token + userId, accounts stores the password hash', () => {
    expect(Object.keys(getTableColumns(sessions))).toEqual(
      expect.arrayContaining(['id', 'expiresAt', 'token', 'ipAddress', 'userAgent', 'userId']),
    )
    expect(Object.keys(getTableColumns(accounts))).toEqual(
      expect.arrayContaining(['id', 'accountId', 'providerId', 'userId', 'password']),
    )
  })
  it('user ids are text (better-auth), not uuid', () => {
    expect(getTableColumns(users).id.columnType).toBe('PgText')
    // rundowns.userId references the better-auth text user id.
    expect(getTableColumns(rundowns).userId.columnType).toBe('PgText')
  })
})
