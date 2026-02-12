import fs from 'fs'
import path from 'path'

/**
 * Extracts field names from a GraphQL query block
 * This parses the GraphQL query syntax to find all requested fields
 */
function extractFieldsFromQuery(queryText: string, typeName: string): string[] {
  // Find the block for the specified type (e.g., "arguments {")
  const typeRegex = new RegExp(`${typeName}\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`, 's')
  const match = queryText.match(typeRegex)

  if (!match) {
    return []
  }

  const block = match[1]
  const fields: string[] = []

  // Extract field names (lines that don't contain { or #)
  const lines = block.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments, empty lines, and lines with nested blocks
    if (trimmed && !trimmed.startsWith('#') && !trimmed.includes('{')) {
      fields.push(trimmed)
    }
  }

  return fields
}

/**
 * Reads the GraphQL query file and extracts all field names for substep arguments
 */
export function getSubstepArgumentFields(): string[] {
  const queryPath = path.join(
    __dirname,
    '../frontend/src/graphql/queries/get-apps.ts',
  )
  const queryContent = fs.readFileSync(queryPath, 'utf-8')

  // Extract fields from the "arguments" block in the query
  return extractFieldsFromQuery(queryContent, 'arguments')
}

/**
 * Reads the GraphQL query file and extracts all field names for auth fields
 */
export function getAuthFields(): string[] {
  const queryPath = path.join(
    __dirname,
    '../frontend/src/graphql/queries/get-apps.ts',
  )
  const queryContent = fs.readFileSync(queryPath, 'utf-8')

  // Extract fields from the "fields" block inside "auth"
  return extractFieldsFromQuery(queryContent, 'fields')
}
