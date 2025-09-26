const asyncHandler = require('express-async-handler');
const RoleChangeRequest = require('../models/roleChangeModel');
const User = require('../models/userModel');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });

// @desc Request role change to creator
// @route POST /api/rolechange
// @access Private

const requestRoleChange = asyncHandler(async (req, res) => {
    try {
        const { userId, requestedRole } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if there is already an approved request
        const existingApprovedRequest = await RoleChangeRequest.findOne({ user: userId, status: 'approved' });
        if (existingApprovedRequest) {
            return res.status(400).json({ error: 'Role change request already approved, cannot request again' });
        }

        // Check if the user already has a pending application
        if (user.creatorApplicationStatus === 'pending') {
            return res.status(400).json({ error: 'You already have a pending application.' });
        }

        const newRequest = await RoleChangeRequest.create({
            user: userId,
            requestedRole
        });

        // Update user's creatorApplicationStatus to 'pending'
        user.creatorApplicationStatus = 'pending';
        await user.save();

        // Fetch admin users
        const admins = await User.find({ role: 'admin' });

        // Send email to all admins
        admins.forEach(admin => {
            const mailOptions = {
                from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
                to: admin.email,
                subject: 'New Role Change Request',
                html: `
                    <html>
                        <head>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    background-color: #f0f0f0;
                                    color: #333;
                                    padding: 20px;
                                }
                                .container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    background-color: #ffffff;
                                    padding: 20px;
                                    border-radius: 8px;
                                    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                                }
                                .header {
                                    background-color: tomato;
                                    color: white;
                                    padding: 10px;
                                    text-align: center;
                                    border-top-left-radius: 8px;
                                    border-top-right-radius: 8px;
                                }
                                .content {
                                    padding: 20px;
                                }
                                .footer {
                                    margin-top: 20px;
                                    text-align: center;
                                    color: #666;
                                    font-size: 12px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h2>New Role Change Request</h2>
                                </div>
                                <div class="content">
                                    <p>Dear ${admin.name},</p>
                                    <p>User ${user.name} has requested to change their role to ${requestedRole}.</p>
                                    <p>Please log in to the admin panel to review and approve/reject the request.</p>
                                </div>
                                <div class="footer">
                                    <p>Best regards,</p>
                                    <p>The PlaymoodTV Team</p>
                                </div>
                            </div>
                        </body>
                    </html>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Error sending email:", error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        });

        res.status(201).json(newRequest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc Get all pending role change requests
// @route GET /api/role-change-requests
// @access Private (Admin only)
const getPendingRoleChangeRequests = asyncHandler(async (req, res) => {
    try {
        const requests = await RoleChangeRequest.find({ status: 'pending' }).populate('user', 'name email');
        res.status(200).json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc Approve or reject role change request
// @route PUT /api/role-change-request/:id
// @access Private (Admin only)

const approveRoleChange = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const request = await RoleChangeRequest.findById(id).populate('user');
    if (!request) {
        return res.status(404).json({ error: 'Role change request not found' });
    }

    // Check if the user's role is already the requested role
    if (request.user.role === request.requestedRole) {
        return res.status(400).json({ error: 'User already has the requested role' });
    }

    // Check if there are any other pending role change requests for this user
    const pendingRequests = await RoleChangeRequest.find({ user: request.user._id, status: 'pending' });

    if (pendingRequests.length > 1) {
        return res.status(400).json({ error: 'User already has a pending role change request' });
    }

    request.status = status;
    await request.save();

    // Update user role if approved
    if (status === 'approved') {
        request.user.role = request.requestedRole;
        request.user.creatorApplicationStatus = 'approved';
        await request.user.save();
    } else if (status === 'rejected') {
        request.user.creatorApplicationStatus = 'rejected';
        await request.user.save();
    }

    // Send email notification to the user
    const mailOptions = {
        from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
        to: request.user.email,
        subject: 'Role Change Request Update',
        html: `
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f0f0f0;
                            color: #333;
                            padding: 20px;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            background-color: #ffffff;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            background-color: tomato;
                            color: white;
                            padding: 10px;
                            text-align: center;
                            border-top-left-radius: 8px;
                            border-top-right-radius: 8px;
                        }
                        .content {
                            padding: 20px;
                        }
                        .footer {
                            margin-top: 20px;
                            text-align: center;
                            color: #666;
                            font-size: 12px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Role Change Request Update</h2>
                        </div>
                        <div class="content">
                            <p>Dear ${request.user.name},</p>
                            <p>Your request to change your role to ${request.requestedRole} has been ${status}.</p>
                            <p>Thank you for your patience.</p>
                        </div>
                        <div class="footer">
                            <p>Best regards,</p>
                            <p>The PlaymoodTV Team</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
        } else {
            console.log('Email sent:', info.response);
        }
    });

    res.status(200).json(request);
});


module.exports = {
    requestRoleChange,
    getPendingRoleChangeRequests,
    approveRoleChange
};
