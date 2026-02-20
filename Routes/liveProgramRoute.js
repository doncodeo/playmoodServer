const express = require('express');
const router = express.Router();
const {
    getTodaysProgramming,
    createLiveProgram,
    updateLiveProgram,
    deleteLiveProgram,
} = require('../controllers/liveProgramController');
const { protect, admin } = require('../middleware/authmiddleware');

/**
 * @swagger
 * tags:
 *   name: LivePrograms
 *   description: API for managing PlaymoodTV LIVE programming
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LiveProgram:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The unique identifier for the live program.
 *           example: "665f7a4b1f8d3c1e8f0a3b8c"
 *         contentId:
 *           type: string
 *           description: The ID of the content being streamed.
 *           example: "65a6fc7b72128447ad32024e"
 *         title:
 *           type: string
 *           description: The title of the program.
 *           example: "Morning Coffee Tech Talks"
 *         description:
 *           type: string
 *           description: A short description of the program.
 *           example: "Join us for a daily dose of the latest in tech."
 *         thumbnail:
 *           type: string
 *           format: uri
 *           description: URL of the program's thumbnail image.
 *           example: "https://res.cloudinary.com/.../thumbnail.jpg"
 *         date:
 *           type: string
 *           format: date
 *           description: The date of the broadcast in YYYY-MM-DD format.
 *           example: "2024-06-04"
 *         startTime:
 *           type: string
 *           description: The start time of the broadcast in HH:mm format (24-hour).
 *           example: "09:00"
 *         endTime:
 *           type: string
 *           description: The calculated end time of the broadcast in HH:mm format.
 *           example: "10:00"
 *         scheduledStart:
 *           type: string
 *           format: date-time
 *           description: The absolute UTC start time of the program.
 *         scheduledEnd:
 *           type: string
 *           format: date-time
 *           description: The absolute UTC end time of the program.
 *         duration:
 *           type: number
 *           description: The duration of the program in seconds.
 *           example: 3600
 *         status:
 *           type: string
 *           enum: [scheduled, live, ended]
 *           description: The current status of the program.
 *           example: "scheduled"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the program was created.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the program was last updated.
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/live-programs/today:
 *   get:
 *     summary: Get today's programming schedule
 *     description: |
 *       Retrieves the schedule for the current day.
 *       - **Only approved content** is returned in the schedule.
 *       - `liveProgram`: The program that is currently on air. This object will include a `currentPlaybackTime` field, which represents the number of seconds into the video the broadcast currently is (the "live edge"). The client-side player should not allow seeking beyond this point.
 *       - `upcomingPrograms`: A list of programs scheduled to air later today.
 *       This endpoint is timezone-robust and handles transitions (scheduled -> live -> ended) automatically based on UTC time.
 *     tags: [LivePrograms]
 *     responses:
 *       200:
 *         description: Today's schedule retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 liveProgram:
 *                   $ref: '#/components/schemas/LiveProgram'
 *                   nullable: true
 *                   properties:
 *                      currentPlaybackTime:
 *                          type: number
 *                          description: The current playback position in seconds from the start of the video.
 *                          example: 900.5
 *                 upcomingPrograms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LiveProgram'
 *             examples:
 *               liveAndUpcoming:
 *                 summary: A program is currently live
 *                 value:
 *                   liveProgram:
 *                     _id: "665f7a4b1f8d3c1e8f0a3b8c"
 *                     contentId: "65a6fc7b72128447ad32024e"
 *                     title: "Morning Coffee Tech Talks"
 *                     description: "Join us for a daily dose of the latest in tech."
 *                     thumbnail: "https://res.cloudinary.com/.../thumbnail.jpg"
 *                     date: "2024-06-05"
 *                     startTime: "09:00"
 *                     endTime: "10:00"
 *                     duration: 3600
 *                     status: "live"
 *                     currentPlaybackTime: 900.5
 *                   upcomingPrograms:
 *                     - _id: "665f7a4b1f8d3c1e8f0a3b8d"
 *                       contentId: "65a8025e3af4e7929b379e7b"
 *                       title: "Deep Dive into AI"
 *                       description: "Exploring the future of artificial intelligence."
 *                       thumbnail: "https://res.cloudinary.com/.../thumbnail2.jpg"
 *                       date: "2024-06-05"
 *                       startTime: "11:00"
 *                       endTime: "11:30"
 *                       duration: 1800
 *                       status: "scheduled"
 *               nothingLive:
 *                 summary: No program is currently live
 *                 value:
 *                   liveProgram: null
 *                   upcomingPrograms:
 *                     - _id: "665f7a4b1f8d3c1e8f0a3b8d"
 *                       contentId: "65a8025e3af4e7929b379e7b"
 *                       title: "Deep Dive into AI"
 *                       description: "Exploring the future of artificial intelligence."
 *                       thumbnail: "https://res.cloudinary.com/.../thumbnail2.jpg"
 *                       date: "2024-06-05"
 *                       startTime: "11:00"
 *                       endTime: "11:30"
 *                       duration: 1800
 *                       status: "scheduled"
 *       500:
 *         description: Server error
 */
router.route('/today').get(getTodaysProgramming);

/**
 * @swagger
 * /api/live-programs:
 *   post:
 *     summary: Create a new live program (Admin only)
 *     description: Schedules a new video for a specific date and time. The end time and duration are calculated automatically.
 *     tags: [LivePrograms]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *               - date
 *               - startTime
 *             properties:
 *               contentId:
 *                 type: string
 *                 description: The ID of the content to be scheduled.
 *                 example: "65a6fc7b72128447ad32024e"
 *               date:
 *                 type: string
 *                 format: date
 *                 description: The date for the program (YYYY-MM-DD).
 *                 example: "2024-06-05"
 *               startTime:
 *                 type: string
 *                 description: The start time for the program (HH:mm).
 *                 example: "14:30"
 *     responses:
 *       201:
 *         description: Live program created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LiveProgram'
 *             example:
 *               _id: "665f8a4b1f8d3c1e8f0a3b8f"
 *               contentId: "65a6fc7b72128447ad32024e"
 *               title: "Live Test Video"
 *               description: "A video for live testing."
 *               thumbnail: "https://res.cloudinary.com/test/video.jpg"
 *               date: "2024-06-05"
 *               startTime: "14:30"
 *               endTime: "15:30"
 *               duration: 3600
 *               status: "scheduled"
 *               createdAt: "2024-06-05T14:30:00.000Z"
 *               updatedAt: "2024-06-05T14:30:00.000Z"
 *       400:
 *         description: Bad request (e.g., missing fields, invalid ID, or content missing Cloudinary ID).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               missingFields:
 *                 summary: Missing required fields
 *                 value:
 *                   error: "Missing required fields: contentId, date, startTime"
 *               invalidContent:
 *                 summary: Content is missing a Cloudinary ID
 *                 value:
 *                   error: "The selected video content is missing a Cloudinary ID and cannot be scheduled."
 *       401:
 *         description: Unauthorized (not logged in).
 *       403:
 *         description: Forbidden (user is not an admin).
 *       404:
 *         description: Video content not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Video content not found"
 *       500:
 *         description: Server error.
 */
router.route('/').post(protect, admin, createLiveProgram);

/**
 * @swagger
 * /api/live-programs/{id}:
 *   put:
 *     summary: Update a live program (Admin only)
 *     description: Updates the schedule for an existing live program. You can change the date, start time, or the associated video.
 *     tags: [LivePrograms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the live program to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contentId:
 *                 type: string
 *                 description: (Optional) The new content ID for the program.
 *                 example: "65a8025e3af4e7929b379e7b"
 *               date:
 *                 type: string
 *                 format: date
 *                 description: (Optional) The new date for the program (YYYY-MM-DD).
 *                 example: "2024-06-05"
 *               startTime:
 *                 type: string
 *                 description: (Optional) The new start time for the program (HH:mm).
 *                 example: "15:00"
 *     responses:
 *       200:
 *         description: Live program updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LiveProgram'
 *             example:
 *               _id: "665f8a4b1f8d3c1e8f0a3b8f"
 *               contentId: "65a8025e3af4e7929b379e7b"
 *               title: "Updated Live Video Title"
 *               description: "Updated description."
 *               thumbnail: "https://res.cloudinary.com/test/video_new.jpg"
 *               date: "2024-06-05"
 *               startTime: "15:00"
 *               endTime: "16:00"
 *               duration: 3600
 *               status: "scheduled"
 *       400:
 *         description: Bad request (e.g., invalid ID).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Live program or video not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Live program not found"
 *       500:
 *         description: Server error.
 *   delete:
 *     summary: Delete a live program (Admin only)
 *     description: Removes a scheduled program from the PlaymoodTV LIVE schedule.
 *     tags: [LivePrograms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the live program to delete.
 *     responses:
 *       200:
 *         description: Live program deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Live program deleted successfully"
 *       400:
 *         description: Bad request (e.g., invalid ID).
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Live program not found.
 *       500:
 *         description: Server error.
 */
router.route('/:id')
    .put(protect, admin, updateLiveProgram)
    .delete(protect, admin, deleteLiveProgram);


module.exports = router;
