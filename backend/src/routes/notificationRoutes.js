const router = require('express').Router();
const { param } = require('express-validator');
const ctrl = require('../controllers/notificationController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.list);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', param('id').isMongoId().withMessage('Invalid notification id'), validate, ctrl.markRead);

module.exports = router;
