def severity_rank: {"critical": 5, "high": 4, "medium": 3, "low": 2}[.] // 1;
def is_app_path: test("(^|/)" + $pattern + "(/|$)");
def is_malware:
  ((.id // "") | startswith("MAL-"))
  or (([.properties[]? | select(.name == "amazon:inspector:sbom_scanner:is_malicious") | .value] | index("true")) != null);
def is_dockerfile: ((.id // "") | startswith("IN-DOCKER"));
# Plumber app packages are npm. A component with no purl could still be one.
def may_be_app_purl: (. == null) or startswith("pkg:npm/");

if has("sbom") | not then
  {sbom: false, app_components: 0, scanned: 0, located: 0,
   app_malware: 0, unresolved: 0, unresolved_malware: 0,
   critical: 0, high: 0, medium: 0, low: 0, other: 0}
else
  [.sbom.components[]? | recurse(.components[]?)] as $components
  | ([$components[]
      | select(has("bom-ref"))
      | {key: .["bom-ref"],
         value: [.properties[]?
                 | select(.name == "amazon:inspector:sbom_scanner:path"
                          or .name == "amazon:inspector:sbom_generator:source_path")
                 | .value
                 | select(type == "string" and . != "")]}]
     | from_entries) as $paths
  | ([$components[]
      | select(has("bom-ref"))
      | {key: .["bom-ref"], value: .purl}]
     | from_entries) as $purls
  | ($paths
     | [.[]] | flatten
     | map(select(is_app_path))
     | unique | length) as $app_components
  | [.sbom.vulnerabilities[]?
     | select(is_dockerfile | not)
     | {id: (.id // "unknown"),
        malware: is_malware,
        paths: [.affects[]?.ref | $paths[.]? // [] | .[]],
        may_be_app: ([.affects[]?.ref | $purls[.]? | may_be_app_purl] | length == 0 or any),
        rank: ([.ratings[]?
                | select((.method == "other" and (.source.name? // "") == "EPSS") | not)
                | .severity? | select(. != null) | ascii_downcase | severity_rank] | max // 1)}]
  | . as $findings
  | ($findings | map(select((.paths | any(is_app_path)) and .malware))) as $app_malware
  | ($findings | map(select(.paths | any(is_app_path)))) as $app_findings
  | ($findings | map(select(.paths | length == 0))) as $unresolved
  | {sbom: true,
     app_components: $app_components,
     scanned: ($findings | length),
     located: ($findings | map(select(.paths | length > 0)) | length),
     app_malware: ($app_malware | length),
     unresolved: ($unresolved | map(select(.may_be_app)) | length),
     unresolved_malware: ($unresolved | map(select(.malware)) | length)}
    + ($app_findings
       | group_by(.id)
       | map({rank: (map(.rank) | max)})
       | {critical: (map(select(.rank == 5)) | length),
          high: (map(select(.rank == 4)) | length),
          medium: (map(select(.rank == 3)) | length),
          low: (map(select(.rank == 2)) | length),
          other: (map(select(.rank == 1)) | length)})
end
