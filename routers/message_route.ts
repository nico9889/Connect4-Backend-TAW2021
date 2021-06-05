import express = require('express');
import {auth, moderator} from '../utils/auth'

import * as user from '../models/User';
import * as message from '../models/Message'

import {Role} from "../models/User";
import {io, sessionStore} from "../index";
import {newNotification, Type} from "../models/Notification";
import {query, validationResult} from "express-validator"

export const messageRouter = express.Router();

messageRouter.route('/:id')
    // Get private messages
    .get(auth, moderator,
        query("limit", "Must be a positive integer value greater than 0.").optional().isInt({min: 1}),
        (req, res, next) => {
            if (!req.user) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }
            let limit = 50;
            try {
                validationResult(req).throw()
                if (req.query.limit) {
                    limit = parseInt(req.query.limit as string);
                }
            } catch (err) {
                console.error(err);
                limit = 50;
            }

            message.getModel()
                .find({
                    sender: {
                        $in: [req.user.id, req.params.id]
                    },
                    receiver: {
                        $in: [req.user.id, req.params.id]
                    }
                }, {onModel: 0})
                .sort("-datetime")
                .limit(limit)
                .then((messages) => {
                    if (!messages) {
                        return next({status: 404, error: true, errormessage: 'Messages not found'});
                    }
                    console.log(messages);
                    return res.status(200).json(messages);
                })
                .catch((err) => {
                    console.log(err);
                    return next({status: 500, error: true, errormessage: 'Generic error occurred. Try again later!'});
                })
        })
    // Send a new private message
    .post(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (req.body.message.content.trim() === '') {
            return next({status: 403, error: true, errormessage: 'Message cannot be empty!'});
        }

        user.getModel().findOne({_id: req.user.id}).then((currentUser) => {
            if (!currentUser || !req.user) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }

            const dest = currentUser.friends.find((id) => {
                return id.toString() === req.params.id;
            })

            if (!dest && !user.checkRoles(req.user, [Role.ADMIN, Role.MODERATOR])) {
                return next({status: 403, error: true, message: 'User is not your friend!'});
            }

            const mess = message.newMessage(req.user.id, req.params.id, message.Type.User, req.body.message.content);
            mess.save().then(() => {
                if (req.user) {
                    io.to(req.params.id).emit('private message', {
                        from: req.user.id
                    })
                }
                newNotification(Type.PRIVATE_MESSAGE, req.user, req.params.id, 10);
                if (sessionStore.findSession(req.params.id)) {
                    io.to(req.params.id).emit('notification update', {});
                }
                return res.status(200).json({error: false, errormessage: ''});
            }).catch((err) => {
                console.log(err);
                return next({status: 500, error: true, errormessage: 'Error while saving the message'});
            })
        }).catch((err) => {
            console.error(err);
            return next({status: 500, error: true, errormessage: 'Generic error occurred. Try again later!'});
        })
    })
