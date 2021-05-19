import express = require('express');
import {auth, moderator} from '../utils/auth'
import {checkSentNotification, newNotification, Type} from "../models/Notification";
import * as user from '../models/User';
import * as game from '../models/Game';
import * as message from '../models/Message';
import {io, sessionStore} from "../index";

export let gameRouter = express.Router();

export enum Coin {
    None,
    Red,    // Player One
    Yellow  // Player Two
}

// Game board class, track the progress of the game
class Board {
    private readonly board: Coin[][];
    private remainingMoves = 6 * 7;

    constructor() {
        this.board = [
            [Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None],
            [Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None],
            [Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None],
            [Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None],
            [Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None],
            [Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None, Coin.None],
        ]
    }

    // Put a coin into the board, return false if the move is invalid
    put(x: number, coin: Coin): boolean {
        if (x >= 0 && x < this.board[0].length) {
            let y = this.board.length - 1;
            while (y > 0 && this.board[y][x] !== Coin.None) {
                y--;
            }
            if (y >= 0) {
                this.board[y][x] = coin;
                this.remainingMoves -= 1;
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    // Board getter
    get(): Coin[][] {
        return this.board;
    }

    // Get remaining moves, if 0 the game probably ended with a tie
    getRemainingMoves() {
        return this.remainingMoves;
    }

    /**
     * Credit: https://codereview.stackexchange.com/questions/127091/java-connect-four-four-in-a-row-detection-algorithms
     */
    checkWinner(): Coin {
        const HEIGHT = this.board.length;
        const WIDTH = this.board[0].length;
        for (let r = 0; r < HEIGHT; r++) { // iterate rows, bottom to top
            for (let c = 0; c < WIDTH; c++) { // iterate columns, left to right
                let winner = this.board[r][c];
                if (winner != Coin.None) {
                    if (c + 3 < WIDTH &&
                        winner == this.board[r][c + 1] && // look right
                        winner == this.board[r][c + 2] &&
                        winner == this.board[r][c + 3])
                        return winner;
                    if (r + 3 < HEIGHT) {
                        if (winner == this.board[r + 1][c] && // look up
                            winner == this.board[r + 2][c] &&
                            winner == this.board[r + 3][c])
                            return winner;
                        if (c + 3 < WIDTH &&
                            winner == this.board[r + 1][c + 1] && // look up & right
                            winner == this.board[r + 2][c + 2] &&
                            winner == this.board[r + 3][c + 3])
                            return winner;
                        if (c - 3 >= 0 &&
                            winner == this.board[r + 1][c - 1] && // look up & left
                            winner == this.board[r + 2][c - 2] &&
                            winner == this.board[r + 3][c - 3])
                            return winner;
                    }
                }
            }
        }
        return Coin.None;
    }
}

// Struct containing information about the match
// Game information (players, winner, start date, end date, final board) are stored permanently
// Game status is only stored into RAM, if the server restart the game can't be resumed
interface GameInfo {
    game: game.Game;
    board: Board;
    playerOneTurn: boolean;
    spectators: string[];
}

// FIXME: this is constantly growing while new games are started.
const games: Map<String, GameInfo> = new Map<String, GameInfo>();

gameRouter.route('/invite')
    // Create a new game invitation if current user and invited user are friends
    .post(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        // @ts-ignore Mongoose is casting automatically
        user.getModel().findOne({_id: req.user.id})
            .then((currentUser) => {
                if (!currentUser) {
                    return next({status: 500, error: true, message: "Generic error occurred"});
                }
                const dest = currentUser.friends.find((id) => {
                    return id.toString() === req.body.id;
                })
                if (!dest) {
                    return next({status: 403, error: true, message: "User is not your friend"});
                }
                newNotification(Type.GAME_INVITE, req.user, dest.toString(), 10);
                if (sessionStore.findSession(dest.toString())) {
                    io.to(dest.toString()).emit("notification update");
                }
                return res.status(200).json({error: false, message: ""});
            })
            .catch((e) => {
                console.error(e);
                return next({status: 500, error: true, message: "Error occurred while retrieving user"});
            })
    })
    // Respond to the notification, if the invited user accepted a new game is created
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
        if (req.body.accept !== true) {
            return res.status(200).json({});
        }
        // @ts-ignore
        user.getModel().findOne({_id: req.body.notification.receiver}).then((currentUser) => {
            user.getModel().findOne({_id: req.body.notification.sender}).then((sender) => {
                if (!currentUser || !sender) {
                    return next({status: 500, error: true, message: "Generic error occurred"});
                }

                // We pick randomly the user that has red color and starts the game
                let playerOne: user.User;   // Red color, starts the game
                let playerTwo: user.User;   // Yellow color
                if (Math.random() < 0.5) {
                    playerOne = currentUser;
                    playerTwo = sender;
                } else {
                    playerOne = sender;
                    playerTwo = currentUser;
                }

                // A new game is created and added to the list of games
                const newGame = game.newGame(playerOne, playerTwo);
                games.set(newGame._id.toString(), {
                    game: newGame,
                    board: new Board(),
                    playerOneTurn: true,
                    spectators: []
                });

                // Notify the sender that the user accepted the game request sending him the game id
                if (sessionStore.findSession(req.body.notification.sender)) {
                    io.to(req.body.notification.sender).emit("game new", {
                        id: newGame._id.toString()
                    })
                }

                // A socket.io room relative to the current game is created with both the players
                // inside
                io.to(req.body.notification.receiver)
                    .to(req.body.notification.sender)
                    .socketsJoin(newGame._id.toString());

                // We update the session with the current match that the users are playing
                sessionStore.saveSession(req.body.notification.receiver, {
                    online: true,
                    game: newGame.id
                });
                sessionStore.saveSession(req.body.notification.sender, {
                    online: true,
                    game: newGame.id
                });

                // We update the friends that the users started a match
                currentUser.friends.forEach((friend) => {
                    const online: string[] = [];
                    if (sessionStore.findSession(friend.toString())) {
                        online.push(friend.toString());
                    }
                    io.to(online).emit('friend update');
                });
                sender.friends.forEach((friend) => {
                    const online: string[] = [];
                    if (sessionStore.findSession(friend.toString())) {
                        online.push(friend.toString());
                    }
                    io.to(online).emit('friend update');
                });
                return res.status(200).json(newGame);
            }).catch((err) => {
                console.error(err);
                return next({status: 500, error: true, message: "Query error"});
            })
        }).catch((err) => {
            console.error(err);
            return next({status: 404, error: true, message: "Query error"});
        })
    })


gameRouter.route('/:spectate_id/spectate')
    .put(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const gameInfo = games.get(req.params.spectate_id);
        if (!gameInfo) {
            return next({status: 404, error: true, message: "Game not found"});
        }
        if (req.body.follow === true) {
            if (!gameInfo.spectators.includes(req.user.id)) {
                gameInfo.spectators.push(req.user.id);
            }
            io.to(req.user.id).socketsJoin(gameInfo.game._id.toString());
            io.to(gameInfo.game._id.toString()).emit('game user new');
        } else {
            if (gameInfo.spectators.includes(req.user.id)) {
                gameInfo.spectators = gameInfo.spectators.filter((spectator) => {
                    // @ts-ignore
                    return spectator !== req.user.id
                });
            }
            io.to(req.user.id).socketsLeave(gameInfo.game._id.toString());
            io.to(gameInfo.game._id.toString()).emit('game user new');
        }
        return res.status(200).json({error: false, message: ''});
    })

gameRouter.route('/:game_message_id/messages')
    .get(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const gameInfo = games.get(req.params.game_message_id);
        if (!gameInfo) {
            return next({status: 404, error: true, message: "Game not found"});
        }
        if (req.user.id === gameInfo.game.playerOne.toString() || req.user.id === gameInfo.game.playerTwo.toString()) {
            message.getModel().find({
                sender: {$in: [gameInfo.game.playerOne.toString(), gameInfo.game.playerTwo.toString()]},
                receiver: req.params.game_message_id,
            })
                .then((messages) => {
                    return res.status(200).json(messages);
                })
                .catch((err) => {
                    console.error(err);
                    return next({
                        status: 500, error: true, message: 'Error while retrieving the messages'
                    });
                });
        } else if (gameInfo.spectators.includes(req.user.id)) {
            message.getModel().find({receiver: req.params.game_message_id})
                .then((messages) => {
                    if (messages) {
                        return res.status(200).json(messages);
                    } else {
                        return next({status: 500, error: true, message: "Error while retrieving messages"});
                    }
                })
                .catch((err) => {
                    console.error(err);
                    return next({status: 500, error: true, message: "Error while retrieving messages"});
                })
        } else {
            return next({status: 403, error: true, message: "You are not a player nor a spectator"});
        }
    })
    .post(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const gameInfo = games.get(req.params.game_message_id);
        if (!gameInfo) {
            return next({status: 404, error: true, message: "Game not found"});
        }
        if (req.user.id !== gameInfo.game.playerOne.toString() && req.user.id !== gameInfo.game.playerTwo.toString() && !gameInfo.spectators.includes(req.user.id)) {
            return next({status: 403, error: true, message: "You are not a player nor a spectator"});
        }
        if (!req.body.message || !(req.body.message.trim.length > 0)) {
            return next({status: 500, error: true, message: "Message is too short"});
        }
        const mess = message.newMessage(req.user.id, gameInfo.game._id.toString(), req.body.message);
        mess.save().then(_ => {
            io.to(gameInfo.game._id.toString()).emit('game message new');
            return res.status(200).json({error: false, message: ""});
        }).catch((err) => {
            console.error(err);
            return next({status: 500, error: true, message: "Error while saving message"});
        });
    })

gameRouter.route('/:game_users_id/users')
    .get(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const gameInfo = games.get(req.params.game_users_id);
        if (!gameInfo) {
            return next({status: 404, error: true, message: "Game not found"});
        }
        // @ts-ignore
        user.getModel().find({
            // @ts-ignore
            _id: {$in: gameInfo.spectators}
        }, {_id: 1, username: 1}).then((users) => {
            return res.status(200).json(users);
        }).catch((err) => {
            console.error(err);
            return next({status: 500, error: true, message: "Error while querying users"});
        })
    })

gameRouter.route('/:id')
    // Get the status of the match
    .get(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const gameInfo = games.get(req.params.id);
        if (!gameInfo) {
            return next({status: 404, error: true, message: "Game not found"});
        }
        return res.status(200).json({
            board: gameInfo.board,
            playerOne: gameInfo.game.playerOne,
            playerOneName: gameInfo.game.playerOneName,
            playerTwo: gameInfo.game.playerTwo,
            playerTwoName: gameInfo.game.playerTwoName,
            winner: gameInfo.game.winner,
            winnerName: gameInfo.game.winnerName,
            playerOneTurn: gameInfo.playerOneTurn,
            spectators: gameInfo.spectators,
            ended: gameInfo.game.ended
        })
    })
    // Update the board making a move
    .put(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const gameInfo = games.get(req.params.id);
        if (!gameInfo) {
            return next({status: 404, error: true, message: "Game not found"});
        }
        let currentPlayer: string;
        let coin: Coin;
        if (gameInfo.playerOneTurn) {
            currentPlayer = gameInfo.game.playerOne.toString();
            coin = Coin.Red;
        } else {
            currentPlayer = gameInfo.game.playerTwo.toString();
            coin = Coin.Yellow;
        }
        if (gameInfo.game.winner || gameInfo.game.ended) {
            return res.status(200).json({
                board: gameInfo.board,
                playerOne: gameInfo.game.playerOne,
                playerTwo: gameInfo.game.playerTwo,
                winner: gameInfo.game.winner,
                playerOneTurn: gameInfo.playerOneTurn,
                spectators: gameInfo.spectators
            })
        }
        if (req.user.id !== currentPlayer) {
            return next({status: 403, error: true, message: "You cannot play this game, or it's not your turn"});
        }
        if (req.body.x < 0 || !gameInfo.board.put(req.body.x, coin)) {
            return next({status: 403, error: true, message: "Invalid move"});
        }

        // Game logic starts here
        let loserId;
        gameInfo.playerOneTurn = !gameInfo.playerOneTurn;
        if (gameInfo.board.checkWinner() == Coin.Red) {
            gameInfo.game.winner = gameInfo.game.playerOne;
            loserId = gameInfo.game.playerTwo;
            gameInfo.game.winnerName = gameInfo.game.playerOneName;
        } else if (gameInfo.board.checkWinner() == Coin.Yellow) {
            gameInfo.game.winner = gameInfo.game.playerTwo;
            loserId = gameInfo.game.playerOne;
            gameInfo.game.winnerName = gameInfo.game.playerTwoName;
        } else {
            if (gameInfo.board.getRemainingMoves() === 0) {
                gameInfo.game.winnerName = 'Tie!';
            }
        }
        if (gameInfo.game.winner && loserId) {
            gameInfo.game.board = gameInfo.board.get();
            gameInfo.game.ended = new Date();
            gameInfo.game.save();
            // @ts-ignore
            user.getModel().findOne({_id: gameInfo.game.winner}).then((winner) => {
                if (winner) {
                    winner.victories += 1;
                    winner.save();
                }
            });
            // @ts-ignore
            user.getModel().findOne({_id: loserId}).then((loser) => {
                if (loser) {
                    loser.defeats += 1;
                    loser.save();
                }
            });
        }

        io.to(gameInfo.game.id.toString()).emit('game update');
        return res.status(200).json({
            board: gameInfo.board,
            playerOne: gameInfo.game.playerOne,
            playerOneName: gameInfo.game.playerOneName,
            playerTwo: gameInfo.game.playerTwo,
            playerTwoName: gameInfo.game.playerTwoName,
            winner: gameInfo.game.winner,
            winnerName: gameInfo.game.winnerName,
            playerOneTurn: gameInfo.playerOneTurn,
            spectators: gameInfo.spectators,
            ended: gameInfo.game.ended
        })
    });
