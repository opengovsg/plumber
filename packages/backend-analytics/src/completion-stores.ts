import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3'
import { z } from 'zod'

import {
  COMPLETION_PREFIX,
  type CompletionStore,
  type StoredObject,
} from './day-completion'

function isMissingS3Object(err: unknown): boolean {
  const name = (err as { name?: string }).name
  return name === 'NoSuchKey' || name === 'NotFound'
}

function isMissingFile(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT'
}

export function s3CompletionStore(
  s3Client: S3Client,
  bucket: string,
): CompletionStore {
  return {
    list: async (prefix) => {
      const objects: StoredObject[] = []
      let token: string | undefined
      do {
        const page = await s3Client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        )
        for (const { Key, LastModified } of page.Contents ?? []) {
          if (Key && LastModified) {
            objects.push({ key: Key, lastModified: LastModified })
          }
        }
        token = page.NextContinuationToken
      } while (token)
      return objects
    },
    read: async (key) => {
      try {
        const object = await s3Client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        )
        const bytes = await object.Body?.transformToByteArray()
        return bytes ? Buffer.from(bytes) : null
      } catch (err) {
        if (isMissingS3Object(err)) {
          return null
        }
        throw err
      }
    },
    lastModified: async (key) => {
      try {
        const head = await s3Client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        )
        return head.LastModified ?? null
      } catch (err) {
        if (isMissingS3Object(err)) {
          return null
        }
        throw err
      }
    },
  }
}

export function localDirCompletionStore(dir: string): CompletionStore {
  const modifiedAt = async (key: string): Promise<Date | null> => {
    try {
      return (await stat(path.join(dir, key))).mtime
    } catch (err) {
      if (isMissingFile(err)) {
        return null
      }
      throw err
    }
  }
  return {
    list: async (prefix) => {
      let names: string[]
      try {
        names = await readdir(path.join(dir, prefix))
      } catch (err) {
        if (isMissingFile(err)) {
          return []
        }
        throw err
      }
      const objects: StoredObject[] = []
      for (const name of names) {
        const key = `${prefix}${name}`
        const lastModified = await modifiedAt(key)
        if (lastModified) {
          objects.push({ key, lastModified })
        }
      }
      return objects
    },
    read: async (key) => {
      try {
        return await readFile(path.join(dir, key))
      } catch (err) {
        if (isMissingFile(err)) {
          return null
        }
        throw err
      }
    },
    lastModified: modifiedAt,
  }
}

const exportSourceSchema = z.object({
  appEnv: z.string(),
  host: z.string(),
  database: z.string(),
  // Only the mutation log reads a log group, so a silver export leaves it unset.
  logGroup: z.string().optional(),
})

export type ExportSource = z.infer<typeof exportSourceSchema>

const LOCAL_SOURCE_KEY = `${COMPLETION_PREFIX}source.json`

const describe = ({ appEnv, host, database, logGroup }: ExportSource) =>
  `${appEnv} (${host}/${database}${logGroup ? `, ${logGroup}` : ''})`

/**
 * Ties a local export folder to the database that first wrote it.
 *
 * Completion files say a day is done, not where its rows came from, so a folder reused against another database would skip days.
 */
export async function claimLocalExportDir(
  dir: string,
  source: ExportSource,
): Promise<void> {
  const file = path.join(dir, LOCAL_SOURCE_KEY)
  let existing: string | null = null
  try {
    existing = await readFile(file, 'utf8')
  } catch (err) {
    if (!isMissingFile(err)) {
      throw err
    }
  }
  if (existing === null) {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
    await writeFile(file, JSON.stringify(source), { mode: 0o600 })
    return
  }
  const claimed = exportSourceSchema.parse(JSON.parse(existing))
  if (
    claimed.appEnv !== source.appEnv ||
    claimed.host !== source.host ||
    claimed.database !== source.database ||
    (claimed.logGroup !== undefined &&
      source.logGroup !== undefined &&
      claimed.logGroup !== source.logGroup)
  ) {
    throw new Error(
      `${dir} holds an export from ${describe(claimed)}, but this run reads ${describe(source)}. Use a new folder.`,
    )
  }
  if (claimed.logGroup === undefined && source.logGroup !== undefined) {
    await writeFile(
      file,
      JSON.stringify({ ...claimed, logGroup: source.logGroup }),
      {
        mode: 0o600,
      },
    )
  }
}
