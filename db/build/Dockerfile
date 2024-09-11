FROM postgres:alpine3.20

LABEL MAINTAINER="DURAND Malo <malo.durand@epitech.eu>"

EXPOSE 5432

ARG PUBLIC_KEY_PATH="/var/lib/postgresql/public_key.crt"
ENV PUBLIC_KEY_PATH="${PUBLIC_KEY_PATH}"

ARG PRIVATE_KEY_PATH="/var/lib/postgresql/private_key.key"
ENV PRIVATE_KEY_PATH="${PRIVATE_KEY_PATH}"

ARG GENERATE_SSL_SCRIPT_PATH="/var/lib/postgresql/generate-ssl.sh"

COPY ./generate-ssl.sh "${GENERATE_SSL_SCRIPT_PATH}"

# Setting permissions to r-x------ to make sure nobody can overwrite the script

RUN chown postgres:postgres "${GENERATE_SSL_SCRIPT_PATH}" && chmod 500 "${GENERATE_SSL_SCRIPT_PATH}"

# Generate the keys to the specified paths

RUN apk update                 \
    && apk upgrade             \
    && apk add openssl         \
    && rm -rf /var/cache/apk/*

RUN /bin/sh "${GENERATE_SSL_SCRIPT_PATH}" "${PUBLIC_KEY_PATH}" "${PRIVATE_KEY_PATH}"

# Making sure only postgres:postgres can read-only the keys

RUN chown postgres:postgres "${PRIVATE_KEY_PATH}" && chmod 400 "${PRIVATE_KEY_PATH}"

RUN chown postgres:postgres "${PUBLIC_KEY_PATH}" && chmod 400 "${PUBLIC_KEY_PATH}"

# Overwrite all the default config to make every connection ssl-based
RUN echo "hostssl all all all cert clientcert=verify-ca" > /var/lib/postgresql/data/pg_hba.conf

ENTRYPOINT docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=$(echo "${PUBLIC_KEY_PATH}") -c ssl_ca_file=$(echo "${PUBLIC_KEY_PATH}") -c ssl_key_file=$(echo "${PRIVATE_KEY_PATH}")
