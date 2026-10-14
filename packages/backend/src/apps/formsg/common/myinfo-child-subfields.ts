/**
 * Shared naming for MyInfo child subfields.
 *
 * Mock data and real v4 submissions must produce identical variable keys and
 * questions, otherwise a pipe built against mock data breaks on a real
 * submission.
 */

// FormSG prefixes every child subfield id with this MyInfo attribute.
export const CHILDREN_KEY_PREFIX = 'childrenbirthrecords'

// Naming of MyInfo child subfields from https://github.com/opengovsg/FormSG/blob/develop/packages/shared/constants/field/myinfo/index.ts
export type ChildSubfield =
  | 'childname'
  | 'childbirthcertno'
  | 'childdateofbirth'
  | 'childgender'
  | 'childvaxxstatus'
  | 'childrace'
  | 'childsecondaryrace'
  | 'childtype'

interface ChildSubfieldDetails {
  displayLabel: string
  mockData: string
  isMyInfoFieldLabel: boolean
}

export const MYINFO_CHILD_SUBFIELD_MAP: Record<
  ChildSubfield,
  ChildSubfieldDetails
> = {
  childname: {
    displayLabel: 'Name',
    mockData: 'Jackson Kim',
    isMyInfoFieldLabel: true,
  },
  childbirthcertno: {
    displayLabel: 'Birth certificate number',
    mockData: 'T0700001J',
    isMyInfoFieldLabel: true,
  },
  childdateofbirth: {
    displayLabel: 'Date of birth',
    mockData: '23/01/2007', // MyInfo provides child DOB as DD/MM/YYYY...
    isMyInfoFieldLabel: true,
  },
  childgender: {
    displayLabel: 'Sex',
    mockData: 'MALE',
    isMyInfoFieldLabel: true,
  },
  childvaxxstatus: {
    displayLabel: 'Vaccination status',
    mockData:
      'MINIMUM VACCINATION REQUIREMENT FOR PRESCHOOL ADMISSION FULFILLED',
    isMyInfoFieldLabel: true,
  },
  childrace: {
    displayLabel: 'Race',
    mockData: 'CHINESE',
    isMyInfoFieldLabel: true,
  },
  // Removed by the children v2 schema. Kept for forms still on the old schema.
  childsecondaryrace: {
    displayLabel: 'Secondary race',
    mockData: 'OTHERS',
    isMyInfoFieldLabel: false,
  },
  // Added by the children v2 schema. LOCAL or SPONSORED.
  childtype: {
    displayLabel: 'Record type',
    mockData: 'SPONSORED',
    isMyInfoFieldLabel: true,
  },
}

/**
 * Builds the dataOut key for one child subfield.
 *
 * IMPORTANT: the key must never contain a dot. Dots delimit step and variable
 * paths, so a dotted key is unreachable via lodash get.
 */
export function buildChildSubfieldKey(
  fieldId: string,
  attr: string,
  childIndex: number,
): string {
  return [CHILDREN_KEY_PREFIX, fieldId, attr, childIndex]
    .join('_')
    .replaceAll('.', '_')
}

/**
 * Builds the question shown against one child subfield.
 *
 * @param childIndex 0-based, and rendered 1-based to match FormSG.
 */
export function buildChildSubfieldQuestion(
  attr: string,
  childIndex: number,
): string {
  // MyInfo may add attributes before we map them, so fall back to the raw attr.
  const details = MYINFO_CHILD_SUBFIELD_MAP[attr as ChildSubfield]
  const displayLabel = details?.displayLabel ?? attr
  const myInfoPrefix = details?.isMyInfoFieldLabel ? '[MyInfo]' : ''

  return `${myInfoPrefix} Child ${childIndex + 1} ${displayLabel}`
}
