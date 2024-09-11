#!/bin/bash

# This script requires Python 3 and openssl in order to work. It contains all
# the function to generate the secret used to sign JWTs into JWSs, the RSA key
# pair used to encrypt and decrypt JWSs into JWEs and vice versa, and the
# PostgreSQL password both raw and urlencoded.

function generate_jwt_secret {
    local secret_length="${1}"
    local default_length=32

    python3 -c "import random,string;print(''.join([random.choice(string.hexdigits[:16]) for _ in range(${secret_length:=${default_length}})]))"
}

function generate_postgres_password {
    local password_length="${1}"
    local default_length=32

    python3 -c "import secrets;print(''.join([chr(32 + secrets.randbelow(127 - 32)) for _ in range(${password_length:=${default_length}})]))"
}

function urlencode_postgres_password {
    local password="${1}"

    python3 -c "import urllib.parse;print(urllib.parse.quote('''${password}'''))"
}

function generate_rsa_key_pair {
    local rsa_public_key_path="${1}"
    local rsa_private_key_path="${2}"

    local modulus_length="${3}"
    local default_modulus_length=4096

    openssl genrsa -out "${rsa_private_key_path}" "${modulus_length:=${default_modulus_length}}"
    openssl rsa -in "${rsa_private_key_path}" -outform PEM -pubout -out "${rsa_public_key_path}" > /dev/null
}

function main {
    local secrets_file=".secrets"

    local jwt_secret=$(generate_jwt_secret)

    local postgres_password=$(generate_postgres_password)
    local urlencoded_postgres_password=$(urlencode_postgres_password "${postgres_password}")

    local rsa_public_key_path=".public_key.pem"
    local rsa_private_key_path=".private_key.pem"
    generate_rsa_key_pair "${rsa_public_key_path}" "${rsa_private_key_path}"

    echo "" > "${secrets_file}"
    echo "JWT_SECRETS=${jwt_secret}" >> "${secrets_file}"
    echo "POSTGRES_PASSWORD=${postgres_password}" >> "${secrets_file}"
    echo "URLENCODED_POSTGRES_PASSWORD=${urlencoded_postgres_password}" >> "${secrets_file}"
    echo "JWT_RSA_PUBLIC_KEY_PATH=${rsa_public_key_path}" >> "${secrets_file}"
    echo "JWT_RSA_PRIVATE_KEY_PATH=${rsa_private_key_path}" >> "${secrets_file}"
}

main
