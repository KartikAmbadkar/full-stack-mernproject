const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/stats', ctrl.stats);
router.get(
  '/bookings',
  [query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'failed', 'expired']), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  ctrl.bookings
);
router.get('/users', ctrl.users);
router.patch(
  '/users/:id',
  [param('id').isMongoId(), body('active').optional().isBoolean().toBoolean(), body('role').optional().isIn(['user', 'admin'])],
  validate,
  ctrl.updateUser
);

module.exports = router;
