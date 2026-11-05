# PreToolUse(Bash) rewrite: if the command invokes npm/npx/pnpm/node, select the
# nearest .nvmrc Node version before it runs. Other commands pass through
# untouched (empty output = no modification).
#
# Agent shells can start above the git checkout. That directory has no .nvmrc.
# `nvm use` with no path then aborts the command. The prefix walks from $PWD,
# then checks the project directory and a child checkout.
#
# A filename such as pnpm-lock.yaml is not a package-manager command.
# A path whose basename is the tool still is.
# A later cd into a different pin must run nvm use before the tool.
# pushd and popd abort. More than one repos checkout aborts.
#
# Team-wide notes:
#   * Requires `jq` on PATH (this filter runs via `jq -f`).
#   * Requires nvm. If the shell lacks the `nvm` function, the prefix sources
#     $NVM_DIR/nvm.sh (default ~/.nvm). If nvm is still missing, the command
#     aborts.
#   * If the pinned Node is not installed, the command aborts.
if (.tool_input.command | test("(?:^|[^\\w.])(?:[\\w.-]*/)*(?:npm|npx|pnpm|node)(?![\\w./-])"))
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
        + "if [ -z \"$_plumber_nvmrc\" ]; then _plumber_hits=; for _plumber_child in \"$PWD\"/repos/*; do if [ -f \"$_plumber_child/.nvmrc\" ]; then _plumber_hits=\"${_plumber_hits}${_plumber_child}\n\"; fi; done; _plumber_count=$(printf '%s' \"$_plumber_hits\" | grep -c . || true); if [ \"$_plumber_count\" -gt 1 ]; then echo \"nvm use failed: more than one repos checkout has an .nvmrc. Aborting.\" >&2; exit 1; fi; if [ \"$_plumber_count\" -eq 1 ]; then _plumber_nvmrc=$(printf '%s' \"$_plumber_hits\" | head -n 1)/.nvmrc; fi; fi; "
        + "if [ -z \"$_plumber_nvmrc\" ]; then echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; fi; "
        + "_plumber_node_version=$(tr -d \"[:space:]\" < \"$_plumber_nvmrc\"); "
        + ("_plumber_cmd='" + (.tool_input.command | gsub("'"; "'\\''")) + "'; ")
        + "_plumber_scan=$(printf '%s' \"$_plumber_cmd\" | sed \"s/'[^']*'//g\"); "
        + "if printf '%s' \"$_plumber_scan\" | grep -Eq '(^|[[:space:];|&])(pushd|popd)([[:space:]]|$)'; then echo \"nvm use failed: pushd and popd hide the directory pin. Aborting.\" >&2; exit 1; fi; "
        + "_plumber_dir=$PWD; _plumber_need=0; while IFS= read -r _plumber_seg; do _plumber_seg=$(printf '%s' \"$_plumber_seg\" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'); case \"$_plumber_seg\" in cd|cd\\ *) _plumber_dest=$(printf '%s' \"$_plumber_seg\" | sed 's/^cd[[:space:]]*//'); case \"$_plumber_dest\" in ''|*'$'*|*'${'*|*' '*|-*|*'('*|*')'*) echo \"nvm use failed: cd target is not a fixed directory. Aborting.\" >&2; exit 1;; /*) _plumber_dir=$_plumber_dest;; '~') _plumber_dir=$HOME;; '~'/*) _plumber_dir=$HOME/${_plumber_dest#\\~\\/};; *) _plumber_dir=$_plumber_dir/$_plumber_dest;; esac; if [ ! -d \"$_plumber_dir\" ]; then echo \"nvm use failed: cd target is not a fixed directory. Aborting.\" >&2; exit 1; fi; _plumber_dir=$(CDPATH= cd \"$_plumber_dir\" && pwd); _plumber_pin=; _plumber_walk=$_plumber_dir; while [ \"$_plumber_walk\" != / ]; do if [ -f \"$_plumber_walk/.nvmrc\" ]; then _plumber_pin=$(tr -d '[:space:]' < \"$_plumber_walk/.nvmrc\"); break; fi; _plumber_walk=$(dirname \"$_plumber_walk\"); done; if [ \"${_plumber_pin#v}\" != \"${_plumber_node_version#v}\" ]; then _plumber_need=1; else _plumber_need=0; fi;; nvm\\ use|nvm\\ use\\ *) _plumber_need=0;; *) if [ \"$_plumber_need\" -eq 1 ] && printf '%s' \"$_plumber_seg\" | grep -Eq '(^|[^[:alnum:]_.])(npm|npx|pnpm|node)([^[:alnum:]_./-]|$)'; then echo \"nvm use failed: cd reaches a different .nvmrc. Run nvm use in that directory. Aborting.\" >&2; exit 1; fi;; esac; done <<EOF
$(printf '%s' \"$_plumber_scan\" | sed 's/&&/\\n/g; s/||/\\n/g; s/[;|]/\\n/g')
EOF
"
        + "nvm use \"$_plumber_node_version\" >/dev/null 2>&1 || { echo \"nvm use failed: no .nvmrc found or pinned Node not installed. Aborting.\" >&2; exit 1; }; "
        + .tool_input.command
      )
    })
  }
}
else empty
end
