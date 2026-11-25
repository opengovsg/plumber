import fs from 'fs'
import path from 'path'

import ts from 'typescript'

export const SRC_DIR = path.resolve(__dirname, '../../..')

function resolveImport(fromFile: string, specifier: string): string | null {
  let basePath: string
  if (specifier.startsWith('@/')) {
    basePath = path.join(SRC_DIR, specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), specifier)
  } else {
    return null
  }

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
  ]
  return (
    candidates.find(
      (candidate) =>
        /\.tsx?$/.test(candidate) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile(),
    ) ?? null
  )
}

export function collectReachableFiles(entryFile: string): Set<string> {
  const reached = new Set<string>([entryFile])
  const queue = [entryFile]

  while (queue.length > 0) {
    const file = queue.pop() as string
    const { importedFiles } = ts.preProcessFile(
      fs.readFileSync(file, 'utf8'),
      true,
      true,
    )

    for (const { fileName } of importedFiles) {
      const resolved = resolveImport(file, fileName)
      if (resolved && !reached.has(resolved)) {
        reached.add(resolved)
        queue.push(resolved)
      }
    }
  }

  return reached
}
