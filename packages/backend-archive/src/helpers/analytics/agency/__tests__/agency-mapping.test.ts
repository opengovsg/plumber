import { describe, expect, it } from 'vitest'

import {
  AGENCY_CATEGORIES,
  buildAgencyMapping,
  emailDomain,
  loadAgencyMapping,
  parseCsv,
  resolveAgency,
} from '../agency-mapping'

const AGENCIES_CSV = [
  'canonical,agency_name,category',
  'tech.gov.sg,GovTech,statutory_board',
  'mccy.gov.sg,"Ministry of Culture, Community and Youth",ministry',
  'cris.sg,Consortium for Clinical Research and Innovation,healthcare',
].join('\n')

const DOMAINS_CSV = [
  'domain,canonical',
  'tech.gov.sg,tech.gov.sg',
  'hive.gov.sg,tech.gov.sg',
  'mccy.gov.sg,mccy.gov.sg',
  'cris.sg,cris.sg',
].join('\n')

const mapping = buildAgencyMapping(AGENCIES_CSV, DOMAINS_CSV)

describe('parseCsv', () => {
  it('reads quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['d', 'e', 'f'],
    ])
  })
})

describe('buildAgencyMapping', () => {
  it('reads both files', () => {
    expect(mapping.agencies.get('mccy.gov.sg')?.agency_name).toBe(
      'Ministry of Culture, Community and Youth',
    )
    expect(mapping.domains.get('hive.gov.sg')).toBe('tech.gov.sg')
  })

  it.each([
    ['domain,canonical\nnew.gov.sg,missing.gov.sg', 'unknown agency'],
    [
      'domain,canonical\ntech.gov.sg,tech.gov.sg\ntech.gov.sg,tech.gov.sg',
      'Duplicate domain',
    ],
    ['domain,canonical\nTech.gov.sg,tech.gov.sg', 'lowercase'],
  ])('rejects %s', (domainsCsv, message) => {
    expect(() => buildAgencyMapping(AGENCIES_CSV, domainsCsv)).toThrow(message)
  })

  it('rejects an agency key that is not lowercase', () => {
    expect(() =>
      buildAgencyMapping(
        'canonical,agency_name,category\nTech.gov.sg,GovTech,statutory_board',
        'domain,canonical\ntech.gov.sg,Tech.gov.sg',
      ),
    ).toThrow('Agency Tech.gov.sg must be lowercase')
  })

  it('rejects an unknown category', () => {
    expect(() =>
      buildAgencyMapping(
        'canonical,agency_name,category\nx.gov.sg,X,charity',
        'domain,canonical',
      ),
    ).toThrow()
  })
})

describe('resolveAgency', () => {
  it.each([
    ['tech.gov.sg', 'tech.gov.sg', 'tech.gov.sg'],
    ['hive.gov.sg', 'tech.gov.sg', 'hive.gov.sg'],
    ['gt.tech.gov.sg', 'tech.gov.sg', 'tech.gov.sg'],
    ['a.b.tech.gov.sg', 'tech.gov.sg', 'tech.gov.sg'],
    ['scri.cris.sg', 'cris.sg', 'cris.sg'],
  ])('maps %s to %s through %s', (domain, canonical, matchedDomain) => {
    expect(resolveAgency(mapping, domain)).toEqual({
      agency: mapping.agencies.get(canonical),
      matchedDomain,
    })
  })

  it.each(['unknown.gov.sg', 'gov.sg', 'tech.gov.sg.evil.com', 'x.edu.sg'])(
    'finds no agency for %s',
    (domain) => {
      expect(resolveAgency(mapping, domain)).toBeNull()
    },
  )
})

describe('emailDomain', () => {
  it.each([
    ['Officer@Tech.Gov.SG', 'tech.gov.sg'],
    ['a@b@tech.gov.sg ', 'tech.gov.sg'],
    ['no-at-sign', null],
    ['trailing@', null],
  ])('reads %s', (email, domain) => {
    expect(emailDomain(email)).toBe(domain)
  })
})

describe('the committed mapping files', () => {
  const committed = loadAgencyMapping()

  it('load without errors and map every domain to a known agency', () => {
    expect(committed.domains.size).toBeGreaterThan(0)
    for (const canonical of committed.domains.values()) {
      expect(committed.agencies.has(canonical)).toBe(true)
    }
  })

  it('use only known categories', () => {
    for (const agency of committed.agencies.values()) {
      expect(AGENCY_CATEGORIES).toContain(agency.category)
    }
  })

  it('map a listed key domain to its own agency', () => {
    for (const canonical of committed.agencies.keys()) {
      expect(committed.domains.get(canonical) ?? canonical).toBe(canonical)
    }
  })
})
