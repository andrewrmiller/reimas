FROM flyway/flyway:7.8.1

WORKDIR /usr/src/db
COPY migrate/ migrate/picstrata
COPY flyway.conf /flyway/conf
