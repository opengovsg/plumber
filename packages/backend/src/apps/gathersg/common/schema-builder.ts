import { z } from 'zod'

import {
  isValidDateString,
  isValidDateTimeString,
  isValidTimeString,
} from './datetime-validators'
import { GatherSGCaseField } from './fetch-case-data'

const numberString = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed === '') {
      return undefined // reject empty strings
    }
    if (!isNaN(Number(trimmed))) {
      return Number(trimmed)
    }
  }
  return val // leave as-is so Zod sees invalid input
}, z.number({ invalid_type_error: 'Invalid number' }))

const defaultTypeMap: Record<string, z.ZodType> = {
  text: z.string().trim(),
  textarea: z.string().trim(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid date (YYYY-MM-DD)' })
    .refine((v) => isValidDateString(v, 'date'), {
      message: 'Invalid date',
    }), // 2025-10-14
  time: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}:\d{2}$/, { message: 'Invalid time (HH:MM:SS)' })
    .refine((v) => isValidTimeString(v), { message: 'Invalid time' }), // 20:42:00
  date_time: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/, {
      message: 'Invalid date & time (YYYY-MM-DDTHH:MM:SS+HH:MM)',
    })
    .refine((v) => isValidDateTimeString(v), {
      message: 'Invalid date & time',
    }), // 2025-10-14T20:42:00+08:00
  year_month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, { message: 'Invalid year & month (YYYY-MM)' })
    .refine((v) => isValidDateString(v, 'year_month'), {
      message: 'Invalid year & month',
    }), //2025-10
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, { message: 'Invalid year (YYYY)' }), //2025
  nric: z.string().trim(),
  fin: z.string().trim(),
  nric_fin: z.string().trim(),
  uen: z.string().trim(),
  email: z.string().trim().email({ message: 'Invalid email' }),
  sg_mobile_number: z
    .string()
    .trim()
    .regex(/^[89]\d{7}$/, { message: 'Invalid Singapore mobile number' }),
  sg_landline_number: z
    .string()
    .trim()
    .regex(/^6\d{7}$/, { message: 'Invalid Singapore landline number' }),
  sg_phone_number: z
    .string()
    .trim()
    .regex(/^[3689]\d{7}$/, { message: 'Invalid Singapore phone number' }),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, { message: 'Invalid phone number' }),
  radio: z.string().trim(),
  // number or number-like
  number: numberString,
  money: numberString,
}

export const buildObjectSchema = (fields: GatherSGCaseField[]) => {
  const shape: Record<string, z.ZodType> = {}
  for (const { name, type, optional } of fields) {
    const base = defaultTypeMap[type] ?? z.unknown()
    shape[name] = optional ? base.optional() : base
  }
  return z.object(shape)
}

export const buildFieldsSchema = (
  fields: { name: string; type: string; optional: boolean }[],
) => {
  const objectSchema = buildObjectSchema(fields)
  const fieldNames = new Set(fields.map((f) => f.name))

  // Base array entry (we ignore any fieldType coming from input)
  const entry = z.object({
    field: z.string().trim().min(1),
    value: z.unknown(),
  })

  return (
    z
      .array(entry)
      // 1) Catch unknown field names and duplicate fields early
      .superRefine((entries, ctx) => {
        const seenFields = new Set<string>()

        entries.forEach((e) => {
          // Check for unknown field names
          if (!fieldNames.has(e.field)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['caseFields'],
              message: `Unrecognized field: "${e.field}"`,
            })
          }

          // Check for duplicate field names
          if (seenFields.has(e.field)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['field'],
              message: `${e.field} field is repeated`,
            })
          } else {
            seenFields.add(e.field)
          }
        })
      })
      // 2) Transform to object { [field]: value }
      .transform((entries) =>
        Object.fromEntries(entries.map((e) => [e.field, e.value])),
      )
      // 3) Pipe through the object schema to validate values & required-ness
      .pipe(objectSchema)
  )
}

// Sample data types
// [
//   {
//     type: "text",
//     name: "Text",
//     maxLength: 500,
//   },
//   {
//     type: "textarea",
//     name: "Text Area",
//     maxLength: 500,
//   },
//   {
//     type: "number",
//     name: "Number",
//     precision: 0,
//   },
//   {
//     type: "money",
//     name: "Money",
//     precision: 0,
//   },
//   {
//     type: "dropdown",
//     name: "Dropdown",
//     allowMultiple: false,
//     options: ["Dropdown 1", "Dropdown 2", "Dropdown 3"],
//   },
//   {
//     type: "checkbox",
//     name: "Checkbox",

//     allowOthers: false,
//     options: ["Checkbox A", "Checkbox B", "Checkbox C"],
//   },
//   {
//     type: "radio",
//     name: "Radio button",
//     allowOthers: false,
//     options: ["Radio 1", "Radio 2"],
//   },
//   {
//     type: "date",
//     name: "Date",

//   },
//   {
//     type: "time",
//     name: "Time",

//   },
//   {
//     type: "date_time",
//     name: "Date & Time",

//   },
//   {
//     type: "year_month",
//     name: "Year & Month",

//   },
//   {
//     type: "year",
//     name: "Year",

//   },
//   {
//     type: "nric",
//     name: "NRIC",
//   },
//   {
//     type: "fin",
//     name: "FIN",
//   },
//   {
//     type: "nric_fin",
//     name: "NRIC/FIN",
//   },
//   {
//     type: "uen",
//     name: "UEN",
//   },
//   {
//     type: "email",
//     name: "Email address",
//   },
//   {
//     type: "sg_mobile_number",
//     name: "Singapore mobile number",
//   },
//   {
//     type: "sg_landline_number",
//     name: "Singapore landline number",
//   },
//   {
//     type: "sg_phone_number",
//     name: "Singapore mobile/landline number",
//   },
//   {
//     type: "phone_number",
//     name: "International phone number",

//   },
//   {
//     type: "table",
//     name: "Table",
//     maxRows: 5,
//     columns: [[Object], [Object]],
//   },
//   {
//     type: "attachment",
//     name: "Attachment",
//     maxCount: 1,
//     maxSize: 1024,
//   },
// ];
