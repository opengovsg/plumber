import { readFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

// src/helpers/analytics/agency and dist/helpers/analytics/agency sit at the same depth.
export const AGENCY_DATA_DIR = path.resolve(__dirname, '../../../../data')

export const AGENCY_CATEGORIES = [
  'ministry',
  'statutory_board',
  'organ_of_state',
  'education',
  'healthcare',
  'ogp',
  'vendor',
] as const

export const UNCLASSIFIED = 'unclassified'

// A subdomain falls back to its parent domain, but never to these shared suffixes.
const SHARED_SUFFIXES = new Set(['gov.sg', 'edu.sg', 'com.sg', 'sg'])

const agencySchema = z.object({
  canonical: z.string().min(1),
  agency_name: z.string().min(1),
  category: z.enum(AGENCY_CATEGORIES),
})

const domainSchema = z.object({
  domain: z.string().min(1),
  canonical: z.string().min(1),
})

export type Agency = z.infer<typeof agencySchema>

export interface AgencyMapping {
  agencies: Map<string, Agency>
  domains: Map<string, string>
}

export interface ResolvedAgency {
  agency: Agency
  // The domain row that matched. It differs from the email's domain after a fallback.
  matchedDomain: string
}

/**
 * Parses RFC 4180 CSV: quoted fields may hold commas, and "" is a literal quote.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++
      }
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((value) => value !== ''))
}

function parseTable<T>(text: string, schema: z.ZodType<T>): T[] {
  const [header, ...rows] = parseCsv(text)
  if (!header) {
    throw new Error('CSV has no header row')
  }
  return rows.map((values) =>
    schema.parse(
      Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])),
    ),
  )
}

export function buildAgencyMapping(
  agenciesCsv: string,
  domainsCsv: string,
): AgencyMapping {
  const agencies = new Map<string, Agency>()
  for (const agency of parseTable(agenciesCsv, agencySchema)) {
    if (agency.canonical !== agency.canonical.toLowerCase()) {
      throw new Error(`Agency ${agency.canonical} must be lowercase`)
    }
    if (agencies.has(agency.canonical)) {
      throw new Error(`Duplicate agency ${agency.canonical}`)
    }
    agencies.set(agency.canonical, agency)
  }

  const domains = new Map<string, string>()
  for (const { domain, canonical } of parseTable(domainsCsv, domainSchema)) {
    if (domain !== domain.toLowerCase()) {
      throw new Error(`Domain ${domain} must be lowercase`)
    }
    if (domains.has(domain)) {
      throw new Error(`Duplicate domain ${domain}`)
    }
    if (!agencies.has(canonical)) {
      throw new Error(`Domain ${domain} maps to unknown agency ${canonical}`)
    }
    domains.set(domain, canonical)
  }
  return { agencies, domains }
}

export function loadAgencyMapping(dir = AGENCY_DATA_DIR): AgencyMapping {
  return buildAgencyMapping(
    readFileSync(path.join(dir, 'agencies.csv'), 'utf8'),
    readFileSync(path.join(dir, 'agency-domains.csv'), 'utf8'),
  )
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  const domain =
    at >= 0
      ? email
          .slice(at + 1)
          .trim()
          .toLowerCase()
      : ''
  return domain || null
}

/**
 * Finds the agency for a domain, dropping leading labels until a row matches.
 */
export function resolveAgency(
  mapping: AgencyMapping,
  domain: string,
): ResolvedAgency | null {
  const labels = domain.split('.')
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join('.')
    if (SHARED_SUFFIXES.has(candidate)) {
      return null
    }
    const canonical = mapping.domains.get(candidate)
    if (canonical) {
      const agency = mapping.agencies.get(canonical)
      return agency ? { agency, matchedDomain: candidate } : null
    }
  }
  return null
}
