const { getPool } = require('../config/db');
const xlsx = require('xlsx');
const fs = require('fs');

const formatDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

// GET /hardware - List assets with sorting, pagination, and filters
const getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  // Filters
  const supplier_id = req.query.supplier_id;
  const manufacturer_id = req.query.manufacturer_id;
  const company_id = req.query.company_id;
  const location_id = req.query.location_id;
  const assigned_to = req.query.assigned_to;
  const checkout_to_type = req.query.checkout_to_type;
  const status_id = req.query.status_id;
  const model_id = req.query.model_id;
  const isDeletedQuery = req.query.deleted === 'true';

  if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) {
    sort = 'id';
  }

  // Map sort fields if needed (e.g. "model" to "model_name")
  if (sort === 'model') sort = 'model_name';
  if (sort === 'status_label') sort = 'status_name';
  if (sort === 'location') sort = 'location_name';
  if (sort === 'company') sort = 'company_name';
  if (sort === 'supplier') sort = 'supplier_name';

  try {
    const pool = await getPool();
    let queryParams = [];
    let whereClause = ' WHERE h.deleted_at ' + (isDeletedQuery ? 'IS NOT NULL' : 'IS NULL');

    // Apply filters
    if (supplier_id) {
      whereClause += ' AND h.supplier_id = ?';
      queryParams.push(supplier_id);
    }
    if (company_id) {
      whereClause += ' AND h.company_id = ?';
      queryParams.push(company_id);
    }
    if (location_id) {
      whereClause += ' AND (h.rtd_location_id = ? OR (h.assigned_to = ? AND h.checkout_to_type = \'location\'))';
      queryParams.push(location_id, location_id);
    }
    if (assigned_to) {
      whereClause += ' AND h.assigned_to = ?';
      queryParams.push(assigned_to);
    }
    if (checkout_to_type) {
      whereClause += ' AND h.checkout_to_type = ?';
      queryParams.push(checkout_to_type);
    }
    if (status_id) {
      whereClause += ' AND h.status_id = ?';
      queryParams.push(status_id);
    }
    if (model_id) {
      whereClause += ' AND h.model_id = ?';
      queryParams.push(model_id);
    }
    if (manufacturer_id) {
      whereClause += ' AND am.manufacturer_id = ?';
      queryParams.push(manufacturer_id);
    }

    if (search) {
      whereClause += ' AND (h.name LIKE ? OR h.serial LIKE ? OR h.asset_tag LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Specific Route Filters based on path (e.g. deployable, deployed, undeployable)
    const requestPath = req.path;
    if (requestPath.includes('/rtd') || req.query.status_type === 'deployable') {
      whereClause += ' AND h.assigned_to IS NULL AND sl.type = \'deployable\'';
    } else if (requestPath.includes('/deployed') || req.query.status_type === 'deployed') {
      whereClause += ' AND h.assigned_to IS NOT NULL';
    } else if (requestPath.includes('/undeployable') || req.query.status_type === 'undeployable') {
      whereClause += ' AND sl.type != \'deployable\'';
    }

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total 
      FROM hardware h
      LEFT JOIN asset_models am ON h.model_id = am.id
      LEFT JOIN status_labels sl ON h.status_id = sl.id
      ${whereClause}`;
    const [countResult] = await pool.query(countSql, queryParams);
    const total = countResult[0].total;

    // Get rows
    const rowsSql = `
      SELECT h.*, 
             am.name as model_name, am.id as model_id,
             cat.name as category_name, cat.id as category_id,
             c.name as company_name, c.id as company_id,
             s.name as supplier_name, s.id as supplier_id,
             l.name as location_name, l.id as location_id,
             sl.name as status_name, sl.id as status_id, sl.type as status_type,
             d.name as depreciation_name, d.id as depreciation_id,
             CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as assigned_user_name,
             l_assigned.name as assigned_location_name,
             u_loc.name as user_location_name, u_loc.id as user_location_id
      FROM hardware h
      LEFT JOIN asset_models am ON h.model_id = am.id
      LEFT JOIN categories cat ON am.category_id = cat.id
      LEFT JOIN companies c ON h.company_id = c.id
      LEFT JOIN suppliers s ON h.supplier_id = s.id
      LEFT JOIN locations l ON h.rtd_location_id = l.id
      LEFT JOIN status_labels sl ON h.status_id = sl.id
      LEFT JOIN depreciations d ON h.depreciation_id = d.id
      LEFT JOIN users u ON h.assigned_to = u.id AND h.checkout_to_type = 'user'
      LEFT JOIN locations l_assigned ON h.assigned_to = l_assigned.id AND h.checkout_to_type = 'location'
      LEFT JOIN locations u_loc ON u.location_id = u_loc.id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(rowsSql, [...queryParams, limit, offset]);

    // Format fields to nested objects matching React fields expectation
    const formattedRows = rows.map(row => {
      let assignedToText = null;
      if (row.checkout_to_type === 'user') {
        assignedToText = row.assigned_user_name;
      } else if (row.checkout_to_type === 'location') {
        assignedToText = row.assigned_location_name;
      }

      let assignedToObj = null;
      if (row.assigned_to) {
        assignedToObj = {
          id: row.assigned_to,
          name: row.checkout_to_type === 'user' ? row.assigned_user_name : row.assigned_location_name
        };
      }

      let currentLocationObj = null;
      if (row.checkout_to_type === 'location') {
        currentLocationObj = { id: row.assigned_to, name: row.assigned_location_name };
      } else if (row.checkout_to_type === 'user') {
        currentLocationObj = row.user_location_id ? { id: row.user_location_id, name: row.user_location_name } : null;
      } else {
        currentLocationObj = row.location_id ? { id: row.location_id, name: row.location_name } : null;
      }

      const purchaseCost = row.purchase_cost ? parseFloat(row.purchase_cost) : 0;
      const gst = row.gst ? parseFloat(row.gst) : 0;
      let excluding_tax = row.purchase_cost || '0.00';
      let tax_value = '0.00';

      if (purchaseCost > 0 && gst > 0) {
        const excl = purchaseCost / (1 + gst / 100);
        excluding_tax = excl.toFixed(2);
        tax_value = (purchaseCost - excl).toFixed(2);
      }

      return {
        ...row,
        company: row.company_id ? { id: row.company_id, name: row.company_name } : null,
        model: row.model_id ? { id: row.model_id, name: row.model_name } : null,
        category: row.category_id ? { id: row.category_id, name: row.category_name } : null,
        supplier: row.supplier_id ? { id: row.supplier_id, name: row.supplier_name } : null,
        rtd_location: row.location_id ? { id: row.location_id, name: row.location_name } : null,
        location: currentLocationObj,
        assigned_to: assignedToObj,
        status_label: row.status_id ? { id: row.status_id, name: row.status_name } : null,
        depreciation: row.depreciation_id ? { id: row.depreciation_id, name: row.depreciation_name } : null,
        purchase_date: row.purchase_date ? { date: formatDate(row.purchase_date) } : null,
        assigned_to_user: assignedToText,
        tax_value: tax_value,
        excluding_tax: excluding_tax,
        available_actions: {
          update: true,
          delete: true
        }
      };
    });

    return res.status(200).json({
      success: true,
      rows: formattedRows,
      total: total
    });

  } catch (error) {
    console.error('Error fetching hardware list:', error);
    return res.status(500).json({ success: false, message: 'Database list error' });
  }
};

// GET /hardware/:id - Single asset detail
const getById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const sql = `
      SELECT h.*, 
             am.name as model_name, am.id as model_id,
             cat.name as category_name, cat.id as category_id,
             c.name as company_name, c.id as company_id,
             s.name as supplier_name, s.id as supplier_id,
             l.name as location_name, l.id as location_id,
             sl.name as status_name, sl.id as status_id, sl.type as status_type,
             dep.name as depreciation_name, dep.id as depreciation_id,
             dep.residual_value as depreciation_residual,
             CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as assigned_user_name,
             l_assigned.name as assigned_location_name,
             u_loc.name as user_location_name, u_loc.id as user_location_id
      FROM hardware h
      LEFT JOIN asset_models am ON h.model_id = am.id
      LEFT JOIN categories cat ON am.category_id = cat.id
      LEFT JOIN companies c ON h.company_id = c.id
      LEFT JOIN suppliers s ON h.supplier_id = s.id
      LEFT JOIN locations l ON h.rtd_location_id = l.id
      LEFT JOIN status_labels sl ON h.status_id = sl.id
      LEFT JOIN depreciations dep ON h.depreciation_id = dep.id
      LEFT JOIN users u ON h.assigned_to = u.id AND h.checkout_to_type = 'user'
      LEFT JOIN locations l_assigned ON h.assigned_to = l_assigned.id AND h.checkout_to_type = 'location'
      LEFT JOIN locations u_loc ON u.location_id = u_loc.id
      WHERE h.id = ? AND h.deleted_at IS NULL`;

    const [rows] = await pool.query(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const row = rows[0];
    
    let assignedToObj = null;
    if (row.assigned_to) {
      assignedToObj = {
        id: row.assigned_to,
        name: row.checkout_to_type === 'user' ? row.assigned_user_name : row.assigned_location_name
      };
    }

    let currentLocationObj = null;
    if (row.checkout_to_type === 'location') {
      currentLocationObj = { id: row.assigned_to, name: row.assigned_location_name };
    } else if (row.checkout_to_type === 'user') {
      currentLocationObj = row.user_location_id ? { id: row.user_location_id, name: row.user_location_name } : null;
    } else {
      currentLocationObj = row.location_id ? { id: row.location_id, name: row.location_name } : null;
    }

    const purchaseCost = row.purchase_cost ? parseFloat(row.purchase_cost) : 0;
    const gst = row.gst ? parseFloat(row.gst) : 0;
    let excluding_tax = row.purchase_cost || '0.00';
    let tax_value = '0.00';

    if (purchaseCost > 0 && gst > 0) {
      const excl = purchaseCost / (1 + gst / 100);
      excluding_tax = excl.toFixed(2);
      tax_value = (purchaseCost - excl).toFixed(2);
    }

    const asset = {
      ...row,
      company: row.company_id ? { id: row.company_id, name: row.company_name } : null,
      model: row.model_id ? { id: row.model_id, name: row.model_name } : null,
      category: row.category_id ? { id: row.category_id, name: row.category_name } : null,
      supplier: row.supplier_id ? { id: row.supplier_id, name: row.supplier_name } : null,
      rtd_location: row.location_id ? { id: row.location_id, name: row.location_name } : null,
      location: currentLocationObj,
      assigned_to: assignedToObj,
      status_label: row.status_id ? { id: row.status_id, name: row.status_name } : null,
      depreciation: row.depreciation_id ? { id: row.depreciation_id, name: row.depreciation_name, residual_value: row.depreciation_residual } : null,
      purchase_date: row.purchase_date ? { date: formatDate(row.purchase_date) } : null,
      GST: row.gst,
      tax_value: tax_value,
      excluding_tax: excluding_tax,
      available_actions: { update: true, delete: true }
    };

    return res.status(200).json(asset);
  } catch (error) {
    console.error('Error fetching hardware by id:', error);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

// GET /hardware/selectList - Select dropdown list
const getSelectList = async (req, res) => {
  try {
    const pool = await getPool();
    const sql = `SELECT id, name as text FROM hardware WHERE deleted_at IS NULL ORDER BY name ASC`;
    const [rows] = await pool.query(sql);
    return res.status(200).json({
      success: true,
      items: rows
    });
  } catch (error) {
    console.error('Error fetching hardware selectList:', error);
    return res.status(500).json({ success: false, message: 'Database selectList error' });
  }
};

// POST /hardware - Create asset
const create = async (req, res) => {
  const data = req.body;
  const imageFile = req.file;

  try {
    const pool = await getPool();

    // Map body inputs from client
    const asset = {
      name: data.name,
      serial: data.serial,
      model_id: data.model_id ? parseInt(data.model_id) : null,
      company_id: data.company_id ? parseInt(data.company_id) : null,
      status_id: data.status_id ? parseInt(data.status_id) : null,
      rtd_location_id: data.rtd_location_id ? parseInt(data.rtd_location_id) : null,
      supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
      purchase_date: data.purchase_date || null,
      purchase_cost: data.purchase_cost ? parseFloat(data.purchase_cost) : null,
      warranty_months: data.warranty_months ? parseInt(data.warranty_months) : null,
      depreciation_id: data.depreciation_id ? parseInt(data.depreciation_id) : null,
      notes: data.notes || '',
      requestable: data.requestable === '0' ? 0 : 1,
      gst: data.gst ? parseFloat(data.gst) : null,
      order_number: data.order_number || '',
      asset_tag: data.asset_tag || `TAG-${Math.floor(100000 + Math.random() * 900000)}`,
      image: imageFile ? `uploads/${imageFile.filename}` : null
    };

    const columns = Object.keys(asset).map(key => `\`${key}\``).join(', ');
    const placeholders = Object.keys(asset).map(() => '?').join(', ');
    const values = Object.values(asset);

    const [result] = await pool.query(
      `INSERT INTO hardware (${columns}) VALUES (${placeholders})`,
      values
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'create', 'hardware', result.insertId, `Created asset tag: ${asset.asset_tag}`]
    );

    return res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      id: result.insertId
    });

  } catch (error) {
    console.error('Error creating hardware:', error);
    return res.status(500).json({ success: false, message: 'Database save error', error: error.message });
  }
};

// PUT /hardware/:id - Update asset
const update = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const imageFile = req.file;

  try {
    const pool = await getPool();

    const asset = {
      name: data.name,
      serial: data.serial,
      model_id: data.model_id ? parseInt(data.model_id) : null,
      company_id: data.company_id ? parseInt(data.company_id) : null,
      status_id: data.status_id ? parseInt(data.status_id) : null,
      rtd_location_id: data.rtd_location_id ? parseInt(data.rtd_location_id) : null,
      supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
      purchase_date: data.purchase_date || null,
      purchase_cost: data.purchase_cost ? parseFloat(data.purchase_cost) : null,
      warranty_months: data.warranty_months ? parseInt(data.warranty_months) : null,
      depreciation_id: data.depreciation_id ? parseInt(data.depreciation_id) : null,
      notes: data.notes || '',
      requestable: data.requestable === '0' ? 0 : 1,
      gst: data.gst ? parseFloat(data.gst) : null,
      order_number: data.order_number || ''
    };

    if (imageFile) {
      asset.image = `uploads/${imageFile.filename}`;
    }

    const updates = Object.keys(asset).map(key => `\`${key}\` = ?`).join(', ');
    const values = Object.values(asset);

    await pool.query(
      `UPDATE hardware SET ${updates} WHERE id = ?`,
      [...values, id]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'update', 'hardware', id, `Updated asset details`]
    );

    return res.status(200).json({
      success: true,
      message: 'Asset updated successfully'
    });

  } catch (error) {
    console.error('Error updating hardware:', error);
    return res.status(500).json({ success: false, message: 'Database update error', error: error.message });
  }
};

// DELETE /hardware/:id - Soft delete asset
const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.query('UPDATE hardware SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'delete', 'hardware', id, `Soft deleted asset`]
    );

    return res.status(200).json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting hardware:', error);
    return res.status(500).json({ success: false, message: 'Database delete error' });
  }
};

// PUT /hardware/restore/:id - Restore soft deleted asset
const restore = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.query('UPDATE hardware SET deleted_at = NULL WHERE id = ?', [id]);

    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'restore', 'hardware', id, `Restored soft deleted asset`]
    );

    return res.status(200).json({ success: true, message: 'Asset restored successfully' });
  } catch (error) {
    console.error('Error restoring hardware:', error);
    return res.status(500).json({ success: false, message: 'Database restore error' });
  }
};

// POST /hardware/:id/checkout - Checkout asset to user/location
const checkout = async (req, res) => {
  const { id } = req.params;
  const { checkout_to_type, assigned_user, assigned_location, notes } = req.body;

  try {
    const pool = await getPool();
    let assignedId = null;

    if (checkout_to_type === 'user') {
      assignedId = assigned_user;
    } else if (checkout_to_type === 'location') {
      assignedId = assigned_location;
    }

    if (!assignedId) {
      return res.status(200).json({ success: false, message: 'Checkout target ID is required' });
    }

    // Update hardware assignment columns
    await pool.query(
      'UPDATE hardware SET checkout_to_type = ?, assigned_to = ?, status_id = (SELECT id FROM status_labels WHERE type = \'deployable\' LIMIT 1) WHERE id = ?',
      [checkout_to_type, assignedId, id]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkout', 'hardware', id, `Checked out asset to ${checkout_to_type} ID: ${assignedId}. Notes: ${notes || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Asset checked out successfully' });

  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ success: false, message: 'Database checkout error' });
  }
};

// POST /hardware/:id/checkin - Checkin asset back to inventory
const checkin = async (req, res) => {
  const { id } = req.params;
  const { status_id, assigned_location, note } = req.body;

  try {
    const pool = await getPool();

    // Checkin resets assignment fields and sets the location and status
    await pool.query(
      'UPDATE hardware SET checkout_to_type = NULL, assigned_to = NULL, rtd_location_id = ?, status_id = ? WHERE id = ?',
      [assigned_location || null, status_id || 1, id]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkin', 'hardware', id, `Checked in asset back. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Asset checked in successfully' });

  } catch (error) {
    console.error('Checkin error:', error);
    return res.status(500).json({ success: false, message: 'Database checkin error' });
  }
};

// POST /hardware/bulkcheckout - Checkout multiple assets at once
const bulkCheckout = async (req, res) => {
  const { checkout_to_type, assigned_user, assigned_location, selected_assets, note } = req.body;

  if (!selected_assets || !Array.isArray(selected_assets) || selected_assets.length === 0) {
    return res.status(200).json({ success: false, message: 'At least one asset must be selected' });
  }

  let assignedId = checkout_to_type === 'user' ? assigned_user : assigned_location;
  if (!assignedId) {
    return res.status(200).json({ success: false, message: 'Checkout target ID is required' });
  }

  try {
    const pool = await getPool();

    for (const assetId of selected_assets) {
      await pool.query(
        'UPDATE hardware SET checkout_to_type = ?, assigned_to = ?, status_id = (SELECT id FROM status_labels WHERE type = \'deployable\' LIMIT 1) WHERE id = ?',
        [checkout_to_type, assignedId, assetId]
      );

      await pool.query(
        'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user?.userId || 1, 'checkout', 'hardware', assetId, `Bulk checkout to ${checkout_to_type} ID: ${assignedId}. Notes: ${note || ''}`]
      );
    }

    return res.status(200).json({ success: true, message: 'Assets checked out successfully' });

  } catch (error) {
    console.error('Bulk checkout error:', error);
    return res.status(500).json({ success: false, message: 'Database bulk checkout error' });
  }
};

// GET /hardware/pending-agent - List pending agent scans
const getPendingAgentAssets = async (req, res) => {
  const search = req.query.search || '';
  try {
    const pool = await getPool();
    let query = 'SELECT * FROM agent_telemetry_assets WHERE status = \'pending\'';
    let params = [];

    if (search) {
      query += ' AND (hostname LIKE ? OR serial LIKE ? OR manufacturer LIKE ? OR model LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(query, params);
    
    // Add custom timestamp alias
    const formattedRows = rows.map(r => ({
      ...r,
      timestamp: formatDate(r.created_at) + ' ' + new Date(r.created_at).toTimeString().split(' ')[0]
    }));

    return res.status(200).json({
      success: true,
      rows: formattedRows,
      total: formattedRows.length
    });
  } catch (error) {
    console.error('Error fetching pending agent assets:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// POST /hardware/approve-agent - Map and approve agent asset
const approveAgentAsset = async (req, res) => {
  const { id, name, serial, company_id, location_id, manufacturer_id, model_id, status_id, asset_tag, notes } = req.body;

  try {
    const pool = await getPool();

    // 1. Insert into active hardware
    const asset = {
      name,
      serial,
      model_id,
      company_id,
      status_id,
      rtd_location_id: location_id,
      asset_tag,
      notes,
      requestable: 1
    };

    const columns = Object.keys(asset).map(key => `\`${key}\``).join(', ');
    const placeholders = Object.keys(asset).map(() => '?').join(', ');
    const values = Object.values(asset);

    const [result] = await pool.query(
      `INSERT INTO hardware (${columns}) VALUES (${placeholders})`,
      values
    );

    // 2. Mark agent record as approved
    await pool.query(
      'UPDATE agent_telemetry_assets SET status = \'approved\' WHERE id = ?',
      [id]
    );

    // 3. Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'create', 'hardware', result.insertId, `Approved and ingested agent device hostname ${name}. Asset tag: ${asset_tag}`]
    );

    return res.status(200).json({ success: true, message: 'Asset approved and ingested successfully' });

  } catch (error) {
    console.error('Approve agent asset error:', error);
    return res.status(500).json({ success: false, message: 'Database approval error' });
  }
};

// DELETE /hardware/pending-agent/:id - Reject pending agent scan
const rejectAgentAsset = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.query('DELETE FROM agent_telemetry_assets WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Agent telemetry report discarded' });
  } catch (error) {
    console.error('Reject agent asset error:', error);
    return res.status(500).json({ success: false, message: 'Database delete error' });
  }
};

// POST /hardware/agent-import - Remote Telemetry scan endpoint
const agentImportTelemetry = async (req, res) => {
  const { hostname, serial, cpu, ram, disk, motherboard, manufacturer, model, mac_address, ip_address, logged_user } = req.body;
  
  try {
    const pool = await getPool();

    // Check if report with same serial already exists in pending
    const [existing] = await pool.query(
      'SELECT id FROM agent_telemetry_assets WHERE serial = ? AND status = \'pending\'',
      [serial]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE agent_telemetry_assets 
         SET hostname = ?, cpu = ?, ram = ?, disk = ?, motherboard = ?, manufacturer = ?, model = ?, mac_address = ?, ip_address = ?, logged_user = ?, created_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [hostname, cpu, ram, disk, motherboard, manufacturer, model, mac_address, ip_address, logged_user, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO agent_telemetry_assets 
         (hostname, serial, cpu, ram, disk, motherboard, manufacturer, model, mac_address, ip_address, logged_user, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [hostname, serial, cpu, ram, disk, motherboard, manufacturer, model, mac_address, ip_address, logged_user]
      );
    }

    return res.status(200).json({ success: true, message: 'Telemetry report received and queued for admin review' });

  } catch (error) {
    console.error('Agent telemetry ingestion error:', error);
    return res.status(500).json({ success: false, message: 'Telemetry ingestion failed' });
  }
};

// POST /hardware/bulk-upload - Parse and upload bulk assets in Excel
const bulkUpload = async (req, res) => {
  if (!req.file) {
    return res.status(200).json({ success: false, message: 'Please upload a file.' });
  }

  try {
    const pool = await getPool();

    // Read sheet buffer or file
    const fileSource = req.file.buffer || req.file.path;
    const readOptions = req.file.buffer ? { type: 'buffer', cellDates: true } : { type: 'file', cellDates: true };
    const workbook = xlsx.read(fileSource, readOptions);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(200).json({ success: false, message: 'The uploaded file contains no data.' });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Helper functions to find/create IDs for related entities
    const getCompanyId = async (name) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM companies WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      const [result] = await pool.query('INSERT INTO companies (name) VALUES (?)', [name]);
      return result.insertId;
    };

    const getCategoryId = async (name) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM categories WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      const [result] = await pool.query('INSERT INTO categories (name, category_type) VALUES (?, ?)', [name, 'asset']);
      return result.insertId;
    };

    const getManufacturerId = async (name) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM manufacturers WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      const [result] = await pool.query('INSERT INTO manufacturers (name) VALUES (?)', [name]);
      return result.insertId;
    };

    const getModelId = async (name, categoryId) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM asset_models WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      
      const mfgId = await getManufacturerId('Generic');
      const [result] = await pool.query(
        'INSERT INTO asset_models (name, manufacturer_id, category_id) VALUES (?, ?, ?)',
        [name, mfgId, categoryId]
      );
      return result.insertId;
    };

    const getStatusId = async (name) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM status_labels WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      const [result] = await pool.query('INSERT INTO status_labels (name, type) VALUES (?, ?)', [name, 'deployable']);
      return result.insertId;
    };

    const getLocationId = async (name) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM locations WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      const [result] = await pool.query('INSERT INTO locations (name) VALUES (?)', [name]);
      return result.insertId;
    };

    const getSupplierId = async (name) => {
      if (!name) return null;
      const [rows] = await pool.query('SELECT id FROM suppliers WHERE name = ?', [name]);
      if (rows.length > 0) return rows[0].id;
      const [result] = await pool.query('INSERT INTO suppliers (name) VALUES (?)', [name]);
      return result.insertId;
    };

    // Iterate through Excel rows and insert
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row['Asset Name'] || row['name'] || row['Name'];
      const assetTag = row['Asset Tag'] || row['asset_tag'] || row['Tag'] || `TAG-${Math.floor(100000 + Math.random() * 900000)}`;
      const serial = row['Serial'] || row['serial'] || row['Serial Number'] || '';
      
      const categoryName = row['Category'] || row['category'] || row['Category Name'] || 'Laptops';
      const modelName = row['Model'] || row['model'] || row['Model Name'] || 'Generic Device';
      const statusName = row['Status'] || row['status'] || row['Status Label'] || 'Ready to Deploy';
      const companyName = row['Company'] || row['company'] || row['Company Name'] || 'Maphy Corp';
      const locationName = row['Location'] || row['location'] || row['Location Name'] || null;
      const supplierName = row['Supplier'] || row['supplier'] || row['Supplier Name'] || null;
      
      const purchaseDateVal = row['Purchase Date'] || row['purchase_date'] || null;
      const purchaseDate = formatDate(purchaseDateVal);
      
      const purchaseCostVal = row['Purchase Cost'] || row['purchase_cost'] || null;
      const purchaseCost = purchaseCostVal ? parseFloat(purchaseCostVal) : null;
      
      const warrantyMonthsVal = row['Warranty Months'] || row['warranty_months'] || null;
      const warrantyMonths = warrantyMonthsVal ? parseInt(warrantyMonthsVal) : null;
      
      const notes = row['Notes'] || row['notes'] || '';
      
      const gstVal = row['GST'] || row['gst'] || null;
      const gst = gstVal ? parseFloat(gstVal) : null;
      
      const orderNumber = row['Order Number'] || row['order_number'] || '';

      if (!name) {
        errorCount++;
        errors.push(`Row ${i + 2}: Asset name is required.`);
        continue;
      }

      try {
        // Check duplicate asset tag
        const [existing] = await pool.query('SELECT id FROM hardware WHERE asset_tag = ? AND deleted_at IS NULL', [assetTag]);
        if (existing.length > 0) {
          errorCount++;
          errors.push(`Row ${i + 2}: Duplicate asset tag "${assetTag}"`);
          continue;
        }

        // Resolve IDs
        const companyId = await getCompanyId(companyName);
        const categoryId = await getCategoryId(categoryName);
        const modelId = await getModelId(modelName, categoryId);
        const statusId = await getStatusId(statusName);
        const locationId = await getLocationId(locationName);
        const supplierId = await getSupplierId(supplierName);

        const asset = {
          name,
          serial,
          model_id: modelId,
          company_id: companyId,
          status_id: statusId,
          rtd_location_id: locationId,
          supplier_id: supplierId,
          purchase_date: purchaseDate,
          purchase_cost: purchaseCost,
          warranty_months: warrantyMonths,
          notes,
          requestable: 1,
          gst,
          order_number: orderNumber,
          asset_tag: assetTag
        };

        const columns = Object.keys(asset).map(key => `\`${key}\``).join(', ');
        const placeholders = Object.keys(asset).map(() => '?').join(', ');
        const values = Object.values(asset);

        const [result] = await pool.query(
          `INSERT INTO hardware (${columns}) VALUES (${placeholders})`,
          values
        );

        // Log action
        await pool.query(
          'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
          [req.user?.userId || 1, 'create', 'hardware', result.insertId, `Bulk imported asset tag: ${assetTag}`]
        );

        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`Row ${i + 2}: Database error - ${err.message}`);
      }
    }

    // Delete temp file if multer uploaded it to disk
    if (req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error deleting temp upload file:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk import completed: ${successCount} assets successfully imported, ${errorCount} errors.`,
      successCount,
      errorCount,
      errors
    });

  } catch (error) {
    console.error('Error in bulkUpload:', error);
    return res.status(500).json({ success: false, message: 'Error processing bulk upload file', error: error.message });
  }
};

module.exports = {
  getAll,
  getById,
  getSelectList,
  create,
  update,
  remove,
  restore,
  checkout,
  checkin,
  bulkCheckout,
  getPendingAgentAssets,
  approveAgentAsset,
  rejectAgentAsset,
  agentImportTelemetry,
  bulkUpload
};
