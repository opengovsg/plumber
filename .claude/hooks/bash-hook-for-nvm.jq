# Prepend nvm use when the command runs npm, npx, pnpm, or node.
# A shell above the checkout has no .nvmrc, so fall back to CLAUDE_PROJECT_DIR.
# Requires jq and nvm. A missing nvm or an uninstalled pin aborts the command.
if (.tool_input.command | test("(?:^|[^\\w.])(?:[\\w.-]*/)*(?:npm|npx|pnpm|node)(?![\\w./-])"))
then {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: (.tool_input + {
      command: (
        "command -v nvm >/dev/null 2>&1 || { export NVM_DIR=\"${NVM_DIR:-$HOME/.nvm}\"; [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\" 2>/dev/null; }; "
        + "command -v nvm >/dev/null 2>&1 || { echo \"nvm not found. Aborting.\" >&2; exit 1; }; "
        + "_d=\"$PWD\"; while [ \"$_d\" != / ] && [ ! -f \"$_d/.nvmrc\" ]; do _d=$(dirname \"$_d\"); done; "
        + "if [ ! -f \"$_d/.nvmrc\" ] && [ -n \"${CLAUDE_PROJECT_DIR:-}\" ] && [ -f \"${CLAUDE_PROJECT_DIR}/.nvmrc\" ]; then _d=\"${CLAUDE_PROJECT_DIR}\"; fi; "
        + "[ -f \"$_d/.nvmrc\" ] || { echo \"nvm use failed: no .nvmrc found. Aborting.\" >&2; exit 1; }; "
        + "nvm use \"$(tr -d '[:space:]' < \"$_d/.nvmrc\")\" >/dev/null 2>&1 || { echo \"nvm use failed: pinned Node is not installed. Aborting.\" >&2; exit 1; }; "
        + .tool_input.command
      )
    })
  }
}
else empty
end
