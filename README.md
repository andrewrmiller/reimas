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

#### Services

Picstrata is made up of the following services:

| Service   | Description                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- |
| API       | API service which provides a REST endpoint for working with libraries, folders and files.           |
| Workers   | Worker service which executes asynchronous jobs like image resizing and video conversion.           |
| Rabbit-MQ | A message queue to which the API service dispaches messages for consumption by the Workers service. |

#### Building, Running and Testing Picstrata

##### Database Setup

The API and Workers services are configured by default to expect a MySQL instance
running on your local machine. This can be overridden using environment variables
if necessary.

To initialize and configure the Picstrata database on your MySQL host, use the
`picstratadb` script in the `/scripts` directory.

##### Environment Setup

The following environment variables should be set to enable the execution and
testing of the Picstrata microservice:

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| PST_DATABASE_USER     | User account to use when accessing the database. |
| PST_DATABASE_PASSWORD | Password to use with PST_DATABASE_USER.          |
| PST_API_KEY_1         | API key to use when accessing the REST API.      |

Other configuration options can be found in `custom-environment-variables.yaml`.

During development, Picstrata libraries are stored on your local machine under
`/var/lib/picstrata`. This directory should be initialized before building and
running Picstrata using the following commands:

```
sudo mkdir -p /var/lib/picstrata/libraries
sudo chown -R nodeuser /var/lib/picstrata/libraries
```

where `nodeuser` is the name of the user account under which Node.js will be run.

##### Building

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

##### Testing

The `apitest` directory contains tests which can be run to validate Picstrata
service functionality. Executing `npm run test` from this directory will run
those tests against the API container. To run the same tests against an API
service running locally, use `npm run testdev`.

#### API Notes

##### Null Values

Null values stored in the database will not be returned in the JSON objects created by the API.

##### Date Handling

The Picstrata API reads and writes UTC dates only. Similarly, dates are stroed in the Picstrata database in UTC format.
