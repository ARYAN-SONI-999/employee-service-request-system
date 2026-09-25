const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/users.controller');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get('/', ctrl.listUsers);

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 120 }),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['employee', 'agent', 'admin']),
    body('department').optional({ nullable: true }).isIn(['IT', 'HR', 'Facility']),
  ],
  validate,
  ctrl.createUser
);

router.patch(
  '/:id/active',
  [body('is_active').isBoolean()],
  validate,
  ctrl.setUserActive
);

module.exports = router;
