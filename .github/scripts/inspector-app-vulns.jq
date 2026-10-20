def severity_rank: {"critical": 5, "high": 4, "medium": 3, "low": 2}[.] // 1;
def is_app_path: test("(^|/)" + $pattern + "(/|$)");
def is_malware:
  ((.id // "") | startswith("MAL-"))
  or (([.properties[]? | select(.name == "amazon:inspector:sbom_scanner:is_malicious") | .value] | index("true")) != null);
def is_dockerfile: ((.id // "") | startswith("IN-DOCKER"));

if has("sbom") | not then
  {sbom: false, app_components: 0, scanned: 0, located: 0,
   app_malware: 0, critical: 0, high: 0, medium: 0, low: 0, other: 0}
else
  [.sbom.components[]? | recurse(.components[]?)] as $components
  | ([$components[]
      | select(has("bom-ref"))
      | {key: .["bom-ref"],
         value: [.properties[]?
                 | select(.name == "amazon:inspector:sbom_scanner:path"
                          or .name == "amazon:inspector:sbom_generator:source_path")
                 | .value]}]
     | from_entries) as $paths
  | ($paths
     | [.[]] | flatten
     | map(select(type == "string" and is_app_path))
     | unique | length) as $app_components
  | [.sbom.vulnerabilities[]?
     | select(is_dockerfile | not)
     | {id: (.id // "unknown"),
        malware: is_malware,
        paths: [.affects[]?.ref | $paths[.]? // [] | .[]],
        rank: ([.ratings[]?
                | select((.method == "other" and (.source.name? // "") == "EPSS") | not)
                | .severity? | select(. != null) | ascii_downcase | severity_rank] | max // 1)}]
  | . as $findings
  | ($findings | map(select((.paths | any(is_app_path)) and .malware))) as $app_malware
  | ($findings | map(select(.paths | any(is_app_path)))) as $app_findings
  | {sbom: true,
     app_components: $app_components,
     scanned: ($findings | length),
     located: ($findings | map(select(.paths | length > 0)) | length),
     app_malware: ($app_malware | length)}
    + ($app_findings
       | group_by(.id)
       | map({rank: (map(.rank) | max)})
       | {critical: (map(select(.rank == 5)) | length),
          high: (map(select(.rank == 4)) | length),
          medium: (map(select(.rank == 3)) | length),
          low: (map(select(.rank == 2)) | length),
          other: (map(select(.rank == 1)) | length)})
end
