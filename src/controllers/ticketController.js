const { getPool } = require('../config/db');

const formatDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

// GET /tickets - List tickets with sorting, search, and pagination
const getAllTickets = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  if (!/^[a-zA-Z0-9_\.]+$/.test(sort)) {
    sort = 'id';
  }

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (t.subject LIKE ? OR t.description LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM tickets t ${whereClause}`, queryParams);

    const sql = `
      SELECT t.*, 
             h.name as asset_name, 
             h.asset_tag,
             CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name,
             CONCAT(ua.first_name, ' ', COALESCE(ua.last_name, '')) as assigned_user_name
      FROM tickets t
      LEFT JOIN hardware h ON t.asset_id = h.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users ua ON t.assigned_to_user_id = ua.id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...queryParams, limit, offset]);

    const formattedRows = rows.map(row => ({
      ...row,
      created_at: formatDate(row.created_at),
      updated_at: formatDate(row.updated_at),
      available_actions: { update: true, delete: true }
    }));

    return res.status(200).json({
      success: true,
      rows: formattedRows,
      total: total
    });
  } catch (error) {
    console.error('Error fetching tickets list:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /tickets/:id - Get ticket by id
const getTicketById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const sql = `
      SELECT t.*, 
             h.name as asset_name, h.asset_tag,
             CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name, u.email as user_email,
             CONCAT(ua.first_name, ' ', COALESCE(ua.last_name, '')) as assigned_user_name
      FROM tickets t
      LEFT JOIN hardware h ON t.asset_id = h.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users ua ON t.assigned_to_user_id = ua.id
      WHERE t.id = ?`;

    const [rows] = await pool.query(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const ticket = rows[0];
    return res.status(200).json({
      ...ticket,
      created_at: formatDate(ticket.created_at),
      updated_at: formatDate(ticket.updated_at)
    });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    return res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

// POST /tickets - Create ticket
const createTicket = async (req, res) => {
  const { subject, description, priority, asset_id, user_id, assigned_to_user_id } = req.body;
  try {
    const pool = await getPool();

    const sql = `
      INSERT INTO tickets (subject, description, priority, status_name, asset_id, user_id, assigned_to_user_id) 
      VALUES (?, ?, ?, 'open', ?, ?, ?)`;
    const [result] = await pool.query(sql, [
      subject,
      description || '',
      priority || 'medium',
      asset_id || null,
      user_id || null,
      assigned_to_user_id || null
    ]);

    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'create', 'ticket', result.insertId, `Created ticket: ${subject}`]
    );

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ success: false, message: 'Database insert error' });
  }
};

// PUT /tickets/:id - Update ticket details or status
const updateTicket = async (req, res) => {
  const { id } = req.params;
  const { subject, description, priority, status_name, asset_id, user_id, assigned_to, detail, status_id } = req.body;

  try {
    const pool = await getPool();

    // Mapping update status labels request body format (from updateTicketStatus.js)
    let updateFields = [];
    let params = [];

    if (subject !== undefined) { updateFields.push('subject = ?'); params.push(subject); }
    if (description !== undefined) { updateFields.push('description = ?'); params.push(description); }
    if (priority !== undefined) { updateFields.push('priority = ?'); params.push(priority); }
    
    // Status can be status_name string or status_id status code
    if (status_name !== undefined) { 
      updateFields.push('status_name = ?'); 
      params.push(status_name); 
    } else if (status_id !== undefined) {
      let mappedStatus = 'open';
      const statusMap = {
        '1': 'open',
        '2': 'in_progress',
        '3': 'pending',
        '4': 'resolved',
        '5': 'closed',
        '6': 'sister_ticket',
        '7': 'assigned'
      };
      mappedStatus = statusMap[status_id] || 'open';
      updateFields.push('status_name = ?');
      params.push(mappedStatus);
    }

    if (asset_id !== undefined) { updateFields.push('asset_id = ?'); params.push(asset_id); }
    if (user_id !== undefined) { updateFields.push('user_id = ?'); params.push(user_id); }
    
    if (assigned_to !== undefined) { 
      updateFields.push('assigned_to_user_id = ?'); 
      params.push(assigned_to || null); 
    }

    if (detail !== undefined) {
      // Append update explanation into description as a log
      updateFields.push('description = CONCAT(description, ?)');
      params.push(`\n[Status Update Detail]: ${detail}`);
    }

    if (updateFields.length === 0) {
      return res.status(200).json({ success: true, message: 'No fields to update' });
    }

    const sql = `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.query(sql, [...params, id]);

    await pool.query(
      'INSERT INTO action_logs (user_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.userId || 1, 'update', 'ticket', id, `Updated ticket status/details`]
    );

    return res.status(200).json({
      success: true,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({ success: false, message: 'Database update error' });
  }
};

// DELETE /tickets/:id - Delete ticket
const deleteTicket = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.query('DELETE FROM tickets WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return res.status(500).json({ success: false, message: 'Database delete error' });
  }
};

// GET /tickets/ticketstatus - Dropdown status options
const getTicketStatuses = async (req, res) => {
  // Ticket status items
  const items = [
    { id: 1, text: 'Open' },
    { id: 2, text: 'In Progress' },
    { id: 3, text: 'Pending' },
    { id: 4, text: 'Resolved' },
    { id: 5, text: 'Closed' },
    { id: 6, text: 'Create Sister Ticket' },
    { id: 7, text: 'Assign Ticket' }
  ];

  return res.status(200).json({
    success: true,
    items
  });
};

// GET /tickets/:talentGroupId/users - List assignable users for a talent group
const getTalentGroupUsers = async (req, res) => {
  try {
    const pool = await getPool();
    // For local test, return all active users, mapped to firstName/lastName fields expected by React client dropdown
    const sql = 'SELECT id, first_name as firstName, last_name as lastName FROM users WHERE deleted_at IS NULL ORDER BY first_name ASC';
    const [rows] = await pool.query(sql);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching talent group users:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketStatuses,
  getTalentGroupUsers
};
