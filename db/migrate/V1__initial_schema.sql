CREATE TABLE `libraries` (
  `library_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(80) DEFAULT NULL,
  `description` longtext,
  `url` varchar(80) NOT NULL,
  `next_folder_id` int(11) DEFAULT NULL,
  `next_file_id` int(11) DEFAULT NULL,
  `next_keyword_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`library_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE `folders` (
  `library_id` int(11) NOT NULL DEFAULT '0',
  `folder_id` int(11) NOT NULL,
  `name` varchar(80) NOT NULL,
  `parent_id` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '11',
  `root_id` int(11) NOT NULL DEFAULT '0',
  `path` varchar(255) NOT NULL,
  `file_count` int(11) NOT NULL DEFAULT '0',
  `file_size` int(11) NOT NULL DEFAULT '0',
  `file_size_sm` int(11) NOT NULL DEFAULT '0',
  `file_size_md` int(11) NOT NULL DEFAULT '0',
  `file_size_lg` int(11) NOT NULL DEFAULT '0',
  `data` text,
  `where` text,
  `order_by` text,
  PRIMARY KEY (`library_id`,`folder_id`),
  KEY `ix_folders_parent_id` (`parent_id`),
  KEY `ix_folders_path` (`path`),
  KEY `ix_folders_root_id` (`root_id`),
  KEY `ix_folders_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `files` (
  `library_id` int(11) NOT NULL,
  `folder_id` int(11) NOT NULL,
  `file_id` int(11) NOT NULL,
  `name` varchar(80) NOT NULL,
  `mime_type` varchar(45) DEFAULT NULL,
  `is_video` bit(1) NOT NULL DEFAULT b'0',
  `height` int(11) NOT NULL,
  `width` int(11) NOT NULL DEFAULT '0',
  `imported_on` datetime DEFAULT NULL,
  `taken_on` datetime DEFAULT NULL,
  `modified_on` datetime DEFAULT NULL,
  `rating` tinyint(4) DEFAULT NULL,
  `title` varchar(80) DEFAULT NULL,
  `subject` varchar(80) DEFAULT NULL,
  `comments` longtext,
  `file_size` int(11) DEFAULT NULL,
  `file_size_sm` int(11) DEFAULT NULL,
  `file_size_md` int(11) DEFAULT NULL,
  `file_size_lg` int(11) DEFAULT NULL,
  `file_size_backup` int(11) DEFAULT NULL,
  `is_processing` bit(1) DEFAULT b'0',
  PRIMARY KEY (`library_id`,`folder_id`,`file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `tags` (
  `library_id` int(11) NOT NULL,
  `tag_id` int(11) NOT NULL,
  `tag` varchar(80) NOT NULL,
  PRIMARY KEY (`library_id`,`tag_id`),
  UNIQUE KEY `ix_tags_library_id_tag` (`library_id`,`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `file_tags` (
  `library_id` int(11) NOT NULL,
  `folder_id` int(11) NOT NULL,
  `file_id` int(11) NOT NULL,
  `tag_id` int(11) NOT NULL,
  PRIMARY KEY (`library_id`,`folder_id`,`file_id`,`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
