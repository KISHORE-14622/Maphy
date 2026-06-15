const { getPool } = require('../config/db');

const formatDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

// ==========================================
// ACCESSORIES ENDPOINTS
// ==========================================

const getAccessories = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) sort = 'id';
  if (sort === 'category') sort = 'category_name';
  if (sort === 'location') sort = 'location_name';

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (a.name LIKE ? OR a.model_number LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM accessories a ${whereClause}`, queryParams);

    const sql = `
      SELECT a.*, 
             c.name as category_name, 
             m.name as manufacturer_name, 
             s.name as supplier_name, 
             l.name as location_name,
             (a.qty - (SELECT COALESCE(SUM(qty), 0) FROM accessory_assignments WHERE accessory_id = a.id)) as remaining_qty
      FROM accessories a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN manufacturers m ON a.manufacturer_id = m.id
      LEFT JOIN suppliers s ON a.supplier_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);

    const formatted = rows.map(r => ({
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      manufacturer: r.manufacturer_id ? { id: r.manufacturer_id, name: r.manufacturer_name } : null,
      supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      available_actions: { update: true, delete: true }
    }));

    return res.status(200).json({ success: true, rows: formatted, total });
  } catch (err) {
    console.error('Error in getAccessories:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
};

const getAccessoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT a.*, 
              c.name as category_name, 
              m.name as manufacturer_name, 
              s.name as supplier_name, 
              l.name as location_name,
              (a.qty - (SELECT COALESCE(SUM(qty), 0) FROM accessory_assignments WHERE accessory_id = a.id)) as remaining_qty
       FROM accessories a
       LEFT JOIN categories c ON a.category_id = c.id
       LEFT JOIN manufacturers m ON a.manufacturer_id = m.id
       LEFT JOIN suppliers s ON a.supplier_id = s.id
       LEFT JOIN locations l ON a.location_id = l.id
       WHERE a.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Accessory not found' });
    }

    const r = rows[0];

    // Fetch checked out user log for detail sub-table
    const [checkouts] = await pool.query(
      `SELECT aa.id as assigned_pivot_id, aa.qty, aa.created_at,
              u.id as user_id, CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name, u.email as user_email
       FROM accessory_assignments aa
       LEFT JOIN users u ON aa.user_id = u.id
       WHERE aa.accessory_id = ?`,
      [id]
    );

    const result = {
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      manufacturer: r.manufacturer_id ? { id: r.manufacturer_id, name: r.manufacturer_name } : null,
      supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      checkouts: checkouts.map(c => ({
        assigned_pivot_id: c.assigned_pivot_id,
        qty: c.qty,
        created_at: formatDate(c.created_at),
        user: { id: c.user_id, name: c.user_name, email: c.user_email },
        available_actions: { checkin: true }
      })),
      available_actions: { update: true, delete: true }
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching accessory details:', err);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

const checkoutAccessory = async (req, res) => {
  const { id } = req.params;
  const { assigned_to, note } = req.body;

  if (!assigned_to) {
    return res.status(200).json({ success: false, message: 'User assignment is required' });
  }

  try {
    const pool = await getPool();

    // Verify stock availability
    const [[{ remaining_qty }]] = await pool.query(
      `SELECT (qty - (SELECT COALESCE(SUM(qty), 0) FROM accessory_assignments WHERE accessory_id = accessories.id)) as remaining_qty 
       FROM accessories WHERE id = ?`,
      [id]
    );

    if (remaining_qty <= 0) {
      return res.status(200).json({ success: false, message: 'No remaining quantity available for checkout' });
    }

    // Insert assignment row
    await pool.query(
      'INSERT INTO accessory_assignments (accessory_id, user_id, qty) VALUES (?, ?, ?)',
      [id, assigned_to, 1]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkout', 'accessory', id, `Checked out accessory ID: ${id} to user ID: ${assigned_to}. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Accessory checked out successfully' });

  } catch (error) {
    console.error('Checkout accessory error:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const checkinAccessory = async (req, res) => {
  const { assigned_pivot_id } = req.params;
  const { checkin_date, note } = req.body;

  try {
    const pool = await getPool();

    // Get details before deleting
    const [assignments] = await pool.query('SELECT * FROM accessory_assignments WHERE id = ?', [assigned_pivot_id]);
    if (assignments.length === 0) {
      return res.status(200).json({ success: false, message: 'Accessory assignment record not found' });
    }

    const record = assignments[0];

    // Remove the assignment record
    await pool.query('DELETE FROM accessory_assignments WHERE id = ?', [assigned_pivot_id]);

    // Log checkin action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkin', 'accessory', record.accessory_id, `Checked in accessory from user ID: ${record.user_id}. Date: ${checkin_date || ''}. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Accessory checked in successfully' });

  } catch (error) {
    console.error('Checkin accessory error:', error);
    return res.status(500).json({ success: false, message: 'Database transaction error' });
  }
};

// ==========================================
// CONSUMABLES ENDPOINTS
// ==========================================

const getConsumables = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) sort = 'id';

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.item_number LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM consumables c ${whereClause}`, queryParams);

    const sql = `
      SELECT c.*, 
             cat.name as category_name, 
             m.name as manufacturer_name, 
             s.name as supplier_name, 
             l.name as location_name,
             (c.qty - (SELECT COALESCE(SUM(qty), 0) FROM consumable_assignments WHERE consumable_id = c.id)) as remaining_qty
      FROM consumables c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN suppliers s ON c.supplier_id = s.id
      LEFT JOIN locations l ON c.location_id = l.id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);

    const formatted = rows.map(r => ({
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      manufacturer: r.manufacturer_id ? { id: r.manufacturer_id, name: r.manufacturer_name } : null,
      supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      available_actions: { update: true, delete: true }
    }));

    return res.status(200).json({ success: true, rows: formatted, total });
  } catch (err) {
    console.error('Error in getConsumables:', err);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const getConsumableById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT c.*, 
              cat.name as category_name, 
              m.name as manufacturer_name, 
              s.name as supplier_name, 
              l.name as location_name,
              (c.qty - (SELECT COALESCE(SUM(qty), 0) FROM consumable_assignments WHERE consumable_id = c.id)) as remaining_qty
       FROM consumables c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
       LEFT JOIN suppliers s ON c.supplier_id = s.id
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Consumable not found' });
    }

    const r = rows[0];

    // Fetch checkout history
    const [checkouts] = await pool.query(
      `SELECT ca.id, ca.qty, ca.created_at,
              u.id as user_id, CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name, u.email as user_email
       FROM consumable_assignments ca
       LEFT JOIN users u ON ca.user_id = u.id
       WHERE ca.consumable_id = ?`,
      [id]
    );

    const result = {
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      manufacturer: r.manufacturer_id ? { id: r.manufacturer_id, name: r.manufacturer_name } : null,
      supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      checkouts: checkouts.map(c => ({
        id: c.id,
        qty: c.qty,
        created_at: formatDate(c.created_at),
        user: { id: c.user_id, name: c.user_name, email: c.user_email }
      })),
      available_actions: { update: true, delete: true }
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching consumable details:', err);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

const checkoutConsumable = async (req, res) => {
  const { id } = req.params;
  const { assigned_to, note } = req.body;

  if (!assigned_to) {
    return res.status(200).json({ success: false, message: 'User assignment is required' });
  }

  try {
    const pool = await getPool();

    // Verify stock availability
    const [[{ remaining_qty }]] = await pool.query(
      `SELECT (qty - (SELECT COALESCE(SUM(qty), 0) FROM consumable_assignments WHERE consumable_id = consumables.id)) as remaining_qty 
       FROM consumables WHERE id = ?`,
      [id]
    );

    if (remaining_qty <= 0) {
      return res.status(200).json({ success: false, message: 'No remaining quantity available for checkout' });
    }

    // Insert assignment row
    await pool.query(
      'INSERT INTO consumable_assignments (consumable_id, user_id, qty) VALUES (?, ?, ?)',
      [id, assigned_to, 1]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkout', 'consumable', id, `Checked out consumable ID: ${id} to user ID: ${assigned_to}. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Consumable checked out successfully' });

  } catch (error) {
    console.error('Checkout consumable error:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// ==========================================
// COMPONENTS ENDPOINTS
// ==========================================

const getComponents = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) sort = 'id';

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (comp.name LIKE ? OR comp.serial LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM components comp ${whereClause}`, queryParams);

    const sql = `
      SELECT comp.*, 
             c.name as category_name, 
             l.name as location_name,
             (comp.qty - (SELECT COALESCE(SUM(qty), 0) FROM component_assignments WHERE component_id = comp.id)) as remaining_qty
      FROM components comp
      LEFT JOIN categories c ON comp.category_id = c.id
      LEFT JOIN locations l ON comp.location_id = l.id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);

    const formatted = rows.map(r => ({
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      available_actions: { update: true, delete: true }
    }));

    return res.status(200).json({ success: true, rows: formatted, total });
  } catch (err) {
    console.error('Error in getComponents:', err);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const getComponentById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT comp.*, 
              c.name as category_name, 
              l.name as location_name,
              (comp.qty - (SELECT COALESCE(SUM(qty), 0) FROM component_assignments WHERE component_id = comp.id)) as remaining_qty
       FROM components comp
       LEFT JOIN categories c ON comp.category_id = c.id
       LEFT JOIN locations l ON comp.location_id = l.id
       WHERE comp.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }

    const r = rows[0];

    // Fetch assigned hardware assets
    const [checkouts] = await pool.query(
      `SELECT ca.id as assignedPivotId, ca.qty, ca.created_at,
              h.id as asset_id, h.name as asset_name, h.asset_tag
       FROM component_assignments ca
       LEFT JOIN hardware h ON ca.asset_id = h.id
       WHERE ca.component_id = ?`,
      [id]
    );

    const result = {
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      checkouts: checkouts.map(c => ({
        assignedPivotId: c.assignedPivotId,
        qty: c.qty,
        created_at: formatDate(c.created_at),
        asset: { id: c.asset_id, name: c.asset_name, asset_tag: c.asset_tag }
      })),
      available_actions: { update: true, delete: true }
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching component details:', err);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

const checkoutComponent = async (req, res) => {
  const { id } = req.params;
  const { assigned_to, note } = req.body; // here assigned_to is asset_id

  if (!assigned_to) {
    return res.status(200).json({ success: false, message: 'Asset assignment is required' });
  }

  try {
    const pool = await getPool();

    // Verify stock availability
    const [[{ remaining_qty }]] = await pool.query(
      `SELECT (qty - (SELECT COALESCE(SUM(qty), 0) FROM component_assignments WHERE component_id = components.id)) as remaining_qty 
       FROM components WHERE id = ?`,
      [id]
    );

    if (remaining_qty <= 0) {
      return res.status(200).json({ success: false, message: 'No remaining quantity available for checkout' });
    }

    // Insert assignment row
    await pool.query(
      'INSERT INTO component_assignments (component_id, asset_id, qty) VALUES (?, ?, ?)',
      [id, assigned_to, 1]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkout', 'component', id, `Checked out component ID: ${id} to asset ID: ${assigned_to}. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Component checked out successfully' });

  } catch (error) {
    console.error('Checkout component error:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const checkinComponent = async (req, res) => {
  const { assignedPivotId } = req.params;
  const { checkin_date, note } = req.body;

  try {
    const pool = await getPool();

    // Fetch details before delete
    const [assignments] = await pool.query('SELECT * FROM component_assignments WHERE id = ?', [assignedPivotId]);
    if (assignments.length === 0) {
      return res.status(200).json({ success: false, message: 'Component assignment record not found' });
    }

    const record = assignments[0];

    // Remove the assignment record
    await pool.query('DELETE FROM component_assignments WHERE id = ?', [assignedPivotId]);

    // Log checkin action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkin', 'component', record.component_id, `Checked in component from asset ID: ${record.asset_id}. Date: ${checkin_date || ''}. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'Component checked in successfully' });

  } catch (error) {
    console.error('Checkin component error:', error);
    return res.status(500).json({ success: false, message: 'Database transaction error' });
  }
};

// ==========================================
// SOFTWARE LICENSES ENDPOINTS
// ==========================================

const getLicenses = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) sort = 'id';

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (l.name LIKE ? OR l.license_name LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Expiry filters if loaded from Dashboard menu clicks
    const requestPath = req.path;
    if (requestPath.includes('/expired')) {
      whereClause += ' AND l.expiration_date IS NOT NULL AND l.expiration_date < CURRENT_DATE()';
    } else if (requestPath.includes('/goingToExpired')) {
      whereClause += ' AND l.expiration_date IS NOT NULL AND l.expiration_date >= CURRENT_DATE() AND l.expiration_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)';
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM licenses l ${whereClause}`, queryParams);

    const sql = `
      SELECT l.*, 
             c.name as category_name, 
             m.name as manufacturer_name, 
             s.name as supplier_name,
             (SELECT COUNT(*) FROM license_assignments WHERE license_id = l.id) as assigned_seats
      FROM licenses l
      LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN manufacturers m ON l.manufacturer_id = m.id
      LEFT JOIN suppliers s ON l.supplier_id = s.id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);

    const formatted = rows.map(r => {
      const freeSeats = Math.max(0, r.seats - r.assigned_seats);
      return {
        ...r,
        category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
        manufacturer: r.manufacturer_id ? { id: r.manufacturer_id, name: r.manufacturer_name } : null,
        supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
        purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
        expiration_date: r.expiration_date ? { date: formatDate(r.expiration_date) } : null,
        free_seats_count: freeSeats,
        available_seats: freeSeats,
        available_actions: { update: true, delete: true }
      };
    });

    return res.status(200).json({ success: true, rows: formatted, total });
  } catch (err) {
    console.error('Error in getLicenses:', err);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const getLicenseById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT l.*, 
              c.name as category_name, 
              m.name as manufacturer_name, 
              s.name as supplier_name,
              (SELECT COUNT(*) FROM license_assignments WHERE license_id = l.id) as assigned_seats
       FROM licenses l
       LEFT JOIN categories c ON l.category_id = c.id
       LEFT JOIN manufacturers m ON l.manufacturer_id = m.id
       LEFT JOIN suppliers s ON l.supplier_id = s.id
       WHERE l.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'License not found' });
    }

    const r = rows[0];

    // Fetch assigned seats mappings
    const [checkouts] = await pool.query(
      `SELECT la.id as assigned_pivot_id, la.created_at,
              u.id as user_id, CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name, u.email as user_email,
              h.id as asset_id, h.name as asset_name, h.asset_tag
       FROM license_assignments la
       LEFT JOIN users u ON la.user_id = u.id
       LEFT JOIN hardware h ON la.asset_id = h.id
       WHERE la.license_id = ?`,
      [id]
    );

    const result = {
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      manufacturer: r.manufacturer_id ? { id: r.manufacturer_id, name: r.manufacturer_name } : null,
      supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
      purchase_date: r.purchase_date ? { date: formatDate(r.purchase_date) } : null,
      expiration_date: r.expiration_date ? { date: formatDate(r.expiration_date) } : null,
      free_seats_count: Math.max(0, r.seats - r.assigned_seats),
      checkouts: checkouts.map(c => {
        let assignedToText = 'Unassigned';
        if (c.user_id) {
          assignedToText = c.user_name;
        } else if (c.asset_id) {
          assignedToText = `Asset: ${c.asset_name} (${c.asset_tag})`;
        }
        return {
          assigned_pivot_id: c.assigned_pivot_id,
          created_at: formatDate(c.created_at),
          assigned_to: assignedToText,
          user: c.user_id ? { id: c.user_id, name: c.user_name, email: c.user_email } : null,
          asset: c.asset_id ? { id: c.asset_id, name: c.asset_name, asset_tag: c.asset_tag } : null
        };
      }),
      available_actions: { update: true, delete: true }
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching license details:', err);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

const checkoutLicense = async (req, res) => {
  const { id } = req.params;
  const { checkout_to_type, assigned_user, assigned_asset, note } = req.body;

  let targetId = checkout_to_type === 'user' ? assigned_user : assigned_asset;
  if (!targetId) {
    return res.status(200).json({ success: false, message: 'Checkout target assignment is required' });
  }

  try {
    const pool = await getPool();

    // Check available seats
    const [[{ assigned_seats }]] = await pool.query(
      'SELECT COUNT(*) as assigned_seats FROM license_assignments WHERE license_id = ?',
      [id]
    );
    const [[{ seats }]] = await pool.query('SELECT seats FROM licenses WHERE id = ?', [id]);

    if (assigned_seats >= seats) {
      return res.status(200).json({ success: false, message: 'All license seats have already been checked out' });
    }

    // Insert license assignment record
    let user_id = checkout_to_type === 'user' ? targetId : null;
    let asset_id = checkout_to_type === 'asset' ? targetId : null;

    await pool.query(
      'INSERT INTO license_assignments (license_id, user_id, asset_id) VALUES (?, ?, ?)',
      [id, user_id, asset_id]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkout', 'license', id, `Checked out license ID: ${id} to ${checkout_to_type} ID: ${targetId}. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'License seat checked out successfully' });

  } catch (error) {
    console.error('Checkout license seat error:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const checkinLicense = async (req, res) => {
  const { assigned_pivot_id } = req.params;
  const { note } = req.body;

  try {
    const pool = await getPool();

    // Fetch details before delete
    const [assignments] = await pool.query('SELECT * FROM license_assignments WHERE id = ?', [assigned_pivot_id]);
    if (assignments.length === 0) {
      return res.status(200).json({ success: false, message: 'License assignment record not found' });
    }

    const record = assignments[0];

    // Delete assignment record
    await pool.query('DELETE FROM license_assignments WHERE id = ?', [assigned_pivot_id]);

    // Log checkin action
    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'checkin', 'license', record.license_id, `Checked in license seat. Notes: ${note || ''}`]
    );

    return res.status(200).json({ success: true, message: 'License seat checked in successfully' });

  } catch (error) {
    console.error('Checkin license seat error:', error);
    return res.status(500).json({ success: false, message: 'Database checkin error' });
  }
};

module.exports = {
  // Accessories
  getAccessories,
  getAccessoryById,
  checkoutAccessory,
  checkinAccessory,
  
  // Consumables
  getConsumables,
  getConsumableById,
  checkoutConsumable,

  // Components
  getComponents,
  getComponentById,
  checkoutComponent,
  checkinComponent,

  // Licenses
  getLicenses,
  getLicenseById,
  checkoutLicense,
  checkinLicense
};
