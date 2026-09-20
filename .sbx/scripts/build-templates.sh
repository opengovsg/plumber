#!/usr/bin/env bash

sbx template rm plumber-dev:claude
docker build -t plumber-dev:claude -f .sbx/templates/Dockerfile.claude .sbx/templates
docker image save plumber-dev:claude -o plumber-dev-claude.template.tar
sbx template load plumber-dev-claude.template.tar
rm plumber-dev-claude.template.tar
