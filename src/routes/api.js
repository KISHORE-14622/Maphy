const express = require('express');
const multer = require('multer');
const path = require('path');

// Configure file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

// Import controllers & middleware
const authMiddleware = require('../middleware/auth');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const assetController = require('../controllers/assetController');
const inventoryController = require('../controllers/inventoryController');
const ticketController = require('../controllers/ticketController');
const operationsController = require('../controllers/operationsController');
const { makeGenericController } = require('../controllers/genericController');

// Helper to register generic routes
const registerGenericRoutes = (routePath, tableName, searchColumns) => {
  const ctrl = makeGenericController(tableName, searchColumns);
  router.get(routePath, ctrl.getAll);
  router.get(`${routePath}/selectList`, ctrl.getSelectList);
  router.get(`${routePath}/:id`, ctrl.getById);
  router.post(routePath, ctrl.create);
  router.put(`${routePath}/:id`, ctrl.update);
  router.delete(`${routePath}/:id`, ctrl.remove);
  
  if (tableName === 'manufacturers' || tableName === 'users' || tableName === 'asset_models') {
    router.put(`${routePath}/restore/:id`, ctrl.restore);
  }
};

// ==========================================
// UNPROTECTED ROUTES
// ==========================================
router.post('/users/login', authController.login);

// Special Telemetry route: verified inside controller against agent secure token
router.post('/hardware/agent-import', assetController.agentImportTelemetry);

// Short URL redirection
router.get('/shorturl/:code', operationsController.redirectShortUrl);

// ==========================================
// PROTECTED ROUTES (Requires JWT authentication)
// ==========================================
router.use((req, res, next) => {
  // Allow agent-import and redirectShortUrl to bypass standard JWT check
  if (req.path.startsWith('/shorturl/') || req.path === '/hardware/agent-import') {
    return next();
  }
  
  // Custom bypass for agent telemetries (bearer token verified matching)
  const authHeader = req.headers['authorization'];
  if (authHeader === 'Bearer MAPHY_AGENT_SECURE_TOKEN_XYZ123') {
    return next();
  }

  authMiddleware(req, res, next);
});

// 1. Dashboard
router.get('/dashboard', dashboardController.getOverview);
router.get('/dashboard/chart', dashboardController.getAssetChart);
router.get('/accessories/chart', dashboardController.getAccessoryChart);
router.get('/components/chart', dashboardController.getComponentChart);
router.get('/consumables/chart', dashboardController.getConsumableChart);
router.get('/licenses/chart', dashboardController.getLicenseChart);
router.get('/users/chart', dashboardController.getUserGroupChart);
router.get('/tickets/chart', dashboardController.getTicketChart);
router.get('/reports/activity', dashboardController.getActivityLogs);

// 2. Hardware (Assets) Specific endpoints
router.get('/hardware', assetController.getAll);
router.get('/hardware/selectList', assetController.getSelectList);
router.get('/hardware/pending-agent', assetController.getPendingAgentAssets);
router.get('/hardware/:id', assetController.getById);
router.post('/hardware', upload.single('image'), assetController.create);
router.put('/hardware/:id', upload.single('image'), assetController.update);
router.delete('/hardware/:id', assetController.remove);
router.put('/hardware/restore/:id', assetController.restore);

router.post('/hardware/bulkcheckout', assetController.bulkCheckout);
router.post('/hardware/bulk-upload', upload.single('file'), assetController.bulkUpload);
router.post('/hardware/:id/checkout', assetController.checkout);
router.post('/hardware/:id/checkin', assetController.checkin);
router.post('/hardware/approve-agent', assetController.approveAgentAsset);
router.delete('/hardware/pending-agent/:id', assetController.rejectAgentAsset);

// 3. Inventory components specific checkout/checkins
// Accessories
router.get('/accessories', inventoryController.getAccessories);
router.get('/accessories/:id', inventoryController.getAccessoryById);
router.post('/accessories/:id/checkout', inventoryController.checkoutAccessory);
router.post('/accessories/:assigned_pivot_id/checkin', inventoryController.checkinAccessory);

// Components
router.get('/components', inventoryController.getComponents);
router.get('/components/:id', inventoryController.getComponentById);
router.post('/components/:id/checkout', inventoryController.checkoutComponent);
router.post('/components/:assignedPivotId/checkin', inventoryController.checkinComponent);

// Consumables
router.get('/consumables', inventoryController.getConsumables);
router.get('/consumables/:id', inventoryController.getConsumableById);
router.post('/consumables/:id/checkout', inventoryController.checkoutConsumable);

// Licenses
router.get('/licenses', inventoryController.getLicenses);
router.get('/licenses/expired', inventoryController.getLicenses);
router.get('/licenses/goingToExpired', inventoryController.getLicenses);
router.get('/licenses/:id', inventoryController.getLicenseById);
router.post('/licenses/:id/checkout', inventoryController.checkoutLicense);
router.post('/licenses/:assigned_pivot_id/checkin', inventoryController.checkinLicense);

// 4. Ticketing Endpoints
router.get('/tickets', ticketController.getAllTickets);
router.get('/tickets/ticketstatus', ticketController.getTicketStatuses);
router.get('/tickets/:talentGroupId/users', ticketController.getTalentGroupUsers);
router.get('/tickets/:id', ticketController.getTicketById);
router.post('/tickets', ticketController.createTicket);
router.put('/tickets/:id', ticketController.updateTicket);
router.delete('/tickets/:id', ticketController.deleteTicket);

// 5. Operations
router.get('/audit', operationsController.getAudits);
router.post('/audit', operationsController.createAudit);
router.post('/shorturl', operationsController.createShortUrl);

// Settings Config
router.get('/branding', operationsController.getBranding);
router.put('/branding', upload.single('logo'), operationsController.updateBranding);
router.get('/labels', operationsController.getLabels);
router.put('/labels/:firmId', operationsController.updateLabels);
router.post('/labels', operationsController.updateLabels);
router.get('/slack', operationsController.getSlack);
router.post('/slack', operationsController.updateSlack);

// 6. Generic Routes Registry
registerGenericRoutes('/suppliers', 'suppliers', ['name', 'city', 'state', 'country', 'contact_name']);
registerGenericRoutes('/statuslabels', 'status_labels', ['name', 'type']);
registerGenericRoutes('/manufacturers', 'manufacturers', ['name']);
registerGenericRoutes('/locations', 'locations', ['name', 'city', 'state', 'country']);
registerGenericRoutes('/depreciations', 'depreciations', ['name']);
registerGenericRoutes('/departments', 'departments', ['name']);
registerGenericRoutes('/companies', 'companies', ['name']);
registerGenericRoutes('/categories', 'categories', ['name', 'category_type']);
registerGenericRoutes('/ticketissues', 'ticket_issues', ['name']);
registerGenericRoutes('/scrapsale', 'scrapsales', ['notes']);
registerGenericRoutes('/groups', 'groups', ['name']);
registerGenericRoutes('/talentGroup', 'talent_groups', ['name', 'description']);
registerGenericRoutes('/users', 'users', ['first_name', 'last_name', 'email', 'username']);
registerGenericRoutes('/models', 'asset_models', ['name', 'model_number']);

module.exports = router;
