# Prepend nvm use when the command runs npm, npx, pnpm, or node.
# A shell above the checkout has no .nvmrc. Walk up, then the project dir,
# the git root, or a single repos/* checkout.
# Requires jq and nvm. A missing nvm or an uninstalled pin aborts the command.
if (.tool_input.command | test("(?:^|[^\\w.])(?:[\\w.-]*/)*(?:npm|npx|pnpm|node)(?![\\w./-])"))
then {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: (.tool_input + {
      command: (
        "command -v nvm >/dev/null 2>&1 || { export NVM_DIR=\"${NVM_DIR:-$HOME/.nvm}\"; [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\" 2>/dev/null; }; "
        + "command -v nvm >/dev/null 2>&1 || { echo \"nvm not found; this repo requires nvm (see .nvmrc). Aborting.\" >&2; exit 1; }; "
        + "_d=\"$PWD\"; while [ \"$_d\" != / ] && [ ! -f \"$_d/.nvmrc\" ]; do _d=$(dirname \"$_d\"); done; "
        + "if [ ! -f \"$_d/.nvmrc\" ] && [ -n \"${CLAUDE_PROJECT_DIR:-}\" ] && [ -f \"${CLAUDE_PROJECT_DIR}/.nvmrc\" ]; then _d=\"${CLAUDE_PROJECT_DIR}\"; fi; "
        + "if [ ! -f \"$_d/.nvmrc\" ]; then _t=$(git rev-parse --show-toplevel 2>/dev/null || true); if [ -n \"$_t\" ] && [ -f \"$_t/.nvmrc\" ]; then _d=\"$_t\"; fi; fi; "
        + "if [ ! -f \"$_d/.nvmrc\" ]; then _n=0; for _c in \"$PWD\"/repos/*/.nvmrc; do [ -f \"$_c\" ] || continue; _n=$((_n + 1)); _d=$(dirname \"$_c\"); done; if [ \"$_n\" -gt 1 ]; then echo \"nvm use failed: more than one repos checkout has an .nvmrc. Aborting.\" >&2; exit 1; fi; fi; "
        + "[ -f \"$_d/.nvmrc\" ] || { echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; }; "
        + "nvm use \"$(tr -d '[:space:]' < \"$_d/.nvmrc\")\" >/dev/null 2>&1 || { echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; }; "
        + .tool_input.command
      )
    })
  }
}
else empty
end
