const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/movieController');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { protect, restrictTo } = require('../middleware/auth');

const id = param('id').isMongoId().withMessage('Invalid movie id');
const opt = (chain, optional) => (optional ? chain.optional() : chain);

const rules = (optional) => [
  opt(body('title').trim().isLength({ min: 1, max: 80 }).withMessage('Title is required (80 characters max)'), optional),
  opt(body('genre').trim().notEmpty().withMessage('Genre is required'), optional),
  opt(body('language').trim().notEmpty().withMessage('Language is required'), optional),
  opt(body('duration').isInt({ min: 30, max: 300 }).withMessage('Duration must be 30 to 300 minutes'), optional),
  body('certificate').optional().isIn(['U', 'U/A', 'A']).withMessage('Certificate must be U, U/A or A'),
  body('rating').optional().isFloat({ min: 0, max: 10 }).withMessage('Rating must be between 0 and 10'),
  body('description').optional().isLength({ max: 1200 }).withMessage('Description is too long'),
  body('status').optional().isIn(['now_showing', 'upcoming', 'archived']).withMessage('Invalid status'),
  body('releaseDate').optional().isISO8601().withMessage('Release date must be a valid date')
];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
    query('theatre').optional().isMongoId().withMessage('Invalid theatre id'),
    query('q').optional().isLength({ max: 80 })
  ],
  validate,
  ctrl.list
);
router.get('/:id', id, validate, ctrl.get);

// Admin only. multer runs first so multipart form fields are available to the validators.
router.post('/', protect, restrictTo('admin'), upload.single('poster'), rules(false), validate, ctrl.create);
router.put('/:id', protect, restrictTo('admin'), upload.single('poster'), id, rules(true), validate, ctrl.update);
router.delete('/:id', protect, restrictTo('admin'), id, validate, ctrl.remove);

module.exports = router;
