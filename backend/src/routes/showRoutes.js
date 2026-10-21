const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/showController');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const id = param('id').isMongoId().withMessage('Invalid show id');
const price = [
  body('price.silver').optional().isFloat({ min: 0 }).withMessage('Silver price must be 0 or more'),
  body('price.gold').optional().isFloat({ min: 0 }).withMessage('Gold price must be 0 or more'),
  body('price.premium').optional().isFloat({ min: 0 }).withMessage('Premium price must be 0 or more')
];

router.get(
  '/',
  [
    query('movie').optional().isMongoId().withMessage('Invalid movie id'),
    query('theatre').optional().isMongoId().withMessage('Invalid theatre id'),
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  ctrl.list
);
router.get('/:id', id, validate, ctrl.get);
router.get('/:id/seats', id, validate, ctrl.seats);

router.post(
  '/',
  protect,
  restrictTo('admin'),
  [
    body('movie').isMongoId().withMessage('Choose a movie'),
    body('theatre').isMongoId().withMessage('Choose a theatre'),
    body('screen').trim().notEmpty().withMessage('Screen is required'),
    body('startTime').isISO8601().withMessage('Start time must be a valid date and time').custom((v) => new Date(v) > new Date()).withMessage('Start time must be in the future'),
    body('rows').optional().isInt({ min: 3, max: 26 }),
    body('cols').optional().isInt({ min: 4, max: 30 }),
    ...price
  ],
  validate,
  ctrl.create
);

router.put(
  '/:id',
  protect,
  restrictTo('admin'),
  [id, body('startTime').optional().isISO8601().withMessage('Start time must be a valid date and time'), body('status').optional().isIn(['active', 'cancelled']), ...price],
  validate,
  ctrl.update
);
router.delete('/:id', protect, restrictTo('admin'), id, validate, ctrl.remove);

module.exports = router;
