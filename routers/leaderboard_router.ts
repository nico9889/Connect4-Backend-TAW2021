import express = require('express');

import * as user from '../models/User';

export let leaderboardRouter = express.Router();

interface LeaderBoardUser {
    username: string,
    ratio: number
}

leaderboardRouter.get("/", (req, res, next) => {
    let leaderboard: LeaderBoardUser[] = [];
    user.getModel().find({}, {digest: 0, salt: 0})
        .then((users) => {
            for (let user of users) {
                leaderboard.push({
                    username: user.username,
                    ratio: user.victories / (user.defeats+1)
                })
            }
            leaderboard.sort((a, b) => {
                return a.ratio - b.ratio;
            })
            return res.status(200).json(leaderboard.slice(0, 9));
        })
        .catch((exception) => {
            console.log(exception);
            return next({status: 500, error: true, message: ""});
        })
});
