# Landing

Landing is the public home page. A visitor reads the headline and opens sign-in.

## Sub-features

- `landing-headline` shows the public headline.
- `landing-get-started` opens the sign-in form.
- `landing-login` opens the same form from the header.

## How to get to it

- Open the site root.
- Choose `Login` in the header.
- Choose `Get started` on the headline.

## Steps

Preconditions:

- The browser is not signed in.

- **Open home.** Go to `/`. The heading `The easiest no-code automation tool for public service` is visible. The page title is `Plumber`.
- **Get started.** Choose the link `Get started`. The button `Get OTP` is visible.
- **Header login.** Go to `/` and choose the link `Login`. The button `Get OTP` is visible.
- **Proof.** Go to `/` and capture the page. It shows the headline and `Get started`.

## Gotchas

- `Get started` and `Login` are links, not buttons.
- `Guide` and `Status` leave the app. Do not follow them.
- Signed-in pages also use the title `Plumber`.
