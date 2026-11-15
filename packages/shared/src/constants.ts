export const confettiSurveyPublishableKey =
  'cfti_pk_dfde134552a318551e05559024f432ba'
// Routed through our own domain, since CSP only allows connecting to
// plumber.gov.sg domains directly (see packages/backend/src/helpers/csp.ts).
// IMPORTANT: this host follows the Confetti 0.5+ proxy contract (/api in the
// path, HEAD probes). It does not serve /widget, so only the /static and
// /components widget entries work through it.
export const confettiApiBaseUrl = 'https://confetti-surveys.plumber.gov.sg'
export const posthogProjectToken =
  'phc_nwcM6rC7WU7CzdW9Z4zvB3dcZWFM9fn2URbqs35FFQQQ'
export const posthogHost = 'https://a.plumber.gov.sg'
