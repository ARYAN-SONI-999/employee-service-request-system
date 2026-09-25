const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/requests.controller');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  [
    query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'cancelled']),
    query('category').optional().isIn(['IT', 'HR', 'Facility']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  ],
  validate,
  ctrl.listRequests
);

router.get('/:id', [param('id').isInt()], validate, ctrl.getRequest);

router.post(
  '/',
  authorize('employee', 'admin'),
  [
    body('category').isIn(['IT', 'HR', 'Facility']).withMessage('Category must be IT, HR, or Facility.'),
    body('title').trim().isLength({ min: 5, max: 160 }).withMessage('Title must be 5-160 characters.'),
    body('description').trim().isLength({ min: 10, max: 4000 }).withMessage('Description must be at least 10 characters.'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  ],
  validate,
  ctrl.createRequest
);

router.patch(
  '/:id',
  authorize('agent', 'admin'),
  [
    param('id').isInt(),
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('assigned_agent_id').optional({ nullable: true }).isInt(),
  ],
  validate,
  ctrl.updateRequest
);

router.post(
  '/:id/comments',
  [param('id').isInt(), body('body').trim().isLength({ min: 1, max: 2000 })],
  validate,
  ctrl.addComment
);

module.exports = router;
