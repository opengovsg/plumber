# Sign in

Sign in lets a new officer request a code for a `.gov.sg` email and land on an empty pipes page.

## Sub-features

- `sign-in-request` submits an email and asks for a code.
- `sign-in-verify` accepts the development OTP and opens pipes.

## How to get to it (user POV)

- Choose `Login` on the home page.
- Choose `Get started` on the home page.
- Open `/login`.

## Driving it with control-plumber

Preconditions:

- `control-plumber doctor` prints `healthy`.
- The email from `control-plumber email` has never signed in on this instance.
- The backend is the development server from `launch`, so it prints the OTP.

- **Open the form.** Go to sign-in. Run `control-plumber browser goto /login`. The button `Get OTP` is visible.
- **Request a code.** Enter this run's email and choose `Get OTP`. Run `control-plumber browser fill --placeholder "e.g. user@agency.gov.sg" --value "$(control-plumber email)"` and `control-plumber browser click --role button --name "Get OTP"`. The label `Enter OTP sent to` plus that email is visible.
- **Read the code.** Run `control-plumber otp`. Stdout is a 6 character code.
- **Verify.** Enter the code and choose `Verify OTP`. Run `control-plumber browser fill --placeholder "ABC123" --value "$(control-plumber otp)"` and `control-plumber browser click --role button --name "Verify OTP"`. The heading `How do you want to create your workflow?` is visible.
- **Proof.** Capture the empty pipes page. Run `control-plumber browser snapshot --path sign-in/pipes.aria.txt` and `control-plumber browser screenshot --path sign-in/pipes.png`. Both show `How do you want to create your workflow?` and `Start from scratch`.

## Gotchas

- Only `.gov.sg` addresses pass. Other domains need a whitelist row this database does not have.
- A brand new email waits on LaunchDarkly before the user row exists. The sample SDK key never connects, so that wait does not finish. `launch` inserts this run's email first. The form and the OTP are still the real sign-in path.
- Development prints the OTP about a tenth of a second after the request. `otp` waits for that line.
- A second request within 30 seconds is rejected. Do not click `Get OTP` twice.
- Five wrong codes lock the OTP. Use the printed code.
- sgID and one.gov.sg stay unavailable on this instance. Do not click them if a flag turns them on.
- After a successful verify the app redirects to `/flows`. Do not stay on `/login` and call that success.
