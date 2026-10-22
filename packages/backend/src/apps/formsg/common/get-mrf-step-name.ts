/**
 * Shared so `get_form_schema` shows the same stage names Plumber gives the
 * MRF steps it creates.
 */
export function getMrfStepName(
  stepName: string | undefined,
  index: number,
): string {
  return stepName ? stepName.trim() : `MRF Step ${index + 1}`
}
