import express = require('express');

import * as user from '../models/User';
import {auth, moderator} from '../utils/auth'
import {Role} from "../models/User";
import {body, validationResult} from "express-validator";
import multer = require('multer')
import {Request} from "express";
import {FileFilterCallback} from "multer";
import path from "path";

export const userRouter = express.Router();
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: validateAvatar,
    limits: {
        fields: 1,
        files: 1,
        fileSize: 1500000, // 1.5 MB
    },
})

function validateAvatar(req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        console.error("Invalid image");
        return cb(null, false);
    }
}

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

userRouter.route("/:user_id/avatar")
    .get(auth, moderator, (req, res, next) => {
        if(!req.user){
            return next({status:500, error:true, message:"Generic error occurred"});
        }
        user.getModel().findOne({_id:req.params.user_id}).then((u) => {
            if(!u){
                return next({status:404, error:true, message: "User not found"});
            }
            if(!u.avatar){
                return res.status(200).json({});
            }
            return res.status(200).json({avatar:u.avatar});
        }).catch((err) => {
            console.error(err);
            return next({status:500, error:true, message: "Error while retrieving user data"})
        })
    })
    .post(auth, moderator, upload.single('avatar'), (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && req.user.id !== req.params.user_id) {
            return next({status: 403, error: true, message: "You are not authorized to access this resource"});
        }

        if (!req.file) {
            return next({status: 500, error: true, message: "Error while uploading file"});
        }

        user.getModel().findOne({_id:req.params.user_id}).then((u) => {
            if(!u){
                return next({status:404, error:true, message: "User not found"});
            }
            u.avatar = "data:" + req.file.mimetype + ";base64," + req.file.buffer.toString("base64");
            u.save();
            return res.status(200).json({error: false, message: ''});
        }).catch((err) => {
            console.error(err);
            return next({status:500, error:true, message: "Generic error occurred"});
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
    .put(auth,
        body('enabled', "Must be a boolean value").optional().isBoolean(),
        body('newPassword', "Must contain at least 8 characters, 1 uppercase, 1 lowercase and 1 number").optional().isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minNumbers: 1,
            minUppercase: 1
        }),
        (req, res, next) => {
            if (!req.user) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }

            if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && req.user.id !== req.params.user_id) {
                return next({status: 403, error: true, message: "You are not authorized to access this resource"});
            }

            // FIXME: password is not validated correctly
            const result = validationResult(req);
            if (!result.isEmpty()) {
                const messages = [];
                for (let val of result.array()) {
                    messages.push(val.msg);
                }
                console.log(result.array())
                return next({status: 403, error: true, message: messages})
            }

            user.getModel().findOne({_id: req.params.user_id}).then((u) => {
                if (!u) {
                    return next({status: 500, error: true, message: "Generic error occurred"});
                }

                if (req.body.oldPassword && req.body.newPassword) {
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
    // Delete a user FIXME: test if user delete works and get removed from friends
    .delete(auth, moderator, (req, res, next) => {
        user.getModel().findOne({_id: req.params.user_id}).populate('friends').then((target) => {
            if (!target) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }
            if (!user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && !target.hasRole(Role.ADMIN)) {
                return next({status: 403, error: true, message: "You are not authorized to access this resource"});
            }
            for (const friend of target.friends) {
                const index = friend.friends.indexOf(target);
                if (index > -1) {
                    friend.friends.splice(index, 1);
                }
                friend.save();
            }
            target.delete();
            return res.status(200).json({error: false, message: ""});
        }).catch((e) => {
            console.error(e);
            return next({status: 500, error: true, message: "An error has occurred"});
        });
    });
