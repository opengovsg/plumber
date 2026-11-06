# Prepend nvm use when the command runs npm, npx, pnpm, or node.
# A shell above the checkout has no .nvmrc. Walk up, then the project dir,
# the git root, or a single repos/* checkout.
# A later cd into a different pin aborts unless nvm use && follows that cd.
# A cd target that does not exist yet keeps the starting pin.
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
        + "_cmd=" + (.tool_input.command | @sh) + "; "
        + "_shown=$(printf '%s' \"$_cmd\" | sed \"s/'[^']*'//g\"); _rest=$_shown; _dest=; "
        + "if printf '%s' \"$_shown\" | grep -Eq '(^|[[:space:];|&])cd[[:space:]]'; then "
        + "_rest=$(printf '%s' \"$_shown\" | sed -E 's/.*cd[[:space:]]+[^;&|]*//'); "
        + "_dest=$(printf '%s' \"$_shown\" | grep -oE '(^|[[:space:];|&])cd[[:space:]]+[^[:space:];|&$]+' | tail -n 1 | sed -E 's/.*cd[[:space:]]+//'); fi; "
        + "if [ -n \"$_dest\" ] && ! printf '%s' \"$_rest\" | grep -Eq '(^|[[:space:];|&])nvm use[[:space:]]*[^&|;]*&&'; then "
        + "case $_dest in /*) _cd=$_dest ;; *) _cd=\"$PWD/$_dest\" ;; esac; "
        + "if [ -d \"$_cd\" ]; then _p=$_cd; while [ \"$_p\" != / ] && [ ! -f \"$_p/.nvmrc\" ]; do _p=$(dirname \"$_p\"); done; "
        + "if [ -f \"$_p/.nvmrc\" ] && [ \"$(tr -d '[:space:]' < \"$_p/.nvmrc\")\" != \"$(tr -d '[:space:]' < \"$_d/.nvmrc\")\" ]; then "
        + "echo \"cd $_dest uses a different .nvmrc. Run nvm use && after that cd.\" >&2; exit 1; fi; fi; fi; "
        + "nvm use \"$(tr -d '[:space:]' < \"$_d/.nvmrc\")\" >/dev/null 2>&1 || { echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; }; "
        + .tool_input.command
      )
    })
  }
}
else empty
end
