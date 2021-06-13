import express = require('express');
import {auth, moderator} from "../utils/auth";
import * as user from "../models/User";
import {Role} from "../models/User";
import {query, validationResult} from "express-validator";

export const users2Router = express.Router();

// Get all the users
users2Router.get("/", auth, moderator,
    query('friends').optional().isBoolean(),
    (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: 'Generic error occurred'});
        }
        if (!validationResult(req).isEmpty()) {
            return next({status: 500, error: true, message: 'Invalid parameters'});
        }
        if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && !req.query.friends) {
            user.getModel().find({}, {digest: 0, salt: 0, avatar:0}).then((users) => {
                return res.status(200).json(users);
            }).catch((err) => {
                console.error(err);
                return next({status: 500, error: true, message: 'Generic error occurred'})
            })
        } else {
            user.getModel().findOne({_id: req.user.id}).populate('friends', '_id username victories defeats').then((currentUser) => {
                if (!currentUser) {
                    return next({status: 500, error: true, message: 'Generic error occurred'});
                }
                return res.status(200).json(currentUser.friends);
            }).catch((err) => {
                console.error(err);
                return next({status: 500, error: true, message: 'Generic error occurred'})
            })
        }
    })
;
