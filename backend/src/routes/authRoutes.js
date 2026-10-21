const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const email = body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address');

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2 to 60 characters'),
    email,
    body('password')
      .isLength({ min: 8, max: 72 }).withMessage('Password must be 8 to 72 characters')
      .matches(/[A-Za-z]/).withMessage('Password needs at least one letter')
      .matches(/\d/).withMessage('Password needs at least one number')
  ],
  validate,
  ctrl.register
);

router.post('/login', authLimiter, [email, body('password').isString().notEmpty().withMessage('Password is required')], validate, ctrl.login);

router.get('/me', protect, ctrl.me);

module.exports = router;
