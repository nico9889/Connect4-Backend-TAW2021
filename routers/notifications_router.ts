import express = require('express');
import {auth} from '../auth'
import {getNotifications} from "../models/Notification";

export let notificationsRouter = express.Router();

notificationsRouter.get("/", auth, (req, res, next) => {
    if (req.user) {
        let notifications = getNotifications(req.user);
        res.status(200).json(notifications);
    }
})
