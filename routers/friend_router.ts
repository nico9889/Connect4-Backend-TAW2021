import express = require('express');
import {auth, moderator} from '../utils/auth'
import {checkSentNotification, newNotification, Type} from "../models/Notification";
import * as user from '../models/User';
import {Friend} from "../models/User";
import {io, sessionStore} from "../index";

export const friendRouter = express.Router();


friendRouter.route("/")
    // Get from the database the friends details of the current user
    .get(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        user.getModel().findOne({_id: req.user.id}).then((current_user) => {
            if (!current_user) {
                return next({status: 500, error: true, message: "An error occurred while retrieving friends"});
            }
            user.getModel().find({
                _id: {
                    $in:
                    current_user.friends
                }
            }, {_id: 1, username: 1, avatar: 1})
                .then((friends) => {
                    const out: Friend[] = [];
                    friends.forEach((friend) => {
                        const session = sessionStore.findSession(friend._id.toString());

                        out.push({
                            id: friend._id.toString(),
                            username: friend.username,
                            online: session?.online || false,
                            game: session?.game || '',
                            avatar: friend.avatar
                        });
                    })
                    return res.status(200).json(out);
                })
                .catch((err) => {
                    console.error(err);
                    return next({
                        status: 500,
                        error: true,
                        message: "Generic error occurred while retrieving friends"
                    });
                })

        }).catch((err) => {
            console.error(err);
            return next({
                status: 500,
                error: true,
                message: "Generic error occurred while retrieving friends"
            });
        })
    })
    // Create a new Friend request searching the user by name
    .post(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        user.getModel().findOne({username: req.body.username}).then((receiver) => {
            if (!(req.body.request == true && req.user !== undefined && receiver && receiver._id.toString() !== req.user.id)) {
                return next({status: 500, error: true, message: "Invalid request"});
            }
            newNotification(Type.FRIEND_REQUEST, req.user, receiver._id.toString(), 10);
            io.to(receiver._id.toString()).emit("notification update");
            return res.status(200).json({error: false, message: ""});
        }).catch((e) => {
            console.error(e);
            return next({status: 404, error: true, message: "User not found"});
        })
    })
    // Accept or refuse the friend request. If accepted the users (sender/receiver of the request) will be added to the friends list each other
    .put(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (req.body.notification.receiver !== req.user.id || req.body.notification.sender === req.body.notification.receiver) {
            return next({status: 403, error: true, message: "This request doesn't belong to you!"});
        }

        if (!checkSentNotification(req.user, req.body.notification)) {
            return next({
                status: 403,
                error: true,
                message: "The invite that you are trying to accept doesn't exist or is expired"
            });
        }

        // Invite is already deleted from memory by checkSentNotification, so we just need to inform the user
        if (req.body.accept !== true) {
            return res.status(200).json({error: false, message: ""});
        }

        user.getModel().findOne({_id: req.body.notification.sender}).then((sender) => {
            user.getModel().findOne({_id: req.body.notification.receiver}).then((receiver) => {
                if (!sender || !receiver) {
                    return next({status: 404, error: true, message: "Cannot find the requested resource"});
                }

                if (sender.friends.includes(receiver._id) || receiver.friends.includes(sender._id)) {
                    return next({status: 403, error: true, message: "You are already friend!"});
                }
                sender.friends.push(receiver._id);
                receiver.friends.push(sender._id);
                sender.save();
                receiver.save();
                return res.status(200).json({error: false, message: ""});
            });
        });
    })

// Send back the friend details only if the user asking if friend of the user asked for
friendRouter.route("/:id")
    .get(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error"});
        }
        user.getModel().findOne({_id: req.user.id}).then((currentUser) => {
            if (!currentUser) {
                return next({status: 500, error: true, message: "Generic error"});
            }

            const friendId = currentUser.friends.find((id) => {
                return id.toString() === req.params.id;
            });

            if (!friendId) {
                return next({status: 403, error: true, message: "User is not your friend"});
            }

            user.getModel().findOne({_id: friendId}).then((user) => {
                if (!user) {
                    return next({status: 500, error: true, message: "Generic error"});
                }
                const session = sessionStore.findSession(user._id.toString());
                const friend: Friend = {
                    id: user.id,
                    username: user.username,
                    online: session?.online || false,
                    game: session?.game || '',
                    avatar: user.avatar
                };
                return res.status(200).json(friend);
            })
        }).catch(
            (err) => {
                console.error(err);
                return next({status: 500, error: true, message: "Generic error"});
            }
        )
    })
    // TODO: remove friendship
    .delete(auth, moderator, (req, res, next) => {

    })
