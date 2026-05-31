# Plumber Hello World — Webhook → Delay → Telegram

A minimal working flow that triggers on demand, waits a fixed time, then sends a Telegram message. Use this to smoke-test a working local setup.

## Flow steps

| # | Type | App | What it does |
|---|------|-----|--------------|
| 1 | Trigger | Webhook | Starts the flow when an HTTP POST arrives |
| 2 | Action | Delay | Waits a fixed duration before continuing |
| 3 | Action | Telegram | Sends a message to a chat/topic |

## Setting it up in the editor

1. Go to `http://localhost:3001` and log in
2. Create a new pipe → add **Webhook** as the trigger
3. Add step → **Delay** → choose unit (minutes/hours/days/weeks) and value
4. Add step → **Telegram** → connect your bot, set chat ID and message text
5. In the message text field, you can reference webhook data with the variable picker:
   - e.g. `Hello, {{1.message}}` inserts the `message` field from the webhook payload
6. Click **Publish**

## Triggering the flow

```powershell
# Empty trigger
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/webhooks/<flow-id>" `
  -ContentType "application/json" `
  -Body '{}'

# With payload data (usable in later steps via {{1.fieldName}})
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/webhooks/<flow-id>" `
  -ContentType "application/json" `
  -Body '{"message": "Good morning!"}'
```

A `200 OK` response means the flow was accepted and is now running.

## Checking execution

- Go to the **Executions** tab (clock icon in the editor top nav)
- Each execution shows Data In / Data Out per step
- The Delay step shows `delayForUnit` and `delayForValue` in its Data Out
- The Telegram step shows the final rendered message text

## How the delay works in code

`delayForValue` + `delayForUnit` → milliseconds via `packages/backend/src/helpers/delay-for-as-milliseconds.ts`, then passed to BullMQ as the step delay. Units: minutes × 60 000, hours × 3 600 000, days × 86 400 000, weeks × 604 800 000.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Telegram message contains variable name (e.g. `Hello Worldminutes`) | Wrong variable referenced in message field | Open the step, remove the incorrect variable badge, re-add the correct one |
| `200 OK` but nothing happens | Flow is not published | Click **Publish** in the editor |
| Scheduler trigger fires too slowly for testing | Minimum interval is 1 hour | Swap to Webhook trigger during development; restore scheduler before going live |
