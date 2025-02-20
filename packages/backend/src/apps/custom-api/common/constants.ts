// Custom API Timeout
export const CUSTOM_API_TIMEOUT = 1000 * 30 // in milliseconds
export const CUSTOM_API_TIMEOUT_ERROR = `timeout of ${CUSTOM_API_TIMEOUT}ms exceeded`
export const CUSTOM_API_TIMEOUT_ERROR_STR = `HTTP request timed out after ${
  CUSTOM_API_TIMEOUT / 1000
}s` // in seconds for readability
