/**
 * Loose regex to just accept only alphanumeric characters and dashes
 * since there is no proper public documentation with GatherSG.
 * Assumption is that the case uuid is alphanumeric and 22 characters long.
 */
export const CASE_UUID_REGEX = /^[a-zA-Z0-9]+$/
