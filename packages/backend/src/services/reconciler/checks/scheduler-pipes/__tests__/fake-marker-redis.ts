import type { Redis } from 'ioredis'

type Reply = [Error | null, unknown]

function isBelowMax(score: number, max: string): boolean {
  return max.startsWith('(')
    ? score < Number(max.slice(1))
    : score <= Number(max)
}

/**
 * Sorted sets in memory, shared by every pipeline, like one Redis primary.
 */
export function createFakeMarkerRedis() {
  const sortedSets = new Map<string, Map<string, number>>()
  const commands: (string | number)[][] = []
  const expirySecondsByKey = new Map<string, number>()
  const state = { inFlight: 0, maxInFlight: 0, failWith: null as Error | null }

  function pipeline() {
    const queued: (() => Reply)[] = []
    const commandPipeline = {
      zadd(key: string, nx: string, ...scoreMembers: (string | number)[]) {
        commands.push(['zadd', key, nx, ...scoreMembers])
        queued.push(() => {
          const members = sortedSets.get(key) ?? new Map<string, number>()
          let added = 0
          for (let i = 0; i < scoreMembers.length; i += 2) {
            const member = String(scoreMembers[i + 1])
            if (!members.has(member)) {
              members.set(member, Number(scoreMembers[i]))
              added++
            }
          }
          sortedSets.set(key, members)
          return [null, added]
        })
        return commandPipeline
      },
      zremrangebyscore(key: string, min: string, max: string) {
        commands.push(['zremrangebyscore', key, min, max])
        queued.push(() => {
          const members = sortedSets.get(key) ?? new Map<string, number>()
          let removed = 0
          for (const [member, score] of members) {
            if (isBelowMax(score, max)) {
              members.delete(member)
              removed++
            }
          }
          return [null, removed]
        })
        return commandPipeline
      },
      expire(key: string, seconds: number) {
        commands.push(['expire', key, seconds])
        queued.push(() => {
          expirySecondsByKey.set(key, seconds)
          return [null, 1]
        })
        return commandPipeline
      },
      async exec(): Promise<Reply[]> {
        state.inFlight++
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
        await Promise.resolve()
        state.inFlight--
        if (state.failWith) {
          throw state.failWith
        }
        return queued.map((run) => run())
      },
    }
    return commandPipeline
  }

  return {
    client: { pipeline } as unknown as Pick<Redis, 'pipeline'>,
    sortedSets,
    commands,
    expirySecondsByKey,
    state,
  }
}
