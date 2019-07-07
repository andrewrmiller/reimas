# What is Reimas?
Reimas (pronounced "rayMAHS") is a REmote IMage Storage storage.  It provides the following features:

* Simple API for storing, retrieving and maniupulating photos and videos.
* Ability to store uploaded files in the file system or AWS S3.
* Tag system to facilitate photo or retrieval.
* Metadata extraction and storage for uploaded files.
* Advanced searching capabilities.
* Thumbnail generation.
* Video conversion.
* File versioning.
* Statistics and quotas.

Image file information and tags are stored in a database for efficient searches.  The Reimas API provides the expected abstraction over the database and the chosen mechanism for file storage (file system or AWS S3).
