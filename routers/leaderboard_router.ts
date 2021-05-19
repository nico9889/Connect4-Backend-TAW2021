import express = require('express');

import * as user from '../models/User';

export const leaderboardRouter = express.Router();

interface LeaderBoardUser {
    username: string,
    ratio: number,
    victories: number,
    defeats: number
}

// Get the public leaderboard
leaderboardRouter.get("/", (req, res, next) => {
    const leaderboard: LeaderBoardUser[] = [];
    user.getModel().find({}, {digest: 0, salt: 0})
        .then((users) => {
            for (const user of users) {
                leaderboard.push({
                    username: user.username,
                    ratio: user.victories / (user.defeats + 1),
                    victories: user.victories,
                    defeats: user.defeats
                })
            }
            leaderboard.sort((a, b) => {
                return b.ratio - a.ratio;
            })
            return res.status(200).json(leaderboard.slice(0, 9));
        })
        .catch((exception) => {
            console.log(exception);
            return next({status: 500, error: true, message: ""});
        })
});
