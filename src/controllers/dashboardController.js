const { getPool } = require('../config/db');

// GET /dashboard/ - overview counts
const getOverview = async (req, res) => {
  try {
    const pool = await getPool();

    // 1. Assets count
    const [[{ assetsCount }]] = await pool.query(
      'SELECT COUNT(*) as assetsCount FROM hardware WHERE deleted_at IS NULL'
    );

    // 2. Accessories count
    const [[{ accessoriesCount }]] = await pool.query(
      'SELECT COALESCE(SUM(qty), 0) as accessoriesCount FROM accessories'
    );

    // 3. Consumables count
    const [[{ consumablesCount }]] = await pool.query(
      'SELECT COALESCE(SUM(qty), 0) as consumablesCount FROM consumables'
    );

    // 4. Licenses count
    const [[{ licensesCount }]] = await pool.query(
      'SELECT COUNT(*) as licensesCount FROM licenses'
    );

    // 5. Expired licenses count
    const [[{ licenseExpiredCount }]] = await pool.query(
      'SELECT COUNT(*) as licenseExpiredCount FROM licenses WHERE expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE()'
    );

    // 6. Going to expire licenses count (within 30 days)
    const [[{ LicensesGoingToExpired }]] = await pool.query(
      `SELECT COUNT(*) as LicensesGoingToExpired 
       FROM licenses 
       WHERE expiration_date IS NOT NULL 
         AND expiration_date >= CURRENT_DATE() 
         AND expiration_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`
    );

    return res.status(200).json({
      assetsCount,
      accessoriesCount,
      consumablesCount,
      licensesCount,
      licenseExpiredCount,
      LicensesGoingToExpired
    });

  } catch (error) {
    console.error('Error fetching dashboard overview details:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /dashboard/chart - assets counts by status labels
const getAssetChart = async (req, res) => {
  try {
    const pool = await getPool();

    // Deployable count: ready status, not checked out
    const [[{ deployableCount }]] = await pool.query(
      `SELECT COUNT(*) as deployableCount 
       FROM hardware 
       WHERE assigned_to IS NULL 
         AND status_id IN (SELECT id FROM status_labels WHERE type = 'deployable') 
         AND deleted_at IS NULL`
    );

    // Deployed count: checked out (assigned_to is not null)
    const [[{ deployedCount }]] = await pool.query(
      `SELECT COUNT(*) as deployedCount 
       FROM hardware 
       WHERE assigned_to IS NOT NULL 
         AND deleted_at IS NULL`
    );

    // Undeployed count: has status type other than deployable, or not assigned
    const [[{ undeployedCount }]] = await pool.query(
      `SELECT COUNT(*) as undeployedCount 
       FROM hardware 
       WHERE status_id IN (SELECT id FROM status_labels WHERE type != 'deployable') 
         AND deleted_at IS NULL`
    );

    return res.status(200).json({
      deployableCount,
      deployedCount,
      undeployedCount
    });

  } catch (error) {
    console.error('Error fetching asset chart details:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /accessories/chart - remaining vs checkout quantities
const getAccessoryChart = async (req, res) => {
  try {
    const pool = await getPool();

    const [[{ totalRemainingQty }]] = await pool.query(
      `SELECT COALESCE(SUM(qty - (SELECT COALESCE(SUM(qty), 0) FROM accessory_assignments WHERE accessory_id = accessories.id)), 0) as totalRemainingQty 
       FROM accessories`
    );

    const [[{ totalCheckoutCount }]] = await pool.query(
      `SELECT COALESCE(SUM(qty), 0) as totalCheckoutCount 
       FROM accessory_assignments`
    );

    return res.status(200).json({
      totalRemainingQty,
      totalCheckoutCount
    });
  } catch (error) {
    console.error('Error fetching accessories chart:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /components/chart - remaining vs checkout quantities
const getComponentChart = async (req, res) => {
  try {
    const pool = await getPool();

    const [[{ totalRemainingQty }]] = await pool.query(
      `SELECT COALESCE(SUM(qty - (SELECT COALESCE(SUM(qty), 0) FROM component_assignments WHERE component_id = components.id)), 0) as totalRemainingQty 
       FROM components`
    );

    const [[{ totalCheckoutCount }]] = await pool.query(
      `SELECT COALESCE(SUM(qty), 0) as totalCheckoutCount 
       FROM component_assignments`
    );

    return res.status(200).json({
      totalRemainingQty,
      totalCheckoutCount
    });
  } catch (error) {
    console.error('Error fetching components chart:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /consumables/chart - remaining vs checkout quantities
const getConsumableChart = async (req, res) => {
  try {
    const pool = await getPool();

    const [[{ totalRemainingQty }]] = await pool.query(
      `SELECT COALESCE(SUM(qty - (SELECT COALESCE(SUM(qty), 0) FROM consumable_assignments WHERE consumable_id = consumables.id)), 0) as totalRemainingQty 
       FROM consumables`
    );

    const [[{ totalCheckoutCount }]] = await pool.query(
      `SELECT COALESCE(SUM(qty), 0) as totalCheckoutCount 
       FROM consumable_assignments`
    );

    return res.status(200).json({
      totalRemainingQty,
      totalCheckoutCount
    });
  } catch (error) {
    console.error('Error fetching consumables chart:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /licenses/chart - assigned vs free seats
const getLicenseChart = async (req, res) => {
  try {
    const pool = await getPool();

    const [[{ totalAssignedSeats }]] = await pool.query(
      'SELECT COUNT(*) as totalAssignedSeats FROM license_assignments'
    );

    const [[{ totalSeats }]] = await pool.query(
      'SELECT COALESCE(SUM(seats), 0) as totalSeats FROM licenses'
    );

    const totalFreeSeats = Math.max(0, totalSeats - totalAssignedSeats);

    return res.status(200).json({
      totalAssignedSeats,
      totalFreeSeats
    });
  } catch (error) {
    console.error('Error fetching licenses chart:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /users/chart - users grouped by group
const getUserGroupChart = async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT g.name as groupName, COUNT(u.id) as userCount 
       FROM \`groups\` g 
       LEFT JOIN users u ON u.group_id = g.id 
       GROUP BY g.id`
    );

    return res.status(200).json({
      groups: rows
    });
  } catch (error) {
    console.error('Error fetching users group chart:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /tickets/chart - tickets count by status
const getTicketChart = async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT status_name, COUNT(*) as count 
       FROM tickets 
       GROUP BY status_name`
    );

    return res.status(200).json({
      statuses: rows
    });
  } catch (error) {
    console.error('Error fetching tickets chart:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

// GET /reports/activity - activity logs
const getActivityLogs = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  try {
    const pool = await getPool();

    // Query total count
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM action_logs');

    // Query logs
    const [rows] = await pool.query(
      `SELECT al.*, CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name 
       FROM action_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       ORDER BY al.created_at ${order} 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.status(200).json({
      success: true,
      rows: rows,
      total: total
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({ success: false, message: 'Database query error' });
  }
};

module.exports = {
  getOverview,
  getAssetChart,
  getAccessoryChart,
  getComponentChart,
  getConsumableChart,
  getLicenseChart,
  getUserGroupChart,
  getTicketChart,
  getActivityLogs
};
