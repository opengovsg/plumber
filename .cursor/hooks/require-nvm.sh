#!/usr/bin/env bash
# Cursor hooks cannot rewrite a command, so deny and make the agent re-issue it.
exec jq -c '
  if (.command | test("\\bnvm use\\b")) then {permission: "allow"}
  elif (.command | test("\\b(npm|npx|node)\\b")) then
    {permission: "deny",
     agent_message: "Prefix the command with `nvm use && ` so the repo .nvmrc Node version is active."}
  else {permission: "allow"}
  end'
