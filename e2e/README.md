# Plumber End2End Test

This document outlines necessary details needed to use and develop our end-to-end test cases.

## Test cases

The general ideas for our end-to-end test cases are:

- Creating new pipes and add connections to test that triggers are working
- Triggering a pipe with webhooks leading to different actions based on the webhook data to test all actions

The full list of test cases can be found in [this Notion](https://opengov.notion.site/4e0774e4f1754bb096f2f263227ade69?v=54df8a90496b4bb197f4f0ff86514163&pvs=4).

## Setup

This section outlines the setup to test against different environments, either Plumber staging or local.

The below are the environment variables to configure for our end-to-end tests

- BASE_URL: pointing to the environment we want to test against
- MAILSENDER: the FROM address that we use to check received emails
- MAILBOX: the email inbox that we use to receive login and test emails from Plumber
- TRIGGER_FORM_ID: ID of the default form under the `MAILBOX` FormSG account (so it can be connected on Plumber). The connection for this form has been created in the corresponding account.

**Note**: The default values in [config.ts](./config.ts) are for testing against staging environment.

### Setting up against staging environment.

If you are using the default `MAILBOX` `internal-testing@open.gov.sg`, simply obtain `credentials.json` and `gmail_token.json` from 1Password.

If you are using an alternative `MAILBOX` other than `internal-testing@open.gov.sg`, there're a couple more steps involved:

- Genereate the same credential files like above following instructions from [here](https://www.notion.so/opengov/Generating-Gmail-API-Credentials-0e0884bfdc4144d79140b3edaba12996?pvs=4).
- Create a storage-mode form in FormSG using the same account used for `MAILBOX` with 2 fields:
  - `Short answer`: Short text field
  - `Attachment`: Attachment field
- Obtain the above form ID and secrets and create a connection inside Plumber
- Set `MAILBOX` and `TRIGGER_FORM_ID` environment variables respectively for our end-to-end test execution.

### Setting up against local environment.

To setup end-to-end test against your local environment, carry out the steps from the setup for testing against staging environment, and these extra steps below:

- Set `BASE_URL` env variable to target `http://localhost:3001`
- Create a new form under FormSG `internal-testing@open.gov.sg` (or whichever `MAILBOX` you are using) and name it `[<your name>] Local End to End` to create a connection with such form in your local Plumber instance and also to set `TRIGGER_FORM_ID` env variable
- Obtaining local Plumber auth session:
  - Set `APP_ENV` in `backend/.env` to `testing` (So actual email will be sent to `internal-testing@open.gov.sg` for authentication)
  - Trigger `npm run test` once so `globalSetup` will be triggered and generate `cookie-auth-state.json` (which can be reused for as long as the cookie is valid). This run will fail as the backend environment isn't set up to run locally properly this way.
  - Set `APP_ENV` in `backend/.env` back to `development`
  - Comment out `globalSetup` config inside [playwright.config.ts](./playwright.config.ts)
  - The end to end test suite now can be run normally
