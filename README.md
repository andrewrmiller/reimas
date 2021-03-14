# What is Picstrata?

Picstrata is a containerized microservice designed to make it easier to store and manage photos and videos. Picstrata provides the following capabilities:

- Simple API for storing, retrieving and manipulating photos and videos
- Ability to store uploaded files in the file system or AWS S3
- Metadata extraction and storage for uploaded files
- Tag system to facilitate photo and video retrieval
- Advanced searching capabilities
- Thumbnail generation
- Video conversion
- File versioning
- Statistics and quotas
- User authorization for libraries and folders

Image file information and tags are stored in a database for efficient searches. The Picstrata API provides the expected abstraction over the database and the chosen mechanism for file storage (file system or AWS S3).

## Services

Picstrata is made up of the following services:

| Service   | Description                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- |
| API       | API service which provides a REST endpoint for working with libraries, folders and files.           |
| Workers   | Worker service which executes asynchronous jobs like image resizing and video conversion.           |
| Rabbit-MQ | A message queue to which the API service dispaches messages for consumption by the Workers service. |
|           |                                                                                                     |

## Building, Running and Testing Picstrata

### MySQL Setup

The API and Workers services are configured by default to expect a MySQL instance
running on your local machine. This can be overridden using environment variables
if necessary.

To install and configure MySQL locally run these commands:

```
sudo apt install mysql-server
sudo mysql_secure_installation
```

These MySQL users should be created:

| User     | Description                                       | Permissions                                |
| -------- | ------------------------------------------------- | -------------------------------------------|
| pstadmin | Used by `pstdb` to create and update the database | All schema privileges                      |
| pstuser  | Used by Picstrata to access the database          | Set automatically by `pstdb`               |
|          |                                                   |                                            |

Use `sudo mysql` to connect to the local instance and then use these SQL
statements to create the users:

```
CREATE USER 'pstadmin'@'%' IDENTIFIED BY 'INSERT_ADMIN_PASSWORD_HERE';
GRANT ALL ON *.* to 'pstadmin'@'%';
GRANT GRANT OPTION ON *.* TO 'pstadmin'@'%';
CREATE USER 'pstuser'@'%' IDENTIFIED WITH mysql_native_password BY 'INSERT_USER_PASSWORD_HERE';
FLUSH PRIVELEGES;
```

Note that permissions for pstuser will be granted when the database is provisioned.

Once you have created these users you will need to set a login-path for both users
so `pst` and `pstdb` are able to securely connect to MySQL:

```
mysql_config_editor set --login-path=pstadmin --host=localhost --user=pstadmin --password
mysql_config_editor set --login-path=pstuser --host=localhost --user=pstuser --password
```

Finally, you need to make sure that MySQL allows connecting from any IP address on the
host.  The docker containers connect using the first address in `hostname -I`.

Edit `/etc/mysql/mysql.conf.d/mysqld.cnf` and comment out the `bind-address` line.  This
will allow connections from host IP addresses other than localhost.  Once you have made
this change run `sudo systemctl restart mysql` to restart mysql.

### Environment Setup

The following environment variables should be set to enable the execution and
testing of the Picstrata microservice:

| Variable                | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| PST_DATABASE_HOST       | MySQL database host (e.g. `localhost`).                           |
| PST_DATABASE_USER       | User account to use when accessing the database (e.g. `pstuser`). |
| PST_QUEUE_TYPE          | `beanstalkd` or `rabbitmq`                                        |
| PST_TIMEZONE_DB_API_KEY | Your API key from timezonedb.com.                                 |
| PST_API_KEY_1           | API key to use when accessing the REST API.                       |
|                         |                                                                   |

Note that timezonedb.com is used to properly extract the date and time photos were taken.

For local development PST_API_KEY_1 can be set to any suitably random value.

Other configuration options can be found in `custom-environment-variables.yaml`.

During development, Picstrata libraries are stored on your local machine under
`/var/lib/picstrata`. This directory should be initialized before building and
running Picstrata using the following commands:

```
sudo mkdir -p /var/lib/picstrata/libraries
sudo chown -R nodeuser /var/lib/picstrata/libraries
```

where `nodeuser` is the name of the user account under which Node.js will be run.

### Database Initialization
Before you can create and initialize the Picstrata database you must have Flyway
installed.  You can find it here: https://flywaydb.org/documentation/commandline.

To initialize and configure the Picstrata database on your MySQL host, use the
`pstdb` script in the `/scripts` directory.  e.g.:

```
pstdb create
```

### Installing Docker Compose
Docker Compose is used to run the Picstrata containers.  It should be installed
using the steps found here: https://docs.docker.com/compose/install/.


### Building

To build the Picstrata service containers, use the `picstrata` script under `/scripts`.

- `picstrata build` will build both of the Picstrata containers (API and Workers).
- `picstrata start` will run all Picstrata containers on the local host.
- `picstrata stop` will stop the running containers.

It is also possible to run each service outside of a container for easier
testing and development. For example, if you want to run the API service
locally (i.e. not in a container), use these commands:

```
cd pkg/api
npm run api
```

There is no need to stop the containers in order to run services locally.
By default the API service is exposed on port 3100 when run inside the
container, and on port 3000 when run locally.

### Testing

The `apitest` directory contains tests which can be run to validate Picstrata
service functionality. Executing `npm run test` from this directory will run
those tests against the API container. To run the same tests against an API
service running locally, use `npm run testdev`.

## API Notes

### API Keys

All Picstrata REST API calls must include an Authorization header containing an API
key which identifies the calling application. The REST API server will compare this
API key against the set of configured API keys to determine if the key is valid. If
the key is determined to be not valid, the request will fail with a status code of 401.

The Authorization header should take the following form:

```
Authorization: ApiKey abcde12345
```

Where `abcde12345` is the API key. API keys are configured on the REST API server using
these environment variables:

| Variable      | Description               |
| ------------- | ------------------------- |
| PST_API_KEY_1 | Valid API key number one. |
| PST_API_KEY_2 | Valid API key number two. |

As long as the API provided in the Authorization header matches one of the two API keys
listed above, it will be considered valid and request processing will continue. Although
only one API key needs to be configured for the API server to work properly, two keys may
be configured to facilitate API key rotation.

### User IDs

To enable proper library and folder authorization, all REST API calls should include
an API-User-ID header which contains a unique identifier for the user who initiated
the request. Picstrata persists these user IDs to the database when libraries and
folders are created, and these user IDs are checked for subsequent operations such
as deleting a folder or uploading a file.

A Picstrata User IDs is nothing more than a string that identifies the user in the
context of your application. Common user IDs are user names (johnsmith), email
addresses (johnsmith@somecompany.com), and generated UUIDs converted to a string.
The user ID must be the same for a given user across all her devices and browsers.

### Null Values

Null values stored in the database will not be returned in the JSON objects created by the API.

### Date Handling

The Picstrata API reads and writes UTC dates only. Similarly, dates are stroed in the Picstrata database in UTC format.
