const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/theatreController');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const id = param('id').isMongoId().withMessage('Invalid theatre id');
const opt = (chain, optional) => (optional ? chain.optional() : chain);

const rules = (optional) => [
  opt(body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Theatre name is required'), optional),
  opt(body('city').trim().notEmpty().withMessage('City is required'), optional),
  body('address').optional().isLength({ max: 200 }),
  opt(body('screens').isArray({ min: 1, max: 20 }).withMessage('Add at least one screen'), optional),
  body('screens.*.name').optional().trim().notEmpty().withMessage('Each screen needs a name'),
  body('screens.*.format').optional().trim()
];

router.get('/', ctrl.list);
router.get('/:id', id, validate, ctrl.get);
router.post('/', protect, restrictTo('admin'), rules(false), validate, ctrl.create);
router.put('/:id', protect, restrictTo('admin'), id, rules(true), validate, ctrl.update);
router.delete('/:id', protect, restrictTo('admin'), id, validate, ctrl.remove);

module.exports = router;
