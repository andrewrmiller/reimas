-- MySQL dump 10.13  Distrib 8.0.19, for Linux (x86_64)
-- ------------------------------------------------------
-- Server version	8.0.19

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `pst_file_tags`
--

DROP TABLE IF EXISTS `pst_file_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pst_file_tags` (
  `library_id` binary(16) NOT NULL,
  `file_id` binary(16) NOT NULL,
  `tag` varchar(80) NOT NULL,
  PRIMARY KEY (`library_id`,`file_id`,`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pst_files`
--

DROP TABLE IF EXISTS `pst_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pst_files` (
  `library_id` binary(16) NOT NULL,
  `folder_id` binary(16) NOT NULL,
  `file_id` binary(16) NOT NULL,
  `name` varchar(80) NOT NULL,
  `mime_type` varchar(45) NOT NULL,
  `is_video` bit(1) NOT NULL DEFAULT b'0',
  `height` int NOT NULL,
  `width` int NOT NULL DEFAULT '0',
  `imported_on` datetime NOT NULL,
  `taken_on` datetime DEFAULT NULL,
  `modified_on` datetime DEFAULT NULL,
  `rating` tinyint DEFAULT NULL,
  `title` varchar(80) DEFAULT NULL,
  `comments` longtext,
  `file_size` int NOT NULL,
  `file_size_sm` int DEFAULT NULL,
  `file_size_md` int DEFAULT NULL,
  `file_size_lg` int DEFAULT NULL,
  `file_size_cnv_video` int DEFAULT NULL,
  `file_size_backup` int DEFAULT NULL,
  `is_processing` bit(1) NOT NULL,
  `latitude` decimal(15,10) DEFAULT NULL,
  `longitude` decimal(15,10) DEFAULT NULL,
  `altitude` decimal(15,10) DEFAULT NULL,
  PRIMARY KEY (`library_id`,`folder_id`,`file_id`),
  UNIQUE KEY `ux_files_folder_id_name` (`library_id`,`folder_id`,`name`),
  KEY `ix_files_library_id_file_id` (`library_id`,`file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pst_folder_user_roles`
--

DROP TABLE IF EXISTS `pst_folder_user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pst_folder_user_roles` (
  `library_id` binary(16) NOT NULL DEFAULT '0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0',
  `folder_id` binary(16) NOT NULL,
  `user_id` varchar(254) NOT NULL,
  `role` varchar(20) NOT NULL,
  PRIMARY KEY (`library_id`,`folder_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pst_folders`
--

DROP TABLE IF EXISTS `pst_folders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pst_folders` (
  `library_id` binary(16) NOT NULL,
  `folder_id` binary(16) NOT NULL,
  `name` varchar(80) NOT NULL,
  `parent_id` binary(16) DEFAULT NULL,
  `type` varchar(20) DEFAULT NULL,
  `path` varchar(255) NOT NULL,
  `file_count` int NOT NULL DEFAULT '0',
  `file_size` int NOT NULL DEFAULT '0',
  `file_size_sm` int NOT NULL DEFAULT '0',
  `file_size_md` int NOT NULL DEFAULT '0',
  `file_size_lg` int NOT NULL DEFAULT '0',
  `file_size_cnv_video` int DEFAULT NULL,
  `data` text,
  `where` text,
  `order_by` text,
  PRIMARY KEY (`library_id`,`folder_id`),
  UNIQUE KEY `ux_folders_parent_id_name` (`library_id`,`parent_id`,`name`),
  KEY `ix_folders_parent_id` (`library_id`,`parent_id`),
  KEY `ix_folders_path` (`library_id`,`path`),
  KEY `ix_folders_name` (`library_id`,`name`),
  CONSTRAINT `fk_folders_library_id` FOREIGN KEY (`library_id`) REFERENCES `pst_libraries` (`library_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pst_libraries`
--

DROP TABLE IF EXISTS `pst_libraries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pst_libraries` (
  `library_id` binary(16) NOT NULL,
  `name` varchar(80) DEFAULT NULL,
  `description` longtext,
  `time_zone` varchar(80) NOT NULL,
  PRIMARY KEY (`library_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Temporary view structure for view `pst_vw_file_tags`
--

DROP TABLE IF EXISTS `pst_vw_file_tags`;
/*!50001 DROP VIEW IF EXISTS `pst_vw_file_tags`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `pst_vw_file_tags` AS SELECT 
 1 AS `library_id`,
 1 AS `file_id`,
 1 AS `tags`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `pst_library_user_roles`
--

DROP TABLE IF EXISTS `pst_library_user_roles`;
/*!50001 DROP VIEW IF EXISTS `pst_library_user_roles`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `pst_library_user_roles` AS SELECT 
 1 AS `library_id`,
 1 AS `name`,
 1 AS `description`,
 1 AS `user_id`,
 1 AS `user_role`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping routines for database 'picstrata'
--
/*!50003 DROP FUNCTION IF EXISTS `pst_compress_guid` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE FUNCTION `pst_compress_guid`(p_guid VARCHAR(36)) RETURNS binary(16)
    DETERMINISTIC
BEGIN

RETURN UNHEX(REPLACE(p_guid,'-',''));

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP FUNCTION IF EXISTS `pst_expand_guid` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE FUNCTION `pst_expand_guid`(p_guid BINARY(16)) RETURNS varchar(36) CHARSET latin1
    DETERMINISTIC
BEGIN

RETURN LOWER(
    INSERT(
        INSERT(
          INSERT(
            INSERT(hex(p_guid),9,0,'-'),
            14,0,'-'),
          19,0,'-'),
        24,0,'-'));
    
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP FUNCTION IF EXISTS `pst_get_role_rank` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE FUNCTION `pst_get_role_rank`(p_role VARCHAR(20)) RETURNS int
    DETERMINISTIC
BEGIN
  -- Owners are most privileged.
  IF (p_role = 'owner') THEN
    RETURN 1;
  END IF;

  -- ...then contributors.
  IF (p_role = 'contributor') THEN
    RETURN 2;
  END IF;

  -- ...and finally readers.
  IF (p_role = 'reader') THEN
    RETURN 3;
  END IF;

  -- Any other role is stuffed in bucket 99.
  RETURN 99;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP FUNCTION IF EXISTS `pst_get_user_role` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE FUNCTION `pst_get_user_role`(
                    p_user_id VARCHAR(254), 
                    p_library_id BINARY(16), 
                    p_folder_id BINARY(16)) RETURNS varchar(20) CHARSET utf8mb4
    DETERMINISTIC
BEGIN

  -- If p_folder_id IS NULL the caller wants to get permssions for the
  -- root folder in the library.  We look the folder ID up in this case.
  IF p_folder_id IS NULL THEN
    SELECT folder_id INTO @folder_id FROM pst_folders
    WHERE library_id = p_library_id AND parent_id IS NULL;
  ELSE
    SET @folder_id = p_folder_id;
  END IF;

  -- Walk the folder tree from the specified folder all the way to the
  -- root looking for the most privileged role assigned to the user.
  -- A higher-ranked role on a parent folder overrides a lower-ranked
  -- role on a subfolder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, role, role_rank) AS
  (
    SELECT 
      f.library_id, 
      f.folder_id, 
      f.parent_id, 
      ur.role,
      pst_get_role_rank(ur.role) AS role_rank
    FROM 
      pst_folders f LEFT JOIN pst_folder_user_roles ur
      ON f.library_id = ur.library_id AND
        f.folder_id = ur.folder_id AND
        ur.user_id = p_user_id
    WHERE 
      f.library_id = p_library_id AND 
      f.folder_id = @folder_id
      
    UNION ALL
      
    SELECT 
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par_ur.role,
      pst_get_role_rank(par_ur.role) AS role_rank
    FROM 
      (folder_tree AS ft JOIN pst_folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id)
      LEFT JOIN pst_folder_user_roles par_ur
      ON par.library_id = par_ur.library_id
      AND par.folder_id = par_ur.folder_id
      AND par_ur.user_id = p_user_id
  )
  SELECT 
    role INTO @user_role
  FROM 
    folder_tree 
  ORDER BY 
    role_rank
  LIMIT 1;

  RETURN @user_role;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP FUNCTION IF EXISTS `pst_is_valid_role` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE FUNCTION `pst_is_valid_role`(p_role VARCHAR(20)) RETURNS BOOL
    DETERMINISTIC
BEGIN
  RETURN 
    p_role IS NOT NULL AND
    (p_role = 'owner' OR p_role = 'contributor' OR p_role = 'reader');
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP FUNCTION IF EXISTS `pst_split_string` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE FUNCTION `pst_split_string`(
	p_str LONGTEXT,
	p_delim VARCHAR(12),
	p_pos INT
) RETURNS varchar(80) CHARSET latin1
BEGIN
  RETURN REPLACE(
    SUBSTRING(
      SUBSTRING_INDEX(p_str, p_delim, p_pos) ,
      CHAR_LENGTH(
        SUBSTRING_INDEX(p_str, p_delim , p_pos - 1)
      ) + 1
    ),
    p_delim,
    ''
  );
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_add_file` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_add_file`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36),
                    IN p_file_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_mime_type VARCHAR(45), 
                    IN p_is_video BIT(1),
                    IN p_height INT,
                    IN p_width INT,
                    IN p_file_size INT,
                    IN p_is_processing BIT(1))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not found */
      'Library or folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role = 'reader') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to add pst_files to this folder.' AS err_context;
    LEAVE this_proc;
  END IF;

  -- Check for existing pst_files with the same name.
  SET @suffix = 1;
  SET @idx = CHAR_LENGTH(p_name) - LOCATE('.', REVERSE(p_name)) + 1;
  SET @base = LEFT(p_name, @idx - 1);
  SET @ext = SUBSTRING(p_name, @idx);
  SET @name = p_name;
  SELECT 
    p_file_id INTO @existing 
  FROM
    pst_files
  WHERE 
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed AND
    name = @name;
  find_existing_file: WHILE @existing IS NOT NULL AND @suffix <= 999 DO 
    SET @suffix = @suffix + 1;
    SET @existing = NULL;
    SET @name = CONCAT(@base, ' (', CONVERT(@suffix, CHAR), ')', @ext);
    SELECT 
      p_file_id INTO @existing 
    FROM
      pst_files
    WHERE 
      library_id = @library_id_compressed AND
      folder_id = @folder_id_compressed AND
      name = @name;
  END WHILE find_existing_file;

  SET @imported_on = UTC_TIMESTAMP();

  INSERT INTO
    pst_files(
      library_id,
      folder_id,
      file_id,
      name,
      mime_type,
      is_video,
      height,
      width,
      imported_on,
      file_size,
      file_size_cnv_video,
      is_processing
    )
  VALUES 
    (
      @library_id_compressed,
      @folder_id_compressed,
      @file_id_compressed,
      @name,
      p_mime_type,
      p_is_video,
      p_height,
      p_width,
      @imported_on,
      p_file_size,
      CASE WHEN p_is_video = 1 AND p_mime_type = 'video/mp4' THEN 0 ELSE NULL END,
      p_is_processing
    );

	SELECT
    0 AS err_code,
    NULL as err_context;

  CALL pst_get_file_ex(@library_id_compressed, @file_id_compressed);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_add_folder` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_add_folder`(
                  IN p_user_id VARCHAR(254),
                  IN p_library_id VARCHAR(36), 
                  IN p_folder_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id VARCHAR(36), 
                  IN p_type VARCHAR(20))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET @library_id_compressed = pst_compress_guid(p_library_id);

  -- Make sure the user has permission to create pst_folders under the parent.
  SET @role = COALESCE(pst_get_user_role(p_user_id, @library_id_compressed, pst_compress_guid(p_parent_id)), '');
  IF (@role <> 'owner' AND @role <> 'contributor') THEN
    SELECT
      9 AS err_code,
      'User is not authorized to create pst_folders.' AS err_context;
    LEAVE this_proc;
  END IF;

  START TRANSACTION;

  CALL pst_add_folder_core(
            p_user_id, 
            p_library_id, 
            p_folder_id,
            p_name,
            p_parent_id, 
            p_type, 
            @err_code,
            @err_context);

  COMMIT;

	SELECT
    @err_code AS err_code,
    @err_context as err_context;

  SELECT
		pst_expand_guid(library_id) AS library_id,
		pst_expand_guid(folder_id) AS folder_id,
		name,
		pst_expand_guid(parent_id) AS parent_id,
    type,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    file_size_cnv_video,
    data,
    `where`,
    order_by,
    'owner' AS user_role
  FROM
    pst_folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id = pst_compress_guid(p_folder_id);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_add_folder_core` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_add_folder_core`(
                  IN p_user_id VARCHAR(254),
                  IN p_library_id VARCHAR(36), 
                  IN p_folder_id VARCHAR(36), 
                  IN p_name VARCHAR(80), 
                  IN p_parent_id VARCHAR(36), 
                  IN p_type VARCHAR(20),
                  OUT p_err_code INT,
                  OUT p_err_context VARCHAR(80))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SET p_err_code = 2;   /* Duplicate item */
    SET p_err_context = 'Duplicate item exists';
  END;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET p_err_code = 999;     /* Unexpected error */
    SET p_err_context = 'An unexpected error occurred.';
  END;

  -- Check for invalid characters.
  IF (INSTR(p_name, '/') > 0) THEN
    SET p_err_code = 8;    -- Invalid field value
    SET p_err_context = 'Invalid character in folder name.';
    LEAVE this_proc;
  END IF;

  IF (p_parent_id IS NULL) THEN
    BEGIN
      SET @parent_id_compressed = NULL;
      SET @path = '';
    END;
  ELSE
    BEGIN
      SET @parent_id_compressed = pst_compress_guid(p_parent_id);

      SELECT 
        CONCAT(`path`, '/', p_folder_id) INTO @path 
      FROM 
        pst_folders 
      WHERE 
        library_id = pst_compress_guid(p_library_id) AND folder_id = @parent_id_compressed;

      -- Trim leading slash if it exists.
      IF (STRCMP(LEFT(@path, 1), '/') = 0) THEN 
        SET @path = SUBSTRING(@path, 2);
      END IF;
    END;
  END IF;

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

  INSERT INTO 
    pst_folders(library_id, folder_id, name, parent_id, type, `path`)
  VALUES
    (@library_id_compressed, @folder_id_compressed, p_name, @parent_id_compressed, p_type, @path);

  INSERT INTO
    pst_folder_user_roles(library_id, folder_id, user_id, role)
  VALUES
    (@library_id_compressed, @folder_id_compressed,  p_user_id, 'owner');

  SET p_err_code = 0;
  SET p_err_context = NULL;
  
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_add_folder_user` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_add_folder_user`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36),
                      IN p_folder_id VARCHAR(36),
                      IN p_new_user_id VARCHAR(254),
                      IN p_role VARCHAR(20))
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT
      2 AS err_code,   /* Duplicate item */
      'Duplicate item exists' AS err_context;
  END;

  IF (NOT pst_is_valid_role(p_role)) THEN
    SELECT
      8 AS err_code,      /* Invalid field value */
      'Invalid role value' AS err_context;
    LEAVE this_proc;
  END IF;

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

  SET @role = COALESCE(pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed), '');
  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to grant folder permissions.' AS err_context;
    LEAVE this_proc;
  END IF;

  INSERT INTO
    pst_folder_user_roles (library_id, folder_id, user_id, role)
  VALUES
    (@library_id_compressed, @folder_id_compressed, p_new_user_id, p_role);

  SELECT
    0 AS err_code,
    NULL as err_context;

  SELECT
    p_library_id AS library_id,
    p_folder_id AS folder_id,
    p_new_user_id AS user_id,
    p_role AS role;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_add_library` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_add_library`(
                      IN p_user_id VARCHAR(254),
											IN p_library_id VARCHAR(36), 
											IN p_name VARCHAR(80), 
                      IN p_time_zone VARCHAR(80),
											IN p_description LONGTEXT)
BEGIN

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Create the library.    
  INSERT INTO 
    pst_libraries(library_id, name, time_zone, description)
  VALUES
    (pst_compress_guid(p_library_id), p_name, p_time_zone, p_description);

  -- Create the root folder in the library.
  SET @default_folder_id = uuid();
  CALL pst_add_folder_core(
            p_user_id, 
            p_library_id, 
            @default_folder_id, 
            'All Pictures', 
            NULL, 
            'picture', 
            @err_code,
            @err_context);

  -- Grant the system user full access to the library.
  INSERT INTO
    pst_folder_user_roles (library_id, folder_id, user_id, role)
  VALUES
    (pst_compress_guid(p_library_id), pst_compress_guid(@default_folder_id), 'system.user@picstrata.api', 'owner');

  IF (@err_code <> 0) THEN
    ROLLBACK;
  ELSE
    COMMIT;
  END IF;

	SELECT
		@err_code AS err_code,
		@err_context AS err_context;

	SELECT 
		p_library_id AS library_id,
		p_name AS name,
    p_time_zone as time_zone,
		p_description AS description,
    'owner' AS user_role;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_delete_file` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_delete_file`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_file_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    pst_files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not Found */
      'File does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role = 'reader') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to delete file.' AS err_context;
    LEAVE this_proc;
  END IF;

	DELETE FROM
		pst_files
	WHERE
		library_id = @library_id_compressed AND
    file_id = @file_id_compressed;
        
	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id,
      p_file_id AS file_id;
	
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_delete_folder` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_delete_folder`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

  -- Make sure the user has permission to update the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,          /* Not Authorized */
      'User is not authorized to delete this folder.' AS err_context;
    LEAVE this_proc;
  END IF;

  START TRANSACTION;

  -- Recursively delete any permissions associated with the folder tree.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM pst_folders
    WHERE library_id = @library_id_compressed AND folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN pst_folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    pst_folder_user_roles
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

  -- Delete the pst_files in this folder and any folder that is
  -- a descendant of this folder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM pst_folders
    WHERE library_id = @library_id_compressed AND folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN pst_folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    pst_files
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

  -- Now delete the pst_folders.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name) AS
  (
    SELECT library_id, folder_id, parent_id, name
    FROM pst_folders
    WHERE library_id = @library_id_compressed AND folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT sub.library_id, sub.folder_id, sub.parent_id, sub.name
      FROM folder_tree AS fp JOIN pst_folders AS sub
    ON fp.library_id = sub.library_id AND fp.folder_id = sub.parent_id
  )
  DELETE FROM
    pst_folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id IN (SELECT folder_id FROM folder_tree);

	SELECT ROW_COUNT() INTO @affected_rows;

  COMMIT;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id,
      p_folder_id AS folder_id;
	
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_delete_library` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_delete_library`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36))
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(folder_id) > 0 INTO @user_is_participant FROM pst_folder_user_roles 
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (NOT @user_is_participant) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library does not exist.' as err_context;
    LEAVE this_proc;
  END IF;

  -- Only owners on a library can delete it.
  SELECT user_role INTO @role FROM pst_library_user_roles
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (@role IS NULL OR @role <> 'owner') THEN
    SELECT 
      9 AS err_code,        /* Not authorized */
      'User is not authorized to delete the library.' as err_context;
    LEAVE this_proc;
  END IF;

  tran_block:BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION 
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

    START TRANSACTION;

    -- Delete pst_files in the library first.
    DELETE FROM
      pst_file_tags
    WHERE
      library_id = @library_id_compressed;

    DELETE FROM
      pst_files
    WHERE
      library_id = @library_id_compressed;

    -- Delete permissions assigned to child pst_folders.
    DELETE FROM 
      pst_folder_user_roles
    WHERE
      library_id = @library_id_compressed;

    -- Delete child pst_folders next.
    DELETE FROM
      pst_folders
    WHERE
      library_id = @library_id_compressed;

    -- Now delete the library itself.
    DELETE FROM
      pst_libraries
    WHERE
      library_id = @library_id_compressed;
          
    SELECT ROW_COUNT() INTO @affected_rows;

    COMMIT;
  END;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
			'No rows were modified by delete statement.' as err_context;

	SELECT
			p_library_id AS library_id;
	
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_file` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_file`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_file_id VARCHAR(36))
this_proc:BEGIN
	
  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    pst_files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);
  
  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'File not found.' as err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;

  CALL pst_get_file_ex(@library_id_compressed, @file_id_compressed);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_files` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_files`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
this_proc:BEGIN
	
  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);
  
  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'Library or folder not found.' as err_context;
    LEAVE this_proc;
  END IF;
  
  SELECT
    0 AS err_code,
    NULL AS err_context;
    
	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
    pst_expand_guid(f.file_id) AS file_id,
		f.name,
		f.mime_type,
    f.is_video,
    f.height,
    f.width,
    f.imported_on,
    f.taken_on,
    f.modified_on,
    f.rating,
    f.title,
    f.comments,
    f.latitude,
    f.longitude,
    f.altitude,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.file_size_backup,
    f.is_processing,
    t.tags
	FROM
		pst_files f LEFT JOIN
      pst_vw_file_tags t ON
        f.library_id = t.library_id AND
        f.file_id = t.file_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.folder_id = @folder_id_compressed
	ORDER BY
		name, imported_on;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_file_content_info` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_file_content_info`(
                        IN p_user_id VARCHAR(254),
                        IN p_library_id VARCHAR(36), 
                        IN p_file_id VARCHAR(36))
this_proc:BEGIN
	
  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    pst_files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      'File not found.' as err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;

	SELECT
		pst_expand_guid(fi.library_id) AS library_id,
		pst_expand_guid(fi.folder_id) AS folder_id,
    pst_expand_guid(fi.file_id) AS file_id,
		fi.mime_type as mime_type,
    fi.name AS name,
    CASE 
      WHEN LENGTH(fo.`path`) > 0 THEN CONCAT(fo.`path`, '/', p_file_id)
      ELSE p_file_id
    END AS `path`,
    fi.is_video,
    fi.is_processing
	FROM
		pst_files fi INNER JOIN pst_folders fo ON fi.folder_id = fo.folder_id
  WHERE
    fi.library_id = @library_id_compressed AND
    fi.file_id = @file_id_compressed;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_file_ex` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_file_ex`(IN p_library_id BINARY(16), p_file_id BINARY(16))
this_proc:BEGIN

  SELECT
      pst_expand_guid(f.library_id) AS library_id,
      pst_expand_guid(f.folder_id) AS folder_id,
      pst_expand_guid(f.file_id) AS file_id,
      f.name,
      f.mime_type,
      f.is_video,
      f.height,
      f.width,
      f.imported_on,
      f.taken_on,
      f.modified_on,
      f.rating,
      f.title,
      f.comments,
      f.latitude,
      f.longitude,
      f.altitude,
      f.file_size,
      f.file_size_sm,
      f.file_size_md,
      f.file_size_lg,
      f.file_size_cnv_video,
      f.file_size_backup,
      f.is_processing,
      t.tags
    FROM
      pst_files f LEFT JOIN
        pst_vw_file_tags t ON
          f.library_id = t.library_id AND
          f.file_id = t.file_id
    WHERE
      f.library_id = p_library_id AND
      f.file_id = p_file_id;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_folder` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_folder`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_folder_id VARCHAR(36))
this_proc:BEGIN
	
  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

  -- Make sure the user has permission to see the folder.
  SET @role = pst_get_user_role(
                p_user_id, 
                @library_id_compressed, 
                @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL as err_context;

	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
    f.type,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.data,
    f.`where`,
    f.order_by,
    ur.role AS user_role
	FROM
    pst_folders f 
      LEFT JOIN (SELECT * FROM pst_folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.folder_id = @folder_id_compressed;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_folders` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_folders`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_parent_id VARCHAR(36))
this_proc:BEGIN
	
  IF p_parent_id IS NOT NULL THEN
    SET @parent_id_compressed = pst_compress_guid(p_parent_id);
  END IF;

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  

  -- Make sure the user has permission to see pst_folders under the parent.
  SET @role = pst_get_user_role(
              p_user_id, 
              @library_id_compressed, 
              IF (p_parent_id IS NULL, NULL, @parent_id_compressed));

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  SELECT
    0 AS err_code,
    NULL AS err_context;

	SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
    f.type,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.data,
    f.`where`,
    f.order_by,
    ur.role AS user_role
	FROM
    pst_folders f 
      LEFT JOIN (SELECT * FROM pst_folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = pst_compress_guid(p_library_id) AND
    (f.parent_id = @parent_id_compressed OR (p_parent_id IS NULL AND f.parent_id IS NULL)) AND
    @role IS NOT NULL -- UNDONE: see above.
	ORDER BY
		name;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_folder_breadcrumbs` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_folder_breadcrumbs`(
                    p_user_id VARCHAR(254), 
                    p_library_id VARCHAR(36), 
                    p_folder_id VARCHAR(36))
BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

	SELECT
		0 AS err_code,
		NULL AS err_context;

  -- Walk the folder tree from the specified folder all the way to the
  -- root looking for the most privileged role assigned to the user.
  -- A higher-ranked role on a parent folder overrides a lower-ranked
  -- role on a subfolder.
  WITH RECURSIVE folder_tree (library_id, folder_id, parent_id, name, role) AS
  (
    SELECT 
      f.library_id, 
      f.folder_id, 
      f.parent_id, 
      f.name,
      pst_get_user_role(p_user_id, f.library_id, f.folder_id) AS role
    FROM 
      pst_folders f
    WHERE 
      f.library_id = @library_id_compressed AND 
      f.folder_id = @folder_id_compressed
      
    UNION ALL
      
    SELECT 
      par.library_id, 
      par.folder_id, 
      par.parent_id, 
      par.name,
      pst_get_user_role(p_user_id, par.library_id, par.folder_id) AS role
    FROM 
      folder_tree AS ft JOIN pst_folders AS par
      ON ft.library_id = par.library_id AND ft.parent_id = par.folder_id
  )
  SELECT 
    pst_expand_guid(f.library_id) AS library_id,
    pst_expand_guid(f.folder_id) AS folder_id,
    f.name
  FROM 
    folder_tree f
  WHERE
    f.role IS NOT NULL AND
    f.folder_id <> @folder_id_compressed
  ORDER BY 
    name;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_libraries` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_libraries`(IN p_user_id VARCHAR(254))
BEGIN
	
  SELECT
    0 AS err_code,
    NULL AS err_context;
    
  SELECT 
    pst_expand_guid(l.library_id) AS library_id, 
    l.name, 
    l.description, 
    ur.role AS user_role
  FROM
    pst_libraries l 
      INNER JOIN pst_folders f 
      ON l.library_id = f.library_id
      LEFT JOIN (SELECT * FROM pst_folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE 
    f.parent_id IS NULL AND
    l.library_id IN 
      (SELECT DISTINCT library_id FROM pst_folder_user_roles WHERE user_id = p_user_id);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_library` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_library`(
                    IN p_user_id VARCHAR(254), 
                    IN p_library_id VARCHAR(36))
BEGIN

  SELECT
    0 AS err_code,
    NULL AS err_context;

	SELECT
		pst_expand_guid(l.library_id) AS library_id,
		l.name,
    l.time_zone,
		l.description,
    ur.role AS user_role
	FROM
    pst_libraries l 
      INNER JOIN (SELECT * FROM pst_folders WHERE parent_id IS NULL) f
      ON l.library_id = f.library_id
      LEFT JOIN (SELECT * FROM pst_folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
	WHERE
		l.library_id = pst_compress_guid(p_library_id) AND
    l.library_id IN
      (SELECT DISTINCT library_id FROM pst_folder_user_roles WHERE user_id = p_user_id);
        
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_get_statistics` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_get_statistics`()
BEGIN

  SELECT
    0 AS err_code,
    NULL AS err_context;
    
  SELECT
    (SELECT COUNT(*) FROM pst_libraries) AS library_count,
    (SELECT COUNT(*) FROM pst_folders) AS folder_count,
    (SELECT COUNT(*) FROM pst_files) AS file_count,
    (SELECT COUNT(*) FROM pst_folder_user_roles) AS folder_user_role_count,
    (SELECT COUNT(*) FROM pst_files WHERE is_processing=1) AS processing_count;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_recalc_folder` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_recalc_folder`(
          IN p_library_id VARCHAR(36), 
          IN p_folder_id VARCHAR(36))
BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);

  SELECT 
    COALESCE(COUNT(file_id), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv_video), 0) 
  INTO
    @folder_file_count,
    @folder_file_size, 
    @folder_file_size_sm,
    @folder_file_size_md,
    @folder_file_size_lg,
    @folder_file_size_cnv_video
  FROM 
    pst_files 
  WHERE 
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  SELECT
    COALESCE(SUM(file_count), 0),
    COALESCE(SUM(file_size), 0),
    COALESCE(SUM(file_size_sm), 0),
    COALESCE(SUM(file_size_md), 0),
    COALESCE(SUM(file_size_lg), 0),
    COALESCE(SUM(file_size_cnv_video), 0) 
  INTO 
    @subfolder_file_count,
    @subfolder_file_size,
    @subfolder_file_size_sm,
    @subfolder_file_size_md,
    @subfolder_file_size_lg,
    @subfolder_file_size_cnv_video
  FROM
    pst_folders
  WHERE
    library_id = @library_id_compressed AND
    parent_id = @folder_id_compressed;

  UPDATE 
    pst_folders
  SET 
    file_count = @folder_file_count + @subfolder_file_count,
    file_size = @folder_file_size + @subfolder_file_size,
    file_size_sm = @folder_file_size_sm + @subfolder_file_size_sm,
    file_size_md = @folder_file_size_md + @subfolder_file_size_md,
    file_size_lg = @folder_file_size_lg + @subfolder_file_size_lg,
    file_size_cnv_video = @folder_file_size_cnv_video + @subfolder_file_size_cnv_video
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  SELECT
		p_library_id AS library_id,
		p_folder_id AS folder_id,
		name,
		pst_expand_guid(parent_id) AS parent_id,
    type,
    `path`,
    file_count,
    file_size,
    file_size_sm,
    file_size_md,
    file_size_lg,
    file_size_cnv_video,
    data,
    `where`,
    order_by
  FROM
    pst_folders
  WHERE
    library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_set_file_tags` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_set_file_tags`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_tags LONGTEXT)
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    pst_files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not Found */
      'File does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  START TRANSACTION;

  DELETE FROM 
    pst_file_tags
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  SET @pos = 1;
  SET @tag = pst_split_string(p_tags, '¬', @pos);
  insert_tags: WHILE @tag IS NOT NULL AND LENGTH(@tag) > 0 DO

    INSERT INTO 
      pst_file_tags(library_id, file_id, tag)
    VALUES
      (@library_id_compressed, @file_id_compressed, @tag);

    SET @pos = @pos + 1;
    SET @tag = pst_split_string(p_tags, '¬', @pos);
  END WHILE insert_tags;

  COMMIT;

	SELECT
		0
			AS err_code,
			NULL as err_context;

	SELECT
			p_library_id AS library_id,
      p_file_id AS file_id,
      @pos - 1 AS tag_count;
	
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_update_file` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_update_file`(
          IN p_user_id VARCHAR(254),
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36),
          IN p_height INT,
          IN p_width INT,
          IN p_taken_on DATETIME,
          IN p_name VARCHAR(80),
          IN p_rating TINYINT,
          IN p_title VARCHAR(80),
          IN p_comments LONGTEXT,
          IN p_latitude DECIMAL(15, 10),
          IN p_longitude DECIMAL(15, 10),
          IN p_altitude DECIMAL(15, 10),
          IN p_file_size INT)
this_proc:BEGIN

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    SELECT 
      2 AS err_code,
      'Duplicate item exists' AS err_context;
  END;

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);

  -- Grab the parent folder ID.  
  SELECT
    folder_id INTO @folder_id_compressed
  FROM
    pst_files
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

  -- Figure out if the user has permissions on the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,      /* Not Found */
      'File does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role = 'reader') THEN
    SELECT
      9 AS err_code,      /* Not authorized */
      'User is not authorized to modify file.' AS err_context;
    LEAVE this_proc;
  END IF;

  UPDATE
    pst_files 
  SET
    taken_on = p_taken_on,
    name = p_name,
    rating = p_rating,
    title = p_title,
    comments = p_comments,
    latitude = p_latitude,
    longitude = p_longitude,
    altitude = p_altitude,
    height = p_height,
    width = p_width,
    file_size = p_file_size
  WHERE
    library_id = @library_id_compressed AND
    file_id = @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  CALL pst_get_file_ex(@library_id_compressed, @file_id_compressed);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_update_file_cnv_video` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_update_file_cnv_video`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_file_size INT)
BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  UPDATE 
    pst_files 
  SET 
    file_size_cnv_video = p_file_size,
    is_processing = 
      file_size_sm IS NULL OR 
      file_size_md IS NULL OR 
      file_size_lg IS NULL
  WHERE 
    library_id = @library_id_compressed AND file_id = @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  CALL pst_get_file_ex(@library_id_compressed, @file_id_compressed);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_update_file_thumbnail` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_update_file_thumbnail`(
          IN p_library_id VARCHAR(36), 
          IN p_file_id VARCHAR(36), 
          IN p_thumbnail_size CHAR(2),
          IN p_file_size INT)
BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @file_id_compressed = pst_compress_guid(p_file_id);
  SET @file_size = p_file_size;
  
  SET @sql = CONCAT(
    'UPDATE 
      pst_files 
    SET 
      file_size_', p_thumbnail_size, ' = ?,
      is_processing = 
        file_size_sm IS NULL OR 
        file_size_md IS NULL OR 
        file_size_lg IS NULL OR
        (is_video = 1 AND file_size_cnv_video IS NULL)
    WHERE 
      library_id = ? AND file_id = ?;');

  PREPARE stmt FROM @sql;
  EXECUTE stmt USING @file_size, @library_id_compressed, @file_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  DEALLOCATE PREPARE stmt;

  CALL pst_get_file_ex(@library_id_compressed, @file_id_compressed);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_update_folder` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_update_folder`(
                      IN p_user_id VARCHAR(254),
                      IN p_library_id VARCHAR(36), 
                      IN p_folder_id VARCHAR(36), 
                      IN p_name VARCHAR(80))
this_proc:BEGIN
  	
  SET @library_id_compressed = pst_compress_guid(p_library_id);
  SET @folder_id_compressed = pst_compress_guid(p_folder_id);
  
  -- Make sure the user has permission to update the folder.
  SET @role = pst_get_user_role(p_user_id, @library_id_compressed, @folder_id_compressed);

  IF (@role IS NULL) THEN
    SELECT
      1 AS err_code,          /* Not Found */
      'Folder does not exist.' AS err_context;
    LEAVE this_proc;
  END IF;

  IF (@role <> 'owner') THEN
    SELECT
      9 AS err_code,          /* Not Authorized */
      'User is not authorized to create pst_folders.' AS err_context;
    LEAVE this_proc;
  END IF;

  -- TODO UNDONE Create an index on path.

  -- Grab the current name and path for the folder.
  SELECT 
    name, `path` 
  INTO 
    @old_name, @old_path
  FROM
    pst_folders
  WHERE
		library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

  -- Break out the root.
  SET @parent_path = 
    LEFT
    (
      @old_path, 
      LENGTH(@old_path) - LENGTH(SUBSTRING_INDEX(@old_path, '/', -1)) -1
    );

  -- Calculate the new path for the folder and make
  -- sure to trim any leading slash.
  SET @new_path = CONCAT(@parent_path, '/', p_folder_id);
  IF (STRCMP(LEFT(@new_path, 1), '/') = 0) THEN 
    SET @new_path = SUBSTRING(@new_path, 2);
  END IF;

  UPDATE
		pst_folders
	SET
		name = p_name,
    `path` = @new_path
	WHERE
		library_id = @library_id_compressed AND
    folder_id = @folder_id_compressed;

	SELECT ROW_COUNT() INTO @affected_rows;

  -- If we successfully renamed the folder then make sure
  -- the path values for any children are also updated.
  IF (@affected_rows = 1) THEN
    SET @old_path_len = LENGTH(@old_path);
    UPDATE
      pst_folders
    SET 
      `path` = CONCAT(@new_path, RIGHT(`path`, LENGTH(`path`) - @old_path_len))
    WHERE
      library_id = @library_id_compressed AND
      `path` LIKE CONCAT(@old_path, '/%');
  END IF;  

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

  SELECT
		pst_expand_guid(f.library_id) AS library_id,
		pst_expand_guid(f.folder_id) AS folder_id,
		f.name,
		pst_expand_guid(f.parent_id) AS parent_id,
    f.type,
    f.`path`,
    f.file_count,
    f.file_size,
    f.file_size_sm,
    f.file_size_md,
    f.file_size_lg,
    f.file_size_cnv_video,
    f.data,
    f.`where`,
    f.order_by,
    ur.role AS user_role
  FROM
    pst_folders f 
      LEFT JOIN (SELECT * FROM pst_folder_user_roles WHERE user_id = p_user_id) ur
      ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
  WHERE
    f.library_id = @library_id_compressed AND
    f.folder_id = @folder_id_compressed;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pst_update_library` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `pst_update_library`(
                    IN p_user_id VARCHAR(254),
                    IN p_library_id VARCHAR(36), 
                    IN p_name VARCHAR(80), 
                    IN p_time_zone VARCHAR(80),
                    IN p_description LONGTEXT)
this_proc:BEGIN

  SET @library_id_compressed = pst_compress_guid(p_library_id);

  -- If the user has no access to the library at all they should not
  -- be made aware that it even exists.
  SELECT COUNT(folder_id) > 0 INTO @user_is_participant FROM pst_folder_user_roles 
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (NOT @user_is_participant) THEN
    SELECT 
      1 AS err_code,        /* Not found */
      NULL as err_context;
    LEAVE this_proc;
  END IF;

  -- Only owners and contributors on a library can update it.
  SELECT user_role INTO @role FROM pst_library_user_roles
  WHERE library_id = @library_id_compressed AND user_id = p_user_id;
  IF (@role IS NULL OR (@role <> 'owner' AND @role <> 'contributor')) THEN
    SELECT 
      9 AS err_code,        /* Not authorized */
      'User is not authorized to update the library.' as err_context;
    LEAVE this_proc;
  END IF;

	UPDATE
		pst_libraries
	SET
		name = p_name,
    time_zone = p_time_zone,
		description = p_description
	WHERE
		library_id = @library_id_compressed;
        
	SELECT ROW_COUNT() INTO @affected_rows;

	SELECT
		CASE 
			WHEN @affected_rows = 0 THEN 1	/* Not Found */
			ELSE 0 
		END
			AS err_code,
		NULL AS err_context;

	SELECT
		pst_expand_guid(l.library_id) AS library_id,
		l.name,
    l.time_zone,
		l.description,
    ur.role AS user_role
	FROM
    pst_libraries l 
      INNER JOIN pst_folders f 
        ON l.library_id = f.library_id
      LEFT JOIN pst_folder_user_roles ur 
        ON f.library_id = ur.library_id AND f.folder_id = ur.folder_id
	WHERE
		l.library_id = pst_compress_guid(p_library_id) AND
    l.library_id IN
      (SELECT DISTINCT library_id FROM pst_folder_user_roles WHERE user_id = p_user_id) AND
    f.parent_id IS NULL AND
    ur.user_id = p_user_id;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `pst_vw_file_tags`
--

/*!50001 DROP VIEW IF EXISTS `pst_vw_file_tags`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 SQL SECURITY DEFINER */
/*!50001 VIEW `pst_vw_file_tags` AS select `pst_file_tags`.`library_id` AS `library_id`,`pst_file_tags`.`file_id` AS `file_id`,group_concat(`pst_file_tags`.`tag` separator '¬') AS `tags` from `pst_file_tags` group by `pst_file_tags`.`library_id`,`pst_file_tags`.`file_id` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `pst_library_user_roles`
--

/*!50001 DROP VIEW IF EXISTS `pst_library_user_roles`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 SQL SECURITY DEFINER */
/*!50001 VIEW `pst_library_user_roles` AS select `l`.`library_id` AS `library_id`,`l`.`name` AS `name`,`l`.`description` AS `description`,`ur`.`user_id` AS `user_id`,`ur`.`role` AS `user_role` from ((`pst_libraries` `l` join `pst_folders` `f` on((`l`.`library_id` = `f`.`library_id`))) left join `pst_folder_user_roles` `ur` on(((`f`.`library_id` = `ur`.`library_id`) and (`f`.`folder_id` = `ur`.`folder_id`)))) where (`f`.`parent_id` is null) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2020-04-05 16:20:43
