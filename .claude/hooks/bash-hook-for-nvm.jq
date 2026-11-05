# PreToolUse(Bash) rewrite: if the command invokes npm/npx/pnpm/node, select the
# nearest .nvmrc Node version before it runs. Other commands pass through
# untouched (empty output = no modification).
#
# Agent shells can start above the git checkout. That directory has no .nvmrc.
# `nvm use` with no path then aborts the command. The prefix walks from $PWD,
# then checks the project directory and a child checkout.
#
# A filename such as pnpm-lock.yaml is not a package-manager command.
#
# Team-wide notes:
#   * Requires `jq` on PATH (this filter runs via `jq -f`).
#   * Requires nvm. If the shell lacks the `nvm` function, the prefix sources
#     $NVM_DIR/nvm.sh (default ~/.nvm). If nvm is still missing, the command
#     aborts.
#   * If the pinned Node is not installed, the command aborts.
if (.tool_input.command | test("(?:^|[^\\w./])(?:npm|npx|pnpm|node)(?![\\w.-])"))
then {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: (.tool_input + {
      command: (
        "command -v nvm >/dev/null 2>&1 || { export NVM_DIR=\"${NVM_DIR:-$HOME/.nvm}\"; [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\" 2>/dev/null; }; "
        + "command -v nvm >/dev/null 2>&1 || { echo \"nvm not found; this repo requires nvm (see .nvmrc). Aborting.\" >&2; exit 1; }; "
        + "_plumber_nvmrc=; d=\"$PWD\"; while [ \"$d\" != / ]; do if [ -f \"$d/.nvmrc\" ]; then _plumber_nvmrc=\"$d/.nvmrc\"; break; fi; d=$(dirname \"$d\"); done; "
        + "if [ -z \"$_plumber_nvmrc\" ] && [ -n \"${CLAUDE_PROJECT_DIR:-}\" ] && [ -f \"${CLAUDE_PROJECT_DIR}/.nvmrc\" ]; then _plumber_nvmrc=\"${CLAUDE_PROJECT_DIR}/.nvmrc\"; fi; "
        + "if [ -z \"$_plumber_nvmrc\" ]; then _plumber_top=$(git rev-parse --show-toplevel 2>/dev/null || true); if [ -n \"$_plumber_top\" ] && [ -f \"$_plumber_top/.nvmrc\" ]; then _plumber_nvmrc=\"$_plumber_top/.nvmrc\"; fi; fi; "
        + "if [ -z \"$_plumber_nvmrc\" ]; then for _plumber_child in \"$PWD\"/repos/*; do if [ -f \"$_plumber_child/.nvmrc\" ]; then _plumber_nvmrc=\"$_plumber_child/.nvmrc\"; break; fi; done; fi; "
        + "if [ -z \"$_plumber_nvmrc\" ]; then echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; fi; "
        + "_plumber_node_version=$(tr -d \"[:space:]\" < \"$_plumber_nvmrc\"); "
        + "nvm use \"$_plumber_node_version\" >/dev/null 2>&1 || { echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; }; "
        + .tool_input.command
      )
    })
  }
}
else empty
end
