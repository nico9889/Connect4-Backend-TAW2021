import express from 'express';
import {auth, moderator} from '../utils/auth'
import {getNotifications} from "../models/Notification";

export const notificationsRouter = express.Router();

// Get all the notifications
notificationsRouter.get("/", auth, moderator, (req, res, next) => {
    if (!req.user) {
        return next({status: 500, error: true, message: "Generic error occurred"});
    }
    const notifications = getNotifications(req.user);
    res.status(200).json(notifications);
})
