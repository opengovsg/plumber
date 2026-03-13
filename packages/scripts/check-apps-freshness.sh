#!/bin/bash

# Check if apps.json might be outdated by comparing modification times

APPS_JSON="packages/frontend/src/assets/apps.json"
APPS_DIR="packages/backend/src/apps"

if [ ! -f "$APPS_JSON" ]; then
  echo "⚠️  Warning: $APPS_JSON does not exist. Run 'npm run generate:apps' to generate it."
  exit 0
fi

# Find any app files modified after apps.json
OUTDATED=$(find "$APPS_DIR" -type f -name "*.ts" -newer "$APPS_JSON" | head -5)

if [ -n "$OUTDATED" ]; then
  echo "⚠️  Warning: apps.json may be outdated. The following app files were modified after it:"
  echo "$OUTDATED"
  echo ""
  echo "Run 'npm run generate:apps' to regenerate."
fi
