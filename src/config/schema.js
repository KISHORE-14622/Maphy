const SCHEMAS = [
  // 1. groups (permission groups)
  `CREATE TABLE IF NOT EXISTS \`groups\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`permissions\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 2. companies
  `CREATE TABLE IF NOT EXISTS \`companies\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 3. locations
  `CREATE TABLE IF NOT EXISTS \`locations\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`parent_id\` int(11) DEFAULT NULL,
    \`manager_id\` int(11) DEFAULT NULL,
    \`city\` varchar(255) DEFAULT NULL,
    \`state\` varchar(255) DEFAULT NULL,
    \`country\` varchar(255) DEFAULT NULL,
    \`zip\` varchar(50) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 4. departments
  `CREATE TABLE IF NOT EXISTS \`departments\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`company_id\` int(11) DEFAULT NULL,
    \`location_id\` int(11) DEFAULT NULL,
    \`manager_id\` int(11) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 5. users
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`first_name\` varchar(255) NOT NULL,
    \`last_name\` varchar(255) DEFAULT NULL,
    \`email\` varchar(255) NOT NULL,
    \`password\` varchar(255) NOT NULL,
    \`username\` varchar(255) DEFAULT NULL,
    \`company_id\` int(11) DEFAULT NULL,
    \`location_id\` int(11) DEFAULT NULL,
    \`department_id\` int(11) DEFAULT NULL,
    \`group_id\` int(11) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`email\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 6. manufacturers
  `CREATE TABLE IF NOT EXISTS \`manufacturers\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`url\` varchar(255) DEFAULT NULL,
    \`support_url\` varchar(255) DEFAULT NULL,
    \`support_email\` varchar(255) DEFAULT NULL,
    \`support_phone\` varchar(50) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 7. depreciations
  `CREATE TABLE IF NOT EXISTS \`depreciations\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`months\` int(11) NOT NULL,
    \`residual_value\` decimal(10,2) DEFAULT '0.00',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 8. status_labels
  `CREATE TABLE IF NOT EXISTS \`status_labels\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`type\` varchar(50) DEFAULT 'deployable',
    \`notes\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 9. categories
  `CREATE TABLE IF NOT EXISTS \`categories\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`category_type\` varchar(50) NOT NULL,
    \`use_default_eula\` tinyint(4) DEFAULT '0',
    \`require_acceptance\` tinyint(4) DEFAULT '0',
    \`email_notification\` tinyint(4) DEFAULT '0',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 10. suppliers
  `CREATE TABLE IF NOT EXISTS \`suppliers\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`address\` varchar(255) DEFAULT NULL,
    \`city\` varchar(255) DEFAULT NULL,
    \`state\` varchar(255) DEFAULT NULL,
    \`country\` varchar(255) DEFAULT NULL,
    \`zip\` varchar(50) DEFAULT NULL,
    \`contact_name\` varchar(255) DEFAULT NULL,
    \`email\` varchar(255) DEFAULT NULL,
    \`phone\` varchar(50) DEFAULT NULL,
    \`fax\` varchar(50) DEFAULT NULL,
    \`url\` varchar(255) DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 11. asset_models
  `CREATE TABLE IF NOT EXISTS \`asset_models\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`manufacturer_id\` int(11) DEFAULT NULL,
    \`category_id\` int(11) DEFAULT NULL,
    \`model_number\` varchar(255) DEFAULT NULL,
    \`depreciation_id\` int(11) DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`eol\` int(11) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 12. hardware
  `CREATE TABLE IF NOT EXISTS \`hardware\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`asset_tag\` varchar(255) DEFAULT NULL,
    \`serial\` varchar(255) DEFAULT NULL,
    \`model_id\` int(11) DEFAULT NULL,
    \`status_id\` int(11) DEFAULT NULL,
    \`company_id\` int(11) DEFAULT NULL,
    \`supplier_id\` int(11) DEFAULT NULL,
    \`rtd_location_id\` int(11) DEFAULT NULL,
    \`depreciation_id\` int(11) DEFAULT NULL,
    \`purchase_date\` date DEFAULT NULL,
    \`purchase_cost\` decimal(10,2) DEFAULT NULL,
    \`warranty_months\` int(11) DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`requestable\` tinyint(4) DEFAULT '1',
    \`gst\` decimal(10,2) DEFAULT NULL,
    \`image\` varchar(255) DEFAULT NULL,
    \`order_number\` varchar(255) DEFAULT NULL,
    \`checkout_to_type\` varchar(50) DEFAULT NULL,
    \`assigned_to\` int(11) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 13. accessories
  `CREATE TABLE IF NOT EXISTS \`accessories\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`category_id\` int(11) DEFAULT NULL,
    \`manufacturer_id\` int(11) DEFAULT NULL,
    \`supplier_id\` int(11) DEFAULT NULL,
    \`qty\` int(11) DEFAULT '0',
    \`min_qty\` int(11) DEFAULT '0',
    \`location_id\` int(11) DEFAULT NULL,
    \`model_number\` varchar(255) DEFAULT NULL,
    \`purchase_date\` date DEFAULT NULL,
    \`purchase_cost\` decimal(10,2) DEFAULT NULL,
    \`order_number\` varchar(255) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 14. accessory_assignments
  `CREATE TABLE IF NOT EXISTS \`accessory_assignments\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`accessory_id\` int(11) NOT NULL,
    \`user_id\` int(11) DEFAULT NULL,
    \`qty\` int(11) DEFAULT '1',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 15. consumables
  `CREATE TABLE IF NOT EXISTS \`consumables\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`category_id\` int(11) DEFAULT NULL,
    \`manufacturer_id\` int(11) DEFAULT NULL,
    \`supplier_id\` int(11) DEFAULT NULL,
    \`qty\` int(11) DEFAULT '0',
    \`min_qty\` int(11) DEFAULT '0',
    \`location_id\` int(11) DEFAULT NULL,
    \`item_number\` varchar(255) DEFAULT NULL,
    \`purchase_date\` date DEFAULT NULL,
    \`purchase_cost\` decimal(10,2) DEFAULT NULL,
    \`order_number\` varchar(255) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 16. consumable_assignments
  `CREATE TABLE IF NOT EXISTS \`consumable_assignments\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`consumable_id\` int(11) NOT NULL,
    \`user_id\` int(11) DEFAULT NULL,
    \`qty\` int(11) DEFAULT '1',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 17. components
  `CREATE TABLE IF NOT EXISTS \`components\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`category_id\` int(11) DEFAULT NULL,
    \`serial\` varchar(255) DEFAULT NULL,
    \`qty\` int(11) DEFAULT '0',
    \`min_qty\` int(11) DEFAULT '0',
    \`location_id\` int(11) DEFAULT NULL,
    \`order_number\` varchar(255) DEFAULT NULL,
    \`purchase_date\` date DEFAULT NULL,
    \`purchase_cost\` decimal(10,2) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 18. component_assignments
  `CREATE TABLE IF NOT EXISTS \`component_assignments\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`component_id\` int(11) NOT NULL,
    \`asset_id\` int(11) DEFAULT NULL,
    \`qty\` int(11) DEFAULT '1',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 19. licenses
  `CREATE TABLE IF NOT EXISTS \`licenses\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`seats\` int(11) DEFAULT '1',
    \`manufacturer_id\` int(11) DEFAULT NULL,
    \`product_key\` text DEFAULT NULL,
    \`license_email\` varchar(255) DEFAULT NULL,
    \`license_name\` varchar(255) DEFAULT NULL,
    \`category_id\` int(11) DEFAULT NULL,
    \`supplier_id\` int(11) DEFAULT NULL,
    \`purchase_date\` date DEFAULT NULL,
    \`purchase_cost\` decimal(10,2) DEFAULT NULL,
    \`order_number\` varchar(255) DEFAULT NULL,
    \`expiration_date\` date DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 20. license_assignments
  `CREATE TABLE IF NOT EXISTS \`license_assignments\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`license_id\` int(11) NOT NULL,
    \`user_id\` int(11) DEFAULT NULL,
    \`asset_id\` int(11) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 21. tickets
  `CREATE TABLE IF NOT EXISTS \`tickets\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`subject\` varchar(255) NOT NULL,
    \`description\` text DEFAULT NULL,
    \`priority\` varchar(50) DEFAULT 'medium',
    \`status_name\` varchar(50) DEFAULT 'open',
    \`asset_id\` int(11) DEFAULT NULL,
    \`user_id\` int(11) DEFAULT NULL,
    \`assigned_to_user_id\` int(11) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 22. ticket_issues
  `CREATE TABLE IF NOT EXISTS \`ticket_issues\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 23. scrapsales
  `CREATE TABLE IF NOT EXISTS \`scrapsales\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`asset_id\` int(11) NOT NULL,
    \`price\` decimal(10,2) NOT NULL,
    \`date\` date DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 24. audits
  `CREATE TABLE IF NOT EXISTS \`audits\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`asset_id\` int(11) NOT NULL,
    \`title\` varchar(255) DEFAULT NULL,
    \`last_audit_date\` date DEFAULT NULL,
    \`next_audit_date\` date DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 25. action_logs
  `CREATE TABLE IF NOT EXISTS \`action_logs\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`user_id\` int(11) DEFAULT NULL,
    \`action_type\` varchar(50) NOT NULL,
    \`target_type\` varchar(50) NOT NULL,
    \`target_id\` int(11) DEFAULT NULL,
    \`details\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 26. shorturls
  `CREATE TABLE IF NOT EXISTS \`shorturls\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`long_url\` text NOT NULL,
    \`short_code\` varchar(50) NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`short_code\` (\`short_code\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 27. talent_groups
  `CREATE TABLE IF NOT EXISTS \`talent_groups\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`description\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 28. settings
  `CREATE TABLE IF NOT EXISTS \`settings\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`setting_key\` varchar(255) NOT NULL,
    \`setting_value\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`setting_key\` (\`setting_key\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 29. agent_telemetry_assets
  `CREATE TABLE IF NOT EXISTS \`agent_telemetry_assets\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`hostname\` varchar(255) DEFAULT NULL,
    \`serial\` varchar(255) DEFAULT NULL,
    \`cpu\` varchar(255) DEFAULT NULL,
    \`ram\` varchar(50) DEFAULT NULL,
    \`disk\` varchar(50) DEFAULT NULL,
    \`motherboard\` varchar(255) DEFAULT NULL,
    \`manufacturer\` varchar(255) DEFAULT NULL,
    \`model\` varchar(255) DEFAULT NULL,
    \`mac_address\` varchar(50) DEFAULT NULL,
    \`ip_address\` varchar(50) DEFAULT NULL,
    \`logged_user\` varchar(255) DEFAULT NULL,
    \`status\` varchar(50) DEFAULT 'pending',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // 30. maintenances
  `CREATE TABLE IF NOT EXISTS \`maintenances\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`asset_id\` int(11) DEFAULT NULL,
    \`supplier_id\` int(11) DEFAULT NULL,
    \`asset_maintenance_type\` varchar(255) DEFAULT NULL,
    \`title\` varchar(255) DEFAULT NULL,
    \`start_date\` date DEFAULT NULL,
    \`completion_date\` date DEFAULT NULL,
    \`is_warranty\` tinyint(4) DEFAULT '0',
    \`cost\` decimal(10,2) DEFAULT NULL,
    \`notes\` text DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
];

module.exports = { SCHEMAS };
