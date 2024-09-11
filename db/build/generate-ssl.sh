#!/bin/sh -ex

DAYS=$(( 365 * 1 ))

COUNTRY_NAME="FR"
STATE="Lille"
LOCALITY_NAME="Lille"
ORG="RestAPI"
COMMON_NAME="localhost"
EMAIL="malo.durand@epitech.eu"

CONFIG="[req]
distinguished_name=req_distinguished_name
req_extensions=v3_req
days=${DAYS}
prompt=no

[req_distinguished_name]
C=${COUNTRY_NAME}
ST=${STATE}
L=${LOCALITY_NAME}
O=${ORG}
CN=${COMMON_NAME}
emailAddress=${EMAIL}

[v3_req]
keyUsage=nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
DNS.1=localhost
"

PUBLIC_KEY_PATH="${1}"
PRIVATE_KEY_PATH="${2}"

function generate_keys {
    local cert_req_path="/var/lib/postgresql/certificate_request.csr"

    echo "Generating public_key at ${PUBLIC_KEY_PATH} and private_key at ${PRIVATE_KEY_PATH}."

    openssl genrsa -out "${PRIVATE_KEY_PATH}" 4096
    openssl req -new -key "${PRIVATE_KEY_PATH}" -out "${cert_req_path}" -config <( echo "${CONFIG}")
    openssl x509 -signkey "${PRIVATE_KEY_PATH}" -in "${cert_req_path}" -req -out "${PUBLIC_KEY_PATH}"
    rm -f "${cert_req_path}"
}

generate_keys
