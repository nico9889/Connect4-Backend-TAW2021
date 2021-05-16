import express = require('express');
import {auth, moderator} from '../utils/auth'
import {getNotifications} from "../models/Notification";

export let notificationsRouter = express.Router();

// Get all the notifications
notificationsRouter.get("/", auth, moderator, (req, res) => {
    if (req.user) {
        let notifications = getNotifications(req.user);
        res.status(200).json(notifications);
    }
})
