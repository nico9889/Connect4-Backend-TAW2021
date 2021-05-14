import express = require('express');
import {auth} from '../utils/auth'
import {checkSentNotification, newNotification, Type} from "../models/Notification";
import * as user from '../models/User';
import * as game from '../models/Game';
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

interface GameInfo {
    game: game.Game;
    board: Board;
    playerOneTurn: boolean;
    spectators: string[];
}

const games: Map<String, GameInfo> = new Map<String, GameInfo>();

gameRouter.route('/invite')
    // Create a new game invitation if current user and invited user are friends
    .post(auth, (req, res, next) => {
        if (req.user) {
            // @ts-ignore Mongoose is casting automatically
            user.getModel().findOne({_id: req.user.id})
                .then((currentUser) => {
                    if (currentUser) {
                        let dest = currentUser.friends.find((id) => {
                            return id.toString() === req.body.id;
                        })
                        if (dest) {
                            newNotification(Type.GAME_INVITE, req.user, dest.toString(), 10);
                            if (sessionStore.findSession(dest.toString())) {
                                io.to(dest.toString()).emit("notification update");
                            }
                            return res.status(200).json({error: false, message: ""});
                        } else {
                            return next({status: 403, error: true, message: "User is not your friend"});
                        }
                    } else {
                        return next({status: 500, error: true, message: "Invalid request"});
                    }
                }).catch((e) => {
                console.error(e);
                return next({status: 404, error: true, message: "User not found"});
            })
        } else {
            return next({status: 500, error: true, message: "Invalid request"});
        }
    })
    // Respond to the notification, if the invited user accepted a new game is created
    .put(auth, (req, res, next) => {
        if (req.user && req.body.notification.receiver === req.user.id && req.body.notification.sender !== req.body.notification.receiver) {
            if (checkSentNotification(req.user, req.body.notification)) {
                if (req.body.accept === true) {
                    // @ts-ignore
                    user.getModel().findOne({_id: req.body.notification.receiver}).then((currentUser) => {
                        if (currentUser) {
                            user.getModel().findOne({_id: req.body.notification.sender}).then((sender) => {
                                if (sender) {
                                    let playerOne: user.User;
                                    let playerTwo: user.User;
                                    if (Math.random() < 0.5) {
                                        playerOne = currentUser;
                                        playerTwo = sender;
                                    } else {
                                        playerOne = sender;
                                        playerTwo = currentUser;
                                    }
                                    const newGame = game.newGame(playerOne, playerTwo);
                                    games.set(newGame._id.toString(), {
                                        game: newGame,
                                        board: new Board(),
                                        playerOneTurn: true,
                                        spectators: []
                                    });
                                    if (sessionStore.findSession(playerTwo._id.toString())) {
                                        io.to(playerTwo._id.toString()).emit("game new", {
                                            id: newGame._id.toString()
                                        })
                                    }
                                    return res.status(200).json(newGame);
                                } else {
                                    return next({status: 404, error: true, message: "User not found"});
                                }
                            }).catch((err) => {
                                console.error("Sender User: " + err);
                                return next({status: 500, error: true, message: "Query error"});
                            })
                        } else {
                            return next({status: 404, error: true, message: "User not found"});
                        }
                    }).catch((err) => {
                        console.error("Receiver User: " + err);
                        return next({status: 404, error: true, message: "Query error"});
                    })
                } else {
                    return res.status(200).json({});
                }
            } else {
                return next({status: 404, error: true, message: "Game invite not found"});
            }
        } else {
            return next({status: 500, error: true, message: "Invalid request"});
        }
    })

gameRouter.route('/:id')
    // Get the status of the match
    .get(auth, (req, res, next) => {
        if (req.user) {
            const gameInfo = games.get(req.params.id);
            if (gameInfo) {
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
            } else {
                return next({status: 404, error: true, message: "Game not found"});
            }
        } else {
            return next({status: 500, error: true, message: "Invalid request"});
        }
    })
    // Update the board making a move
    .put(auth, (req, res, next) => {
    if (req.user) {
        const gameInfo = games.get(req.params.id);
        if (gameInfo) {
            let currentPlayer: string;
            let opponent: string;
            let coin: Coin;
            if (gameInfo.playerOneTurn) {
                currentPlayer = gameInfo.game.playerOne.toString();
                opponent = gameInfo.game.playerTwo.toString();
                coin = Coin.Red;
            } else {
                currentPlayer = gameInfo.game.playerTwo.toString();
                opponent = gameInfo.game.playerOne.toString();
                coin = Coin.Yellow;
            }
            if (!gameInfo.game.winner && !gameInfo.game.ended) {
                if (req.user.id === currentPlayer) {
                    if (req.body.x >= 0) {
                        if (gameInfo.board.put(req.body.x, coin)) {
                            let loserId;
                            gameInfo.playerOneTurn = !gameInfo.playerOneTurn;
                            if(!gameInfo.game.ended){
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
                            }
                            if (sessionStore.findSession(opponent)) {
                                io.to(opponent).emit('game update');
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
                        } else {
                            return next({status: 500, error: true, message: "Invalid move"})
                        }
                    }
                } else {
                    return next({
                        status: 403,
                        error: true,
                        message: "You cannot play this game, or it's not your turn"
                    })
                }
            } else {
                return res.status(200).json({
                    board: gameInfo.board,
                    playerOne: gameInfo.game.playerOne,
                    playerTwo: gameInfo.game.playerTwo,
                    winner: gameInfo.game.winner,
                    playerOneTurn: gameInfo.playerOneTurn,
                    spectators: gameInfo.spectators
                })
            }
        } else {
            return next({status: 404, error: true, message: "Game not found"});
        }
    } else {
        return next({status: 500, error: true, message: "Invalid request"});
    }
});
