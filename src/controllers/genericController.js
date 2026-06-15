const { getPool } = require('../config/db');

const softDeleteTables = ['manufacturers', 'users', 'asset_models', 'hardware'];

const makeGenericController = (tableName, defaultSearchColumns = ['name']) => {
  // Get all with search, sorting, and pagination
  const getAll = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';
    let sort = req.query.sort || 'id';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const isDeletedQuery = req.query.deleted === 'true';

    // Sanitize sort column name
    if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) {
      sort = 'id';
    }

    try {
      const pool = await getPool();
      let queryParams = [];

      // Determine fields to SELECT based on table requirements
      let selectFields = '*';
      let joins = '';
      
      // Inject table specific subqueries for dashboard/list counts
      if (tableName === 'suppliers') {
        selectFields = `*, 
          (SELECT COUNT(*) FROM hardware WHERE supplier_id = suppliers.id AND deleted_at IS NULL) as assets_count,
          (SELECT COALESCE(SUM(qty), 0) FROM accessories WHERE supplier_id = suppliers.id) as accessories_count,
          (SELECT COUNT(*) FROM licenses WHERE supplier_id = suppliers.id) as licenses_count`;
      } else if (tableName === 'manufacturers') {
        selectFields = `*, 
          (SELECT COUNT(*) FROM hardware WHERE model_id IN (SELECT id FROM asset_models WHERE manufacturer_id = manufacturers.id) AND deleted_at IS NULL) as assets_count,
          (SELECT COUNT(*) FROM licenses WHERE manufacturer_id = manufacturers.id) as licenses_count,
          (SELECT COALESCE(SUM(qty), 0) FROM consumables WHERE manufacturer_id = manufacturers.id) as consumables_count,
          (SELECT COALESCE(SUM(qty), 0) FROM accessories WHERE manufacturer_id = manufacturers.id) as accessories_count`;
      } else if (tableName === 'companies') {
        selectFields = `*, 
          (SELECT COUNT(*) FROM hardware WHERE company_id = companies.id AND deleted_at IS NULL) as assets_count,
          (SELECT COUNT(*) FROM users WHERE company_id = companies.id AND deleted_at IS NULL) as users_count`;
      } else if (tableName === 'locations') {
        selectFields = `*, 
          (SELECT COUNT(*) FROM hardware WHERE rtd_location_id = locations.id AND deleted_at IS NULL) as assets_count,
          (SELECT COUNT(*) FROM hardware WHERE assigned_to = locations.id AND checkout_to_type = 'location' AND deleted_at IS NULL) as assigned_assets_count`;
      } else if (tableName === 'departments') {
        selectFields = `departments.*, 
          c.name as company_name, 
          l.name as location_name, 
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as manager_name`;
        joins = ` LEFT JOIN companies c ON departments.company_id = c.id
                  LEFT JOIN locations l ON departments.location_id = l.id
                  LEFT JOIN users u ON departments.manager_id = u.id`;
      } else if (tableName === 'asset_models') {
        selectFields = `asset_models.*, 
          c.name as category_name, 
          man.name as manufacturer_name, 
          dep.name as depreciation_name,
          (SELECT COUNT(*) FROM hardware WHERE model_id = asset_models.id AND deleted_at IS NULL) as assets_count`;
        joins = ` LEFT JOIN categories c ON asset_models.category_id = c.id
                  LEFT JOIN manufacturers man ON asset_models.manufacturer_id = man.id
                  LEFT JOIN depreciations dep ON asset_models.depreciation_id = dep.id`;
      } else if (tableName === 'users') {
        selectFields = `users.*, 
          c.name as company_name, 
          l.name as location_name, 
          d.name as department_name, 
          g.name as group_name,
          (SELECT COUNT(*) FROM hardware WHERE assigned_to = users.id AND checkout_to_type = 'user' AND deleted_at IS NULL) as assets_count`;
        joins = ` LEFT JOIN companies c ON users.company_id = c.id
                  LEFT JOIN locations l ON users.location_id = l.id
                  LEFT JOIN departments d ON users.department_id = d.id
                  LEFT JOIN \`groups\` g ON users.group_id = g.id`;
      } else if (tableName === 'categories') {
        selectFields = `categories.*,
          (SELECT COUNT(*) FROM hardware WHERE model_id IN (SELECT id FROM asset_models WHERE category_id = categories.id) AND deleted_at IS NULL) as assets_count,
          (SELECT COALESCE(SUM(qty), 0) FROM accessories WHERE category_id = categories.id) as accessories_count,
          (SELECT COUNT(*) FROM licenses WHERE category_id = categories.id) as licenses_count,
          (SELECT COALESCE(SUM(qty), 0) FROM consumables WHERE category_id = categories.id) as consumables_count,
          (SELECT COALESCE(SUM(qty), 0) FROM components WHERE category_id = categories.id) as components_count`;
      }

      // Base query building
      let whereClause = ' WHERE 1=1';

      // Soft deletes handling
      if (softDeleteTables.includes(tableName)) {
        if (isDeletedQuery) {
          whereClause += ` AND ${tableName}.deleted_at IS NOT NULL`;
        } else {
          whereClause += ` AND ${tableName}.deleted_at IS NULL`;
        }
      }

      // Search filters
      if (search) {
        const searchTerms = defaultSearchColumns.map(col => `${tableName}.${col} LIKE ?`).join(' OR ');
        whereClause += ` AND (${searchTerms})`;
        defaultSearchColumns.forEach(() => {
          queryParams.push(`%${search}%`);
        });
      }

      // Query total record count
      const countSql = `SELECT COUNT(*) as total FROM \`${tableName}\` ${joins} ${whereClause}`;
      const [countResult] = await pool.query(countSql, queryParams);
      const total = countResult[0].total;

      // Query paginated rows
      const rowsSql = `SELECT ${selectFields} FROM \`${tableName}\` ${joins} ${whereClause} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
      const [rows] = await pool.query(rowsSql, [...queryParams, limit, offset]);

      // Append permissions metadata if client checks available actions
      const rowsWithActions = rows.map(row => ({
        ...row,
        available_actions: {
          update: true,
          delete: true
        }
      }));

      return res.status(200).json({
        success: true,
        rows: rowsWithActions,
        total: total
      });

    } catch (error) {
      console.error(`Error in getAll for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database query error' });
    }
  };

  // Get selectList structure { id, text }
  const getSelectList = async (req, res) => {
    try {
      const pool = await getPool();
      let sql = '';
      
      // Determine columns to select and alias to 'text'
      if (tableName === 'users') {
        sql = `SELECT id, CONCAT(first_name, ' ', COALESCE(last_name, '')) as text FROM users WHERE deleted_at IS NULL ORDER BY first_name ASC`;
      } else if (tableName === 'asset_models') {
        sql = `SELECT id, name as text FROM asset_models WHERE deleted_at IS NULL ORDER BY name ASC`;
      } else if (tableName === 'suppliers') {
        sql = `SELECT id, name as text FROM suppliers ORDER BY name ASC`;
      } else if (tableName === 'manufacturers') {
        sql = `SELECT id, name as text FROM manufacturers WHERE deleted_at IS NULL ORDER BY name ASC`;
      } else if (tableName === 'categories') {
        // filter category list by category_type if specified in query
        const type = req.query.category_type;
        if (type) {
          sql = `SELECT id, name as text FROM categories WHERE category_type = ${pool.escape(type)} ORDER BY name ASC`;
        } else {
          sql = `SELECT id, name as text FROM categories ORDER BY name ASC`;
        }
      } else {
        sql = `SELECT id, name as text FROM \`${tableName}\` ORDER BY name ASC`;
      }

      const [rows] = await pool.query(sql);
      return res.status(200).json({
        success: true,
        items: rows
      });
    } catch (error) {
      console.error(`Error in getSelectList for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database selectList error' });
    }
  };

  // Get single record details
  const getById = async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await getPool();
      let sql = `SELECT * FROM \`${tableName}\` WHERE id = ?`;
      
      // Include joines if details need nested data
      if (tableName === 'departments') {
        sql = `SELECT departments.*, 
               c.name as company_name, 
               l.name as location_name, 
               CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as manager_name
               FROM departments
               LEFT JOIN companies c ON departments.company_id = c.id
               LEFT JOIN locations l ON departments.location_id = l.id
               LEFT JOIN users u ON departments.manager_id = u.id
               WHERE departments.id = ?`;
      } else if (tableName === 'asset_models') {
        sql = `SELECT asset_models.*, 
               c.name as category_name, 
               man.name as manufacturer_name, 
               dep.name as depreciation_name
               FROM asset_models
               LEFT JOIN categories c ON asset_models.category_id = c.id
               LEFT JOIN manufacturers man ON asset_models.manufacturer_id = man.id
               LEFT JOIN depreciations dep ON asset_models.depreciation_id = dep.id
               WHERE asset_models.id = ?`;
      } else if (tableName === 'users') {
        sql = `SELECT users.*, 
               c.name as company_name, 
               l.name as location_name, 
               d.name as department_name, 
               g.name as group_name
               FROM users
               LEFT JOIN companies c ON users.company_id = c.id
               LEFT JOIN locations l ON users.location_id = l.id
               LEFT JOIN departments d ON users.department_id = d.id
               LEFT JOIN \`groups\` g ON users.group_id = g.id
               WHERE users.id = ?`;
      }

      const [rows] = await pool.query(sql, [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }

      // Return company and location as child objects if detail expects them
      let record = rows[0];
      if (tableName === 'users') {
        record.company = record.company_id ? { id: record.company_id, name: record.company_name } : null;
        record.location = record.location_id ? { id: record.location_id, name: record.location_name } : null;
        record.department = record.department_id ? { id: record.department_id, name: record.department_name } : null;
      }

      return res.status(200).json(record);
    } catch (error) {
      console.error(`Error in getById for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database fetch error' });
    }
  };

  // Create record
  const create = async (req, res) => {
    const data = req.body;
    try {
      const pool = await getPool();
      
      // If table is groups, stringify permissions array/object if sent
      if (tableName === 'groups' && data.permissions) {
        data.permissions = typeof data.permissions === 'object' ? JSON.stringify(data.permissions) : data.permissions;
      }

      // If table is users, bcrypt hash password
      if (tableName === 'users' && data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }

      const columns = Object.keys(data).map(key => `\`${key}\``).join(', ');
      const valuesPlaceholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);

      const sql = `INSERT INTO \`${tableName}\` (${columns}) VALUES (${valuesPlaceholders})`;
      const [result] = await pool.query(sql, values);

      // Log action
      await pool.query(
        'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user?.userId || 1, 'create', tableName, result.insertId, `Created new record in ${tableName}`]
      );

      return res.status(201).json({
        success: true,
        message: 'Record created successfully',
        id: result.insertId
      });
    } catch (error) {
      console.error(`Error in create for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database insert error', error: error.message });
    }
  };

  // Update record
  const update = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
      const pool = await getPool();

      // Check if user is changing password, bcrypt hash it
      if (tableName === 'users' && data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      } else if (tableName === 'users') {
        delete data.password; // Do not overwrite with blank
      }

      // If table is groups, stringify permissions
      if (tableName === 'groups' && data.permissions) {
        data.permissions = typeof data.permissions === 'object' ? JSON.stringify(data.permissions) : data.permissions;
      }

      const updates = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
      const values = Object.values(data);

      const sql = `UPDATE \`${tableName}\` SET ${updates} WHERE id = ?`;
      await pool.query(sql, [...values, id]);

      // Log action
      await pool.query(
        'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user?.userId || 1, 'update', tableName, id, `Updated record ID ${id} in ${tableName}`]
      );

      return res.status(200).json({
        success: true,
        message: 'Record updated successfully'
      });
    } catch (error) {
      console.error(`Error in update for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database update error', error: error.message });
    }
  };

  // Delete record (supporting soft delete if listed)
  const remove = async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await getPool();
      let sql = '';
      
      if (softDeleteTables.includes(tableName)) {
        sql = `UPDATE \`${tableName}\` SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`;
      } else {
        sql = `DELETE FROM \`${tableName}\` WHERE id = ?`;
      }

      await pool.query(sql, [id]);

      // Log action
      await pool.query(
        'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user?.userId || 1, 'delete', tableName, id, `Deleted record ID ${id} in ${tableName}`]
      );

      return res.status(200).json({
        success: true,
        message: 'Record deleted successfully'
      });
    } catch (error) {
      console.error(`Error in remove for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database delete error', error: error.message });
    }
  };

  // Restore soft deleted record
  const restore = async (req, res) => {
    const { id } = req.params;
    if (!softDeleteTables.includes(tableName)) {
      return res.status(400).json({ success: false, message: 'Entity does not support restore operation' });
    }

    try {
      const pool = await getPool();
      const sql = `UPDATE \`${tableName}\` SET deleted_at = NULL WHERE id = ?`;
      await pool.query(sql, [id]);

      // Log action
      await pool.query(
        'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user?.userId || 1, 'restore', tableName, id, `Restored record ID ${id} in ${tableName}`]
      );

      return res.status(200).json({
        success: true,
        message: 'Record restored successfully'
      });
    } catch (error) {
      console.error(`Error in restore for table ${tableName}:`, error);
      return res.status(500).json({ success: false, message: 'Database restore error', error: error.message });
    }
  };

  return {
    getAll,
    getSelectList,
    getById,
    create,
    update,
    remove,
    restore
  };
};

module.exports = { makeGenericController };
