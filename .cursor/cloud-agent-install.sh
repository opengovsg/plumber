#!/usr/bin/env bash
# Installs the toolchain and dependencies for a Cloud Agent VM.
# Real local dev secrets stay in 1Password. This path uses .env-example.
set -euo pipefail

cd /workspace

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" --no-use

node_version="$(tr -d '[:space:]' < .nvmrc)"
case "$node_version" in
  v*) ;;
  *) node_version="v${node_version}" ;;
esac
nvm install "$node_version"
nvm alias default "$node_version"
nvm use "$node_version"
node_bin="$NVM_DIR/versions/node/$node_version/bin"
if [ ! -x "$node_bin/node" ]; then
  echo "Node $node_version is not installed at $node_bin" >&2
  exit 1
fi
# /exec-daemon/node stays ahead of nvm on PATH. Select the .nvmrc binary.
export PATH="$node_bin:$PATH"
hash -r
sudo ln -sfn "$node_bin/node" /usr/local/bin/node
sudo ln -sfn "$node_bin/npm" /usr/local/bin/npm
sudo ln -sfn "$node_bin/npx" /usr/local/bin/npx
# Corepack in Node 22 cannot launch the pnpm 12 package layout.
# Node also ships pnpm shims, and npm install -g then fails with EEXIST.
pnpm_version="$(node -p "require('./package.json').packageManager.split('@')[1]")"
rm -f "$node_bin/pnpm" "$node_bin/pnpx"
npm install -g "pnpm@${pnpm_version}"
sudo ln -sfn "$node_bin/pnpm" /usr/local/bin/pnpm
sudo ln -sfn "$node_bin/pnpx" /usr/local/bin/pnpx

sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  docker.io \
  docker-compose-v2 \
  fuse-overlayfs \
  iptables

sudo tee /usr/local/bin/docker-compose >/dev/null <<'EOF'
#!/bin/sh
exec docker compose "$@"
EOF
sudo chmod 755 /usr/local/bin/docker-compose
sudo usermod -aG docker ubuntu

# Keep the registry token in the environment. Do not write it to .npmrc.
if [ -n "${NPM_TASKFORCESH_TOKEN:-}" ]; then
  export pnpm_config__auth
  pnpm_config__auth="$(
    jq -nc --arg token "$NPM_TASKFORCESH_TOKEN" \
      '{"https://npm.taskforce.sh":{"@taskforcesh":{"authToken":$token}}}'
  )"
fi
# Build pods often cannot reach npm.taskforce.sh. Cache the public packages.
# Start installs @taskforcesh/bullmq-pro when the session can reach the registry.
pnpm install --frozen-lockfile --config.fetch-retries=0 || true
