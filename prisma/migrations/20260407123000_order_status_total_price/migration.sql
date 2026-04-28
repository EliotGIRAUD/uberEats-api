-- Statut legacy (init) : PICKED_UP -> READY avant de réduire l’ENUM
UPDATE `Order`
SET `status` = 'READY'
WHERE `status` = 'PICKED_UP';

-- totalPrice : n’ajoute la colonne que si elle n’existe pas (base déjà alignée / reprise sur erreur)
SET @db := DATABASE();
SET @colExists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'Order'
    AND COLUMN_NAME = 'totalPrice'
);
SET @stmt := IF(
  @colExists = 0,
  'ALTER TABLE `Order` ADD COLUMN `totalPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0.00',
  'SELECT 1'
);
PREPARE alterTotalPrice FROM @stmt;
EXECUTE alterTotalPrice;
DEALLOCATE PREPARE alterTotalPrice;

-- Aligner l’ENUM sur le schéma Prisma (ré-exécution tolérée)
ALTER TABLE `Order`
MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';
