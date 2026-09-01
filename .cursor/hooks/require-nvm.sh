#!/usr/bin/env bash
# Cursor hooks cannot rewrite a command, so deny and make the agent re-issue it.
# `nvm use` is anchored to the start because it has to run before npm, and a
# substring match anywhere would pass `npm install && nvm use`.
exec jq -c '
  if (.command | test("\\b(npm|npx|node)\\b") | not) then {permission: "allow"}
  elif (.command | test("^\\s*nvm use\\b[^&|;]*&&")) then {permission: "allow"}
  else
    {permission: "deny",
     agent_message: "Prefix the command with `nvm use && ` so the repo .nvmrc Node version is active."}
  end'
