# Rest API

This repository aims to provide a solid basis to create a new rest API project.
It includes Prisma schema for users, an SSL postgres docker image builder, the
implementation of CRUD routes for users, and secured JWT guard using RSA
encryption.

# Configuration

Run the `generate.bash` script to generate secrets for the project. It will
produce :
- `.public_key.pem` : PEM file contaning the RSA public key used to encrypt JWS,
- `.private_key.pem` : PEM file contaning the RSA private key used to decrypt
JWE,
- `.secrets` : text file containing the JWT secret used to sign JWT, and a
password for the PostgreSQL dataabase.

### `.env`

```properties
# .env
POSTGRESQL_URL="postgresql://USERNAME:[.secrets.URLENCODED_PASSWORD]@HOSTNAME:5432/DBNAME"
JWT_RSA_PUBLIC_KEY_PATH=".public_key.pem"
JWT_RSA_PRIVATE_KEY_PATH=".private_key.pem"
JWT_SECRET=".secrets.JWT_SECRET"
JWT_ISSUER="project-name"
JWT_EXPIRES_IN=60 # In seconds
```

### `db/.env`

```properties
# .env
POSTGRES_HOST="localhost"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD=".secrets.PASSWORD"
POSTGRES_DB="rest-api"
```
