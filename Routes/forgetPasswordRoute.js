const express = require("express");
const { forgetPassword } = require("../controllers/userController");

const router = express.Router();

router.post("/forget-password", forgetPassword);

module.exports = router;
