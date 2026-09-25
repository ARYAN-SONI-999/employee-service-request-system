const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/dashboard.controller');

const router = express.Router();
router.get('/summary', authenticate, ctrl.summary);

module.exports = router;
