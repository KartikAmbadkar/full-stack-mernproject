const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/bookingController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { bookingLimiter } = require('../middleware/rateLimit');

const id = param('id').isMongoId().withMessage('Invalid booking id');

router.use(protect);

router.post(
  '/',
  bookingLimiter,
  [
    body('showId').isMongoId().withMessage('Invalid show id'),
    body('seats').isArray({ min: 1, max: 50 }).withMessage('Choose at least one seat'),
    body('seats.*').isString().matches(/^[A-Za-z]{1,2}\d{1,2}$/).withMessage('Seat labels look like A1 or F12')
  ],
  validate,
  ctrl.create
);

router.get(
  '/mine',
  [query('type').optional().isIn(['upcoming', 'past', 'all']), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  ctrl.mine
);
router.get('/:id', id, validate, ctrl.get);
router.post('/:id/cancel', bookingLimiter, id, validate, ctrl.cancel);

module.exports = router;
