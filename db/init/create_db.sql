/*
 * SQL that is added to the generated create database script.
 */

SET FOREIGN_KEY_CHECKS = 0;

SET @sql = CONCAT('DROP DATABASE IF EXISTS ', @db_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('CREATE DATABASE ', @db_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('GRANT SELECT ON ', @db_name, '.* TO ', @user_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('GRANT INSERT ON ', @db_name, '.* TO ', @user_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('GRANT UPDATE ON ', @db_name, '.* TO ', @user_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('GRANT DELETE ON ', @db_name, '.* TO ', @user_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('GRANT EXECUTE ON ', @db_name, '.* TO ', @user_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
