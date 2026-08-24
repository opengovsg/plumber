# PreToolUse(Bash) rewrite: if the command invokes npm/npx/pnpm/node, prepend an
# `nvm use` so the repo's .nvmrc Node version is active. Other commands pass
# through untouched (empty output = no modification). The \b...\b word boundary
# means `node_modules` does NOT match (so e.g. `rm -rf node_modules` is left
# alone), only `node` as a standalone word.
#
# Team-wide notes:
#   * Requires `jq` on PATH (this filter runs via `jq -f`).
#   * Requires nvm to be loaded in your shell (so the `nvm` function exists in
#     Claude Code's shell snapshot). If nvm is NOT present, npm/npx/pnpm commands
#     are ABORTED with exit 1 — this repo requires nvm.
#   * If nvm IS present but `nvm use` fails (no .nvmrc found, or the pinned Node
#     isn't installed), the command is likewise ABORTED rather than running
#     npm/npx/pnpm on an unknown Node version.
if (.tool_input.command | test("\\b(npm|npx|pnpm|node)\\b"))
then {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: (.tool_input + {
      command: ("command -v nvm >/dev/null 2>&1 || { echo \"nvm not found; this repo requires nvm (see .nvmrc). Aborting.\" >&2; exit 1; }; nvm use >/dev/null 2>&1 || { echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; }; " + .tool_input.command)
    })
  }
}
else empty
end
