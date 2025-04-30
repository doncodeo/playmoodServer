const express = require('express');
const router = express.Router();
const { requestRoleChange, getPendingRoleChangeRequests, approveRoleChange } = require('../controllers/roleChangeController');
const { protect, admin } = require('../middleware/authmiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     RoleChangeRequest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a9fc7b72128447ad32024f
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 65a8025e3af4e7929b379e7b
 *             name:
 *               type: string
 *               example: John Doe
 *             email:
 *               type: string
 *               example: john@example.com
 *         requestedRole:
 *           type: string
 *           example: creator
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           example: pending
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 */

/**
 * @swagger
 * /api/rolechange:
 *   post:
 *     summary: Request role change
 *     description: Submits a role change request for a user (e.g., to become a creator). Sends email notifications to admins.
 *     tags: [RoleChange]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7b
 *                 description: ID of the user requesting the role change
 *               requestedRole:
 *                 type: string
 *                 example: creator
 *                 description: The requested role
 *     responses:
 *       201:
 *         description: Role change request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleChangeRequest'
 *       400:
 *         description: Role change request already approved or invalid request
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/').post(protect, requestRoleChange);

/**
 * @swagger
 * /api/rolechange:
 *   get:
 *     summary: Get all pending role change requests
 *     description: Retrieves a list of all pending role change requests, populated with user details (name and email). Admin-only.
 *     tags: [RoleChange]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending role change requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RoleChangeRequest'
 *       500:
 *         description: Server error
 */
router.route('/').get(protect, admin, getPendingRoleChangeRequests);

/**
 * @swagger
 * /api/rolechange/{id}:
 *   put:
 *     summary: Approve or reject role change request
 *     description: Updates the status of a role change request (approve or reject) and updates the user's role if approved. Sends email notification to the user. Admin-only.
 *     tags: [RoleChange]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the role change request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: approved
 *                 description: The new status of the request
 *     responses:
 *       200:
 *         description: Role change request updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleChangeRequest'
 *       400:
 *         description: User already has the requested role or has another pending request
 *       404:
 *         description: Role change request not found
 *       500:
 *         description: Server error
 */
router.route('/:id').put(protect, admin, approveRoleChange);

module.exports = router; 












// const express = require('express');
// const router = express.Router();
// const { requestRoleChange, getPendingRoleChangeRequests, approveRoleChange } = require('../controllers/roleChangeController');
// const { protect, admin } = require('../middleware/authmiddleware');

// router.route('/')
//     .get(getPendingRoleChangeRequests)
//     .post(requestRoleChange)

// router.route('/:id')
//     .put(approveRoleChange)


// module.exports = router;
