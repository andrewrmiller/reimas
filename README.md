# What is Reimas?

Reimas (pronounced "rayMAHS") is a **RE**mote **IM**Age **S**torage service. It provides the following features:

- Simple API for storing, retrieving and maniupulating photos and videos
- Ability to store uploaded files in the file system or AWS S3
- Metadata extraction and storage for uploaded files
- Tag system to facilitate photo and video retrieval
- Advanced searching capabilities
- Thumbnail generation
- Video conversion
- File versioning
- Statistics and quotas

Image file information and tags are stored in a database for efficient searches. The Reimas API provides the expected abstraction over the database and the chosen mechanism for file storage (file system or AWS S3).

####API Notes
#####Null Values
Null values stored in the database will not be returned in the JSON objects created by the API.
#####Date Handling
The Reimas API reads and writes UTC dates only. Similarly, dates are stroed in the Reimas database in UTC format.
