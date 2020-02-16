FROM flyway/flyway:6.2

WORKDIR /usr/src/db
COPY migrate/ migrate/
COPY flyway.conf /flyway/conf
