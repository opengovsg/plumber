# Sign in

Sign in lets a new officer request an OTP for a `.gov.sg` email and land on an empty pipes page.

## Sub-features

- `sign-in-request` submits an email and requests an OTP.
- `sign-in-verify` accepts the OTP and opens pipes.

## How to get to it

- Choose `Login` on the home page.
- Choose `Get started` on the home page.
- Open `/login`.

## Steps

Preconditions:

- The email is new for this run. See [Drive the Plumber UI](../drive-ui.md#3-log-in).

- **Open the form.** Go to `/login`. The button `Get OTP` is visible.
- **Request an OTP.** Fill the field with placeholder `e.g. user@agency.gov.sg` and choose `Get OTP`. The label `Enter OTP sent to <email>` is visible.
- **Read the OTP.** Read the newest `OTP for <email>` line in the dev server log. It is a 6-character code.
- **Verify.** Fill the field with placeholder `ABC123` and choose `Verify OTP`. The URL reaches `/flows`.
- **Proof.** Close the announcement dialog and capture the page. It shows `How do you want to create your workflow?` and `Start from scratch`.

## Gotchas

- Only `.gov.sg` addresses pass. Other domains need a whitelist row.
- The backend prints the OTP about 100 ms after the request.
- Choose `Get OTP` once. A second request within 30 seconds fails.
- Five wrong OTPs lock the user.
- sgID and one.gov.sg fail on placeholders. Do not choose them.
- Success means the URL left `/login`. Do not report success from the OTP form.
