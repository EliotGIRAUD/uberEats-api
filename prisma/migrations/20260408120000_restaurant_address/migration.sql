-- AlterTable
ALTER TABLE `Restaurant` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `postalCode` VARCHAR(32) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL;
