#!/usr/bin/env bash
# Cursor hooks cannot rewrite a command, so deny and make the agent re-issue it.
# The shell tool prepends its own `nvm use` bootstrap before the user command,
# so the check cannot require the command to start with `nvm use`.
# Allow only when `nvm use` appears before npm, npx, pnpm, or node.
exec jq -c '
  if (.command | test("\\b(npm|npx|pnpm|node)\\b") | not) then {permission: "allow"}
  elif (.command | test("nvm use\\b[\\s\\S]*\\b(npm|npx|pnpm|node)\\b")) then {permission: "allow"}
  else
    {permission: "deny",
     agent_message: "Prefix the command with `nvm use && ` so the repo .nvmrc Node version is active."}
  end'
