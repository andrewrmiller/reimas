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

Follow the steps below to build, run and test Picstrata.

### Install Docker

Picstrata is distributed as a collection of container images. To build and test these images, Docker must exist on the development machine.

You can install Docker from https://www.docker.com.

### Pull MySQL and Flyway Images

Once Docker is installed and running properly, use the following commands to install the MySQL and Flyway images:

```
docker pull mysql:latest
docker pull flyway/flyway:latest
```

Alternatively, you can use the Docker Desktop UI to achieve the same.

### Start a MySQL Container

Run this command to start the MySQL container and expose in on the host via port 3306:

```
docker run -d -e MYSQL_ROOT_PASSWORD=S0m3R00tP4ssword -p 3306:3306 --name mysql mysql
```

Remember to change the `MYSQL_ROOT_PASSWORD` value to your own secret value.

### Connect to the Container

At this point the container should be exposed on port 3306 on the local host.

Fire up your DB editing tool of choice (e.g. DBeaver) and create a connection. Specify `localhost` as the host and connect as `root` with the password you provided.

NOTE: You may need to set `allowPublicRetrieval` under Driver Settings to the value `TRUE`

### Environment Setup

Picstrata uses a number of environment variables to build and run the containers on the target system. These variables must be customized for your development enviroment.

Begin by creating a `.env` file from the provided `.env.template`:

```
cp .env.template .env
```

Next edit your `.env` file and customize the variables that you see there. Comments in the file should make it pretty clear how to do this. Note that all variables that have values beginning with "your\_" should be changed.

### Install MySQL Client

The `pstdb` script uses the MySQL client to configure users and the database. You'll need to have this client installed locally.

On Linux:

```
sudo apt-get install mysql-client
```

On Mac:

```
brew install mysql-client
```

After the brew install you'll want to add the client to your path. You should be able to find it at `/opt/homebrew`.

### Create Database Users

Picstrata uses the following MySQL users:

| User     | Description                                       | Permissions                  |
| -------- | ------------------------------------------------- | ---------------------------- |
| pstadmin | Used by `pstdb` to create and update the database | All schema privileges        |
| pstuser  | Used by Picstrata to access the database          | Set automatically by `pstdb` |
|          |                                                   |                              |

These users only need to be created once. Once MySQL is running and the environment is set up properly, user can be created with the following command:

```
./pstdb addUsers
```

Note that permissions for `pstuser` will be granted when the database is provisioned.

### Library Setup

During development, Picstrata libraries are stored on your local machine under
`/var/lib/picstrata`. This directory should be initialized before building and
running Picstrata using the following commands:

```
sudo mkdir -p /var/lib/picstrata/libraries/exports
sudo chown -R nodeuser /var/lib/picstrata/libraries
```

where `nodeuser` is the name of the user account under which Node.js will be run.

This is generally your user account.

### Database Initialization

To initialize and configure the Picstrata database on your MySQL host, use the
`pstdb` script in the `/scripts` directory:

```
pstdb create
```

Run `pstdb` with no arguments to get a list of other database functions.

### Installing Docker Compose

Docker Compose is used to run the Picstrata containers.

If you installed Docker Desktop then you already have Docker Compose.

If not, Docker Compose should be installed using the steps found here: https://docs.docker.com/compose/install/.

### Installing NodeJS

The Picstrata service containers (API and Worker) are built using NodeJS. The
version of NodeJS required by these services can be found in the `.nvmrc` file at
the root of the project.

To install NodeJS and manage versions we recommend using Node Version Manager (`nvm`).  
You can find more info on `nvm` here: [Node Version Manager](https://github.com/nvm-sh/nvm).

Once you have `nvm` installed and working properly, you can check to see if you have the the correct version of NodeJS with the following command:

```
nvm use
```

If you don't have the NodeJS version that matches Picstrata's `.nvmrc` file, just run:

```
nvm install
```

### Installing Yarn

The Picstrata packages are set up as a yarn workspace. To propertly work with
this workspace you will need to install yarn. Instructions for doing so can
be found here: [Yarn Installation](https://yarnpkg.com/getting-started/install).

### Building

To build the Picstrata service containers, use the `pst` script under `/scripts`.

- `pst build` will build all of the Picstrata containers (API, Worker and DB Migration).
- `pst start` will run the API and Workers containers on the local host.
- `pst stop` will stop the running containers.

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

The Picstrata API reads and writes UTC dates only. Similarly, dates are stored in the Picstrata database in UTC format.
