const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/paymentController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { bookingLimiter } = require('../middleware/rateLimit');

router.use(protect);

router.post(
  '/',
  bookingLimiter,
  [
    body('bookingId').isMongoId().withMessage('Invalid booking id'),
    body('method').isIn(['upi', 'card', 'netbanking']).withMessage('Payment method must be upi, card or netbanking'),
    body('simulate').optional().isIn(['success', 'failure'])
  ],
  validate,
  ctrl.pay
);

router.get('/mine', ctrl.mine);

module.exports = router;
