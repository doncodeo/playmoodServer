const express = require('express');
const router = express.Router();
const { requestRoleChange, getPendingRoleChangeRequests, approveRoleChange } = require('../controllers/roleChangeController');
const { protect, admin } = require('../middleware/authmiddleware');

router.route('/')
    .get(getPendingRoleChangeRequests)
    .post(requestRoleChange)

router.route('/:id')
    .put(approveRoleChange)


module.exports = router;
