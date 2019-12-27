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

#### Building, Running and Testing Picstrata

##### Environment Setup

The services in the Picstrata repo are configured to expect MySQL instance
running on your local host by default. This can be overridden using environment
variables if necessary. At a minimum the `PST_DATABASE_USER` and `PST_DATABASE_PASSWORD`
environment variables will need to be set so that the Picstrata services are
able to connect to the database. Other configuration options can be found in
`custom-environment-variables.yaml`.

##### Building

To build the Picstrata service containers, use the `picstrata` script under `/scripts`.

`picstrata build` will build both of the Picstrata containers (API and Workers).
`picstrata start` will run the containers on the local host.
`picstrata stop` will stop the running containers.

It is also possible to run each service outside of a container for easier
testing and development. For example, if you want to run the API service
outside of a container, follow these commands:

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
