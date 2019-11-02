CREATE TABLE `libraries` (
  `library_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) DEFAULT NULL,
  `description` LONGTEXT,
  `url` VARCHAR(80) NOT NULL,
  `next_folder_id` INT DEFAULT NULL,
  `next_file_id` INT DEFAULT NULL,
  `next_keyword_id` INT DEFAULT NULL,
  PRIMARY KEY (`library_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE `folders` (
  `library_id` INT NOT NULL DEFAULT '0',
  `folder_id` INT NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `parent_id` INT NOT NULL,
  `type` INT NOT NULL DEFAULT '11',
  `root_id` INT NOT NULL DEFAULT '0',
  `path` VARCHAR(255) NOT NULL,
  `file_count` INT NOT NULL DEFAULT '0',
  `file_size` INT NOT NULL DEFAULT '0',
  `file_size_sm` INT NOT NULL DEFAULT '0',
  `file_size_md` INT NOT NULL DEFAULT '0',
  `file_size_lg` INT NOT NULL DEFAULT '0',
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
  `library_id` INT NOT NULL,
  `folder_id` INT NOT NULL,
  `file_id` INT NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `mime_type` VARCHAR(45) DEFAULT NULL,
  `is_video` BIT(1) NOT NULL DEFAULT b'0',
  `height` INT NOT NULL,
  `width` INT NOT NULL DEFAULT '0',
  `imported_on` DATETIME DEFAULT NULL,
  `taken_on` DATETIME DEFAULT NULL,
  `modified_on` DATETIME DEFAULT NULL,
  `rating` TINYINT DEFAULT NULL,
  `title` VARCHAR(80) DEFAULT NULL,
  `subject` VARCHAR(80) DEFAULT NULL,
  `comments` LONGTEXT,
  `file_size` INT DEFAULT NULL,
  `file_size_sm` INT DEFAULT NULL,
  `file_size_md` INT DEFAULT NULL,
  `file_size_lg` INT DEFAULT NULL,
  `file_size_backup` INT DEFAULT NULL,
  `is_processing` BIT(1) DEFAULT b'0',
  PRIMARY KEY (`library_id`,`folder_id`,`file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `tags` (
  `library_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  `tag` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`library_id`,`tag_id`),
  UNIQUE KEY `ix_tags_library_id_tag` (`library_id`,`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `file_tags` (
  `library_id` INT NOT NULL,
  `folder_id` INT NOT NULL,
  `file_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`library_id`,`folder_id`,`file_id`,`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
