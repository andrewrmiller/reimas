# What is Picstrata?

Picstrata is a containerized microservice designed to make it easier to store and manage photos and videos.   Picstrata provides the following capabilities:

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

####API Notes
#####Null Values
Null values stored in the database will not be returned in the JSON objects created by the API.
#####Date Handling
The Picstrata API reads and writes UTC dates only. Similarly, dates are stroed in the Picstrata database in UTC format.
