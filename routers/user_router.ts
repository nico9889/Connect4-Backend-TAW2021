import express = require('express');

import * as user from '../models/User';
import {auth, moderator} from '../utils/auth'
import {Role} from "../models/User";

export const userRouter = express.Router();

// Get all the users
userRouter.get("/", auth, moderator, (req, res, next) => {
    user.getModel().find({}, {digest: 0, salt: 0})
        .then((users) => {
            if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
                return next({status: 403, error: true, message: "You are not authorized to access this resource"});
            }
            return res.status(200).json(users);
        })
        .catch((err) => {
            console.error(err);
            return next({status: 500, error: true, message: ""});
        })
});

userRouter.route("/:user_id")
    // Get the requested user
    .get(auth, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && req.user.id !== req.params.user_id) {
            return next({status: 403, error: true, message: "You are not authorized to access this resource"});
        }

        if (req.user.registered_on === req.user.last_password_change) {
            return next({status: 403, error: true, message: "You must change your password before"});
        }

        // @ts-ignore
        user.getModel().findOne({_id: req.params.user_id}, {digest: 0, salt: 0}).then((user) => {
            if (!user) {
                return next({status: 404, error: true, message: "User not found"});
            }
            return res.status(200).json(user);
        }).catch((e) => {
            console.error(e);
            return next({status: 404, error: true, message: "User not found"});
        });
    })
    // Update a user
    .put(auth, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }


        if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && req.user.id !== req.params.user_id) {
            return next({status: 403, error: true, message: "You are not authorized to access this resource"});
        }

        // @ts-ignore
        user.getModel().findOne({_id: req.params.user_id}).then((u) => {
            if (!u) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }

            if (typeof req.body.enabled === "boolean") {
                u.enabled = req.body.enabled;
            }

            if (req.body.avatar) {
                u.avatar = req.body.avatar;
            }

            if (req.body.oldPassword && req.body.newPassword) {
                if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(req.body.newPassword)) {
                    return next({
                        status: 403,
                        error: true,
                        message: "Must contain at least one number and one uppercase and lowercase letter, and at least 8 or more characters"
                    });
                }
                if (!u.validatePassword(req.body.oldPassword)) {
                    return next({status: 403, error: true, message: "Invalid old password"});
                }
                u.setPassword(req.body.newPassword);
            }
            u.save();
            return res.status(200).json({error: false, message: ""});
        }).catch((e) => {
            console.error(e);
            return next({status: 500, error: true, message: "An error has occurred"});
        });
    })
    // Delete a user FIXME: when a user it should be removed from friends
    .delete(auth, moderator, (req, res, next) => {
        // @ts-ignore Mongoose can do the correct cast by itself
        user.getModel().findOne({_id: req.params.user_id}).then((target) => {
            if(!target){
                return next({status: 500, error: true, message: "Generic error occurred"});
            }
            if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && !target.hasRole(Role.ADMIN)) {
                return next({status: 403, error: true, message: "You are not authorized to access this resource"});
            }
            target.delete();
            return res.status(200).json({error: false, message: ""});
        }).catch((e) => {
            console.error(e);
            return next({status: 500, error: true, message: "An error has occurred"});
        });
    });
