#!/usr/bin/env bash
# Regression tests for inspector-app-vulns.jq against the production Docker image layout.
set -euo pipefail

cd "$(dirname "$0")/../.."

pattern=$(sed -n 's/^ *APP_PATH_PATTERN: *//p' .github/workflows/deploy.yml)
if [ -z "$pattern" ]; then
  echo "FAIL: APP_PATH_PATTERN not found in deploy.yml"
  exit 1
fi

# The pattern must name the directory that holds production dependencies in the final image.
if ! grep -Eq "^COPY --from=build .*node_modules \./${pattern#opt/plumber/}$" Dockerfile; then
  echo "FAIL: APP_PATH_PATTERN '$pattern' does not match the Dockerfile node_modules destination"
  exit 1
fi

failures=0

# Builds an Inspector-shaped scan result. Each argument is "path|vuln_id|severity[|purl]".
# An empty vuln_id adds a component with no finding. An empty path omits the path property.
scan() {
  jq -n --args '
    [$ARGS.positional[] | split("|") | {path: .[0], id: .[1], severity: .[2], purl: .[3]}]
    | to_entries as $entries
    | {sbom: {
        components: [$entries[] | {
          "bom-ref": "comp-\(.key)",
          name: "pkg-\(.key)",
          properties: (if .value.path == "" then []
                       else [{name: "amazon:inspector:sbom_scanner:path", value: .value.path}] end)}
          + (if .value.purl then {purl: .value.purl} else {} end)],
        vulnerabilities: [$entries[] | select(.value.id != "") | {
          id: .value.id,
          ratings: [{severity: .value.severity}],
          affects: [{ref: "comp-\(.key)"}]}]}}
  ' "$@"
}

check() {
  local name=$1 expected=$2 input=$3
  local actual
  actual=$(jq -c --arg pattern "$pattern" -f .github/scripts/inspector-app-vulns.jq <<< "$input")
  if [ "$(jq -S . <<< "$actual")" = "$(jq -S . <<< "$expected")" ]; then
    echo "ok: $name"
  else
    echo "FAIL: $name"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    failures=$((failures + 1))
  fi
}

app="opt/plumber/packages/backend/node_modules"

check "clean scan sees app components" \
  '{"sbom":true,"app_components":2,"scanned":0,"located":0,"app_malware":0,"unresolved":0,"unresolved_malware":0,"critical":0,"high":0,"medium":0,"low":0,"other":0}' \
  "$(scan "/$app/express/package.json||" "$app/lodash/package.json||")"

critical_findings=()
for i in 1 2 3 4 5; do
  critical_findings+=("$app/pkg$i/package.json|CVE-2026-000$i|critical")
done
check "app findings exceeding critical threshold are counted" \
  '{"sbom":true,"app_components":6,"scanned":7,"located":7,"app_malware":1,"unresolved":0,"unresolved_malware":0,"critical":5,"high":0,"medium":0,"low":0,"other":1}' \
  "$(scan "${critical_findings[@]}" \
    "$app/evil/package.json|MAL-2026-1|" \
    "usr/local/lib/node_modules/npm/node_modules/tar/package.json|CVE-2026-9999|high")"

check "runtime and OS findings are ignored" \
  '{"sbom":true,"app_components":1,"scanned":2,"located":2,"app_malware":0,"unresolved":0,"unresolved_malware":0,"critical":0,"high":0,"medium":0,"low":0,"other":0}' \
  "$(scan "$app/express/package.json||" \
    "usr/local/lib/node_modules/npm/node_modules/tar/package.json|CVE-2026-9999|critical" \
    "lib/apk/db/installed|CVE-2026-8888|high")"

check "old root node_modules path is not an app path" \
  '{"sbom":true,"app_components":0,"scanned":1,"located":1,"app_malware":0,"unresolved":0,"unresolved_malware":0,"critical":0,"high":0,"medium":0,"low":0,"other":0}' \
  "$(scan "opt/plumber/node_modules/express/package.json|CVE-2026-7777|critical")"

check "partial mapping loss counts unresolved npm malware" \
  '{"sbom":true,"app_components":1,"scanned":2,"located":1,"app_malware":0,"unresolved":1,"unresolved_malware":1,"critical":0,"high":0,"medium":0,"low":0,"other":0}' \
  "$(scan "$app/express/package.json||" \
    "lib/apk/db/installed|CVE-2026-8888|high|pkg:apk/alpine/openssl@3.0.0" \
    "|MAL-0000-0001||pkg:npm/evil@1.0.0")"

check "unresolved finding without purl may be an app finding" \
  '{"sbom":true,"app_components":1,"scanned":1,"located":0,"app_malware":0,"unresolved":1,"unresolved_malware":0,"critical":0,"high":0,"medium":0,"low":0,"other":0}' \
  "$(scan "$app/express/package.json||" "|CVE-2026-6666|critical")"

check "unresolved OS finding is not an app finding" \
  '{"sbom":true,"app_components":1,"scanned":2,"located":1,"app_malware":0,"unresolved":0,"unresolved_malware":0,"critical":0,"high":0,"medium":0,"low":1,"other":0}' \
  "$(scan "$app/express/package.json|CVE-2026-5555|low" "|CVE-2026-4444|high|pkg:deb/debian/libc6@2.36")"

check "unresolved OS malware is still counted" \
  '{"sbom":true,"app_components":1,"scanned":1,"located":0,"app_malware":0,"unresolved":0,"unresolved_malware":1,"critical":0,"high":0,"medium":0,"low":0,"other":0}' \
  "$(scan "$app/express/package.json||" "|MAL-2026-2||pkg:deb/debian/evil@1.0")"

if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed"
  exit 1
fi
