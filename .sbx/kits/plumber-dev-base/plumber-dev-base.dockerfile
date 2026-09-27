# syntax=docker/dockerfile:1
FROM docker/sandbox-templates:shell
ARG PLUMBER_NODE_VERSION=22.19.0

USER root
RUN apt-get update -y &&                        \
    apt-get install -y --no-install-recommends  \
      ncurses-term                              \
      locales                                   \
      tmux &&                                   \
    locale-gen en_SG.UTF-8

COPY files/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY files/tmux.conf /etc/tmux.conf

USER agent
ENV LANG=en_SG.UTF-8                            \
    LC_ALL=en_SG.UTF-8                          \
    IS_DOCKER_SANDBOX=1                         \
    POSTGRES_HOST=host.docker.internal          \
    TILES_POSTGRES_HOST=host.docker.internal    \
    REDIS_HOST=host.docker.internal             \
    NVM_DIR=/home/agent/.nvm
ENV NPM_CONFIG_PREFIX=

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
RUN bash -c "source $NVM_DIR/nvm.sh && nvm install $PLUMBER_NODE_VERSION && nvm use $PLUMBER_NODE_VERSION && npm install -g npm@11.19.0"

ENTRYPOINT ["/entrypoint.sh"]
