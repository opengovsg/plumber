import z from 'zod'

import { CELL_A1_ADDRESS_REGEX } from '../../common/workbook-helpers/cells'

// TODO: We should probably store zod schemas in app / action / trigger
// definitions.
export const parametersSchema = z.object({
  fileId: z
    .string()
    .trim()
    .min(1, { message: 'Please choose a file to edit.' }),
  worksheetId: z
    .string()
    .trim()
    .min(1, { message: 'Please select a worksheet to edit.' }),
  cells: z
    .array(
      z.object({
        address: z
          .string()
          .trim()
          .min(1, {
            message: 'Please make sure there are no empty cell addresses.',
          })
          .refine(
            (input) => CELL_A1_ADDRESS_REGEX.test(input),
            (input) => ({
              message: `Please input cell address '${input}' in A1 notation.`,
            }),
          ),
        // Not trimming value; we should write user's input as-is.
        value: z.string().nullish(),
      }),
    )
    .min(1)
    .max(3, {
      message: 'Please write to no more than 3 cells in a single step.',
    }),
})
