#!/usr/bin/env bash
# Starts local datastores and the sample-env dev processes.
# Skips the Cloudflare tunnel. That service needs CLOUDFLARE_TOKEN.
set -euo pipefail

cd /workspace

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" --no-use
node_version="$(tr -d '[:space:]' < /workspace/.nvmrc)"
case "$node_version" in
  v*) ;;
  *) node_version="v${node_version}" ;;
esac
nvm install "$node_version"
nvm use "$node_version"
node_bin="$NVM_DIR/versions/node/$node_version/bin"
if [ ! -x "$node_bin/node" ]; then
  echo "Node $node_version is not installed at $node_bin" >&2
  exit 1
fi
export PATH="$node_bin:$PATH"
hash -r

# The VM's legacy FORWARD policy is DROP. nftables rules from Docker do not
# let one compose service reach another, so MinIO bucket setup times out.
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

if ! docker info >/dev/null 2>&1; then
  sudo mkdir -p /etc/docker
  printf '%s\n' '{"storage-driver":"fuse-overlayfs","firewall-backend":"iptables","ip6tables":false}' \
    | sudo tee /etc/docker/daemon.json >/dev/null
  sudo dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &
  ready=0
  for _ in $(seq 1 60); do
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
    if docker info >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [ "$ready" != 1 ]; then
    echo "dockerd did not become ready" >&2
    exit 1
  fi
fi
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

ensure_image() {
  local name="$1"
  local source="$2"
  if docker image inspect "$name" >/dev/null 2>&1; then
    return 0
  fi
  docker pull "$source"
  docker tag "$source" "$name"
}

# Public ECR serves these official images. Docker Hub layer storage is blocked.
ensure_image postgres:14-alpine public.ecr.aws/docker/library/postgres:14-alpine
ensure_image postgres:16.6-bookworm public.ecr.aws/docker/library/postgres:16.6-bookworm
ensure_image redis:6.2.0-alpine public.ecr.aws/docker/library/redis:6.2.0-alpine
# Compose pins 3.3.1. A missing local tag makes Compose pull Docker Hub.
ensure_image amazon/dynamodb-local:3.3.1 public.ecr.aws/aws-dynamodb-local/aws-dynamodb-local:latest
docker tag amazon/dynamodb-local:3.3.1 amazon/dynamodb-local:latest

minio_image="minio/minio:RELEASE.2025-09-07T16-13-09Z"
mc_image="minio/mc:RELEASE.2025-08-13T08-35-41Z"
if ! docker image inspect "$minio_image" >/dev/null 2>&1; then
  work="$(mktemp -d)"
  curl -fsSL -o "$work/minio" \
    "https://github.com/minio/minio/releases/download/RELEASE.2025-09-07T16-13-09Z/minio.linux-amd64.RELEASE.2025-09-07T16-13-09Z"
  curl -fsSL -o "$work/mc" \
    "https://github.com/minio/mc/releases/download/RELEASE.2025-08-13T08-35-41Z/mc.linux-amd64.RELEASE.2025-08-13T08-35-41Z"
  cat >"$work/Dockerfile" <<'EOF'
FROM public.ecr.aws/docker/library/ubuntu:24.04
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY minio /usr/bin/minio
COPY mc /usr/bin/mc
RUN chmod 755 /usr/bin/minio /usr/bin/mc
ENTRYPOINT ["minio"]
EOF
  ensure_image public.ecr.aws/docker/library/ubuntu:24.04 public.ecr.aws/docker/library/ubuntu:24.04
  docker build -t "$minio_image" "$work"
  rm -rf "$work"
fi
docker tag "$minio_image" "$mc_image"

export CLOUDFLARE_TOKEN="${CLOUDFLARE_TOKEN:-unused}"
compose=(docker compose -f /workspace/packages/backend/docker-compose.dev.yml)
(
  cd /workspace/packages/backend
  docker compose -f docker-compose.dev.yml up -d \
    postgres tiles-postgres redis minio dynamodb
)

ready=0
for _ in $(seq 1 60); do
  if "${compose[@]}" exec -T postgres pg_isready -U postgres >/dev/null \
    && "${compose[@]}" exec -T tiles-postgres pg_isready -U postgres >/dev/null \
    && "${compose[@]}" exec -T redis redis-cli ping >/dev/null \
    && "${compose[@]}" exec -T minio curl -sf --max-time 3 http://127.0.0.1:9000/minio/health/live >/dev/null
  then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  echo "datastores did not become ready" >&2
  exit 1
fi

(
  cd /workspace/packages/backend
  docker compose -f docker-compose.dev.yml up \
    --force-recreate \
    --abort-on-container-exit \
    --exit-code-from create-minio-buckets \
    create-minio-buckets
)

if [ -z "${NPM_TASKFORCESH_TOKEN:-}" ]; then
  echo "NPM_TASKFORCESH_TOKEN is required to install @taskforcesh/bullmq-pro" >&2
  exit 1
fi

# The build caches public packages only. The registry token exists in the session.
export pnpm_config__auth
pnpm_config__auth="$(
  jq -nc --arg token "$NPM_TASKFORCESH_TOKEN" \
    '{"https://npm.taskforce.sh":{"@taskforcesh":{"authToken":$token}}}'
)"
pnpm install --frozen-lockfile

# db:migrate prompts for a 1Password environment and aborts without a TTY.
# knex reads .env-example when APP_ENV is development.
(
  cd /workspace/packages/backend
  APP_ENV=development pnpm exec knex migrate:latest
)

# A new email checks LaunchDarkly before the user row exists.
# The sample SDK key never connects, so that call hangs.
# An existing row skips the check.
docker compose -f /workspace/packages/backend/docker-compose.dev.yml exec -T postgres \
  psql -U postgres -d plumber_dev \
  -c "INSERT INTO users (email) VALUES ('admin@example.gov.sg') ON CONFLICT (email) DO NOTHING;"

pnpm --filter backend run dynamodb:setup

if tmux has-session -t plumber-dev 2>/dev/null; then
  exit 0
fi

# turbo.json sets ui to tui. A detached session needs a stream log.
tmux new-session -d -s plumber-dev -c /workspace \
  "export PATH='$node_bin':\$PATH TURBO_UI=stream; exec pnpm run dev:sample-env"

app_ready=0
for _ in $(seq 1 90); do
  backend_up=0
  frontend_up=0
  if (echo >/dev/tcp/127.0.0.1/3000) >/dev/null 2>&1; then
    backend_up=1
  fi
  if (echo >/dev/tcp/127.0.0.1/3001) >/dev/null 2>&1; then
    frontend_up=1
  fi
  if [ "$backend_up" = 1 ] && [ "$frontend_up" = 1 ]; then
    app_ready=1
    break
  fi
  sleep 2
done
if [ "$app_ready" != 1 ]; then
  echo "dev:sample-env did not listen on ports 3000 and 3001" >&2
  tmux capture-pane -t plumber-dev -p | tail -40 >&2 || true
  exit 1
fi
