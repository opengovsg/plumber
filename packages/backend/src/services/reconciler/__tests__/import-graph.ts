import fs from 'fs'
import path from 'path'

import { parseSync } from 'oxc-parser'

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

  // NodeNext specifiers name the emitted `.js` file; the source is `.ts`.
  basePath = basePath.replace(/\.js$/, '')
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
    const source = fs.readFileSync(file, 'utf8')
    const { module } = parseSync(file, source)
    const specifiers = [
      ...module.staticImports.map((entry) => entry.moduleRequest.value),
      ...module.staticExports.flatMap((entry) =>
        entry.entries.flatMap((exported) =>
          exported.moduleRequest ? [exported.moduleRequest.value] : [],
        ),
      ),
      // Only string-literal dynamic imports name a file statically.
      ...module.dynamicImports.flatMap(({ moduleRequest }) => {
        const literal = source.slice(moduleRequest.start, moduleRequest.end)
        return /^(['"]).*\1$/.test(literal) ? [literal.slice(1, -1)] : []
      }),
    ]

    for (const fileName of specifiers) {
      const resolved = resolveImport(file, fileName)
      if (resolved && !reached.has(resolved)) {
        reached.add(resolved)
        queue.push(resolved)
      }
    }
  }

  return reached
}
