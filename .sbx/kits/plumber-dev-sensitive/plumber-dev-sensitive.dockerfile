# syntax=docker/dockerfile:1
FROM docker/sandbox-templates:shell AS build

# No-op for now

FROM build
# These are placeholders which should match with the custom secret placehodlers
# in our sbx env.
ENV PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY=PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY-placeholder   \
    PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY=PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY-placeholder   \
    PAIR_ROME_AI_BUILDER_PUBLIC_KEY=pk-PAIR_ROME_AI_BUILDER_PUBLIC_KEY-placeholder                      \
    PAIR_ROME_AI_BUILDER_SECRET_KEY=sk-PAIR_ROME_AI_BUILDER_SECRET_KEY-placeholder                      \
    PAIR_ROME_PAIR_ACTION_PUBLIC_KEY=pk-PAIR_ROME_PAIR_ACTION_PUBLIC_KEY-placeholder                    \
    PAIR_ROME_PAIR_ACTION_SECRET_KEY=sk-PAIR_ROME_PAIR_ACTION_SECRET_KEY-placeholder
