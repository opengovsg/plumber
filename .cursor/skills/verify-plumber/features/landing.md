# Landing

Landing is the public home page. A visitor can read the product headline and open sign-in.

## Sub-features

- `landing-headline` shows the public headline.
- `landing-get-started` opens the sign-in form.
- `landing-login` opens the same sign-in form from the header.

## How to get to it (user POV)

- Open the site root.
- Choose `Login` in the header.
- Choose `Get started` on the headline.

## Driving it with control-plumber

Preconditions:

- `control-plumber doctor` prints `healthy`.
- No browser session is signed in. Use the Chrome profile from this launch.

- **Open home.** Go to the root. Run `control-plumber browser goto /`. The heading `The easiest no-code automation tool for public service` is visible. The document title is `Plumber`.
- **Get started.** Choose `Get started`. Run `control-plumber browser click --text "Get started"`. The `Get OTP` button is visible.
- **Header login.** Return home and choose `Login`. Run `control-plumber browser goto /` and `control-plumber browser click --text "Login"`. The `Get OTP` button is visible again.
- **Proof.** Capture the headline before leaving home. Run `control-plumber browser goto /`, `control-plumber browser snapshot --path landing/home.aria.txt`, and `control-plumber browser screenshot --path landing/home.png`. Both artifacts show the headline and `Get started`.

## Gotchas

- `Get started` and `Login` are links. A button role lookup misses them.
- `Guide` and `Status` leave the app. Do not follow them for this proof.
- The page title is `Plumber` on public pages. Signed-in pages keep that title too.
