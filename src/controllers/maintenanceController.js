const { getPool } = require('../config/db');

const getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  const assetId = req.query.asset_id;
  let sort = req.query.sort || 'id';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  try {
    const pool = await getPool();
    let whereClause = ' WHERE 1=1';
    let queryParams = [];
    
    if (assetId && assetId !== 'undefined' && assetId !== 'null') {
      whereClause += ' AND m.asset_id = ?';
      queryParams.push(assetId);
    }
    
    if (search) {
      whereClause += ' AND (m.title LIKE ? OR m.notes LIKE ? OR m.asset_maintenance_type LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const countSql = `SELECT COUNT(*) as total FROM \`maintenances\` m ${whereClause}`;
    const [[{ total }]] = await pool.query(countSql, queryParams);
    
    const rowsSql = `
      SELECT m.*, 
             h.name as asset_name, h.asset_tag as asset_tag, h.model_id as model_id,
             am.name as model_name,
             s.name as supplier_name
      FROM \`maintenances\` m
      LEFT JOIN hardware h ON m.asset_id = h.id
      LEFT JOIN asset_models am ON h.model_id = am.id
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      ${whereClause}
      ORDER BY m.${sort} ${order}
      LIMIT ? OFFSET ?`;
    
    const [rows] = await pool.query(rowsSql, [...queryParams, limit, offset]);
    
    const formattedRows = rows.map(r => ({
      id: r.id,
      asset_id: r.asset_id,
      supplier_id: r.supplier_id,
      asset_maintenance_type: r.asset_maintenance_type,
      title: r.title,
      cost: r.cost,
      is_warranty: r.is_warranty,
      notes: r.notes,
      start_date: { date: r.start_date },
      completion_date: { date: r.completion_date },
      asset: { id: r.asset_id, name: r.asset_name, asset_tag: r.asset_tag },
      model: { id: r.model_id, name: r.model_name },
      supplier: { id: r.supplier_id, name: r.supplier_name }
    }));
    
    res.status(200).json({ success: true, rows: formattedRows, total });
  } catch (err) {
    console.error('Error fetching maintenances:', err);
    res.status(500).json({ success: false, message: 'Database query error' });
  }
};

const getById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const sql = `
      SELECT m.*, 
             h.name as asset_name, h.asset_tag as asset_tag, h.model_id as model_id,
             am.name as model_name,
             s.name as supplier_name
      FROM \`maintenances\` m
      LEFT JOIN hardware h ON m.asset_id = h.id
      LEFT JOIN asset_models am ON h.model_id = am.id
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      WHERE m.id = ?`;
    const [rows] = await pool.query(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Maintenance not found' });
    }
    
    const r = rows[0];
    res.status(200).json({
      id: r.id,
      asset_id: r.asset_id,
      supplier_id: r.supplier_id,
      asset_maintenance_type: r.asset_maintenance_type,
      title: r.title,
      cost: r.cost,
      is_warranty: r.is_warranty,
      notes: r.notes,
      start_date: { date: r.start_date },
      completion_date: { date: r.completion_date },
      asset: { id: r.asset_id, name: r.asset_name, asset_tag: r.asset_tag },
      model: { id: r.model_id, name: r.model_name },
      supplier: { id: r.supplier_id, name: r.supplier_name }
    });
  } catch (err) {
    console.error('Error fetching maintenance by id:', err);
    res.status(500).json({ success: false, message: 'Database fetch error' });
  }
};

const create = async (req, res) => {
  const data = req.body;
  try {
    const pool = await getPool();
    const columns = ['asset_id', 'supplier_id', 'asset_maintenance_type', 'title', 'start_date', 'completion_date', 'is_warranty', 'cost', 'notes'];
    const values = [
      data.asset_id ? parseInt(data.asset_id) : null,
      data.supplier_id ? parseInt(data.supplier_id) : null,
      data.asset_maintenance_type || null,
      data.title || null,
      data.start_date || null,
      data.completion_date || null,
      data.is_warranty ? parseInt(data.is_warranty) : 0,
      data.cost ? parseFloat(data.cost) : null,
      data.notes || null
    ];
    
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`maintenances\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.query(sql, values);
    
    res.status(201).json({ success: true, message: 'Maintenance created successfully', id: result.insertId });
  } catch (err) {
    console.error('Error creating maintenance:', err);
    res.status(500).json({ success: false, message: 'Database insert error' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const pool = await getPool();
    const updates = {
      asset_id: data.asset_id ? parseInt(data.asset_id) : null,
      supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
      asset_maintenance_type: data.asset_maintenance_type || null,
      title: data.title || null,
      start_date: data.start_date || null,
      completion_date: data.completion_date || null,
      is_warranty: data.is_warranty ? parseInt(data.is_warranty) : 0,
      cost: data.cost ? parseFloat(data.cost) : null,
      notes: data.notes || null
    };
    
    const columns = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = columns.map(c => `\`${c}\` = ?`).join(', ');
    
    await pool.query(`UPDATE \`maintenances\` SET ${setClause} WHERE id = ?`, [...values, id]);
    res.status(200).json({ success: true, message: 'Maintenance updated successfully' });
  } catch (err) {
    console.error('Error updating maintenance:', err);
    res.status(500).json({ success: false, message: 'Database update error' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.query('DELETE FROM \`maintenances\` WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Maintenance deleted successfully' });
  } catch (err) {
    console.error('Error deleting maintenance:', err);
    res.status(500).json({ success: false, message: 'Database delete error' });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
