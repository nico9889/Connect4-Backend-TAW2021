import express from 'express';
import {auth, moderator} from '../utils/auth'
import {checkNotification, newNotification, Type} from "../models/Notification";
import * as user from '../models/User';
import * as game from '../models/Game';
import * as message from '../models/Message';
import {io, sessionStore} from "../index";
import {User} from "../models/User";
import {body, query, validationResult} from "express-validator";

export let gameRouter = express.Router();

export enum Coin {
    None,
    Red,    // Player One
    Yellow  // Player Two
}

// Game board class, track the progress of the game
class Board {
    private readonly board: Coin[][];
    private readonly moves: Coin[];
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
        this.moves = [];
    }

    // Put a coin into the board, return false if the move is invalid
    put(x: number, coin: Coin): boolean {
        if (x >= 0 && x < this.board[0].length) {
            let y = this.board.length - 1;
            while (y > 0 && this.board[y][x] !== Coin.None) {
                y--;
            }
            if (y >= 0 && this.board[y][x] == Coin.None) {
                this.board[y][x] = coin;
                this.remainingMoves -= 1;
                this.moves.push(x);
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

    getMoves(): number[] {
        return this.moves;
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

// UserID, RATIO
export const rankedQueue: Map<string, number> = new Map();
export const scrimmageQueue: Map<string, number> = new Map();

function createGame(currentUser: user.User, opponentUser: user.User) {
    // If the users where queued we remove them from queues
    rankedQueue.delete(currentUser._id.toString());
    rankedQueue.delete(opponentUser._id.toString());
    scrimmageQueue.delete(currentUser._id.toString());
    scrimmageQueue.delete(opponentUser._id.toString());

    // We pick randomly the user that has red color and starts the game
    let playerOne: user.User;   // Red color, starts the game
    let playerTwo: user.User;   // Yellow color
    if (Math.random() < 0.5) {
        playerOne = currentUser;
        playerTwo = opponentUser;
    } else {
        playerOne = opponentUser;
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
    if (sessionStore.findSession(currentUser._id.toString())) {
        io.to(currentUser._id.toString()).emit("game new", {
            id: newGame._id.toString()
        })
    }

    // A socket.io room relative to the current game is created with both the players
    // inside
    io.to(currentUser._id.toString())
        .to(opponentUser._id.toString())
        .socketsJoin(newGame._id.toString());

    // Notify the users that a new game has been created
    io.to(newGame._id.toString()).emit("game new", {
        id: newGame._id.toString()
    })

    // We update the session with the current match that the users are playing
    sessionStore.saveSession(currentUser._id.toString(), {
        online: true,
        game: newGame.id
    });
    sessionStore.saveSession(opponentUser._id.toString(), {
        online: true,
        game: newGame.id
    });

    // We update the friends that the users started a match
    currentUser.friends.forEach((friend) => {
        const online: string[] = [];
        if (sessionStore.findSession(friend.toString())) {
            online.push(friend.toString());
        }
        io.to(online).emit('friend online', {id: currentUser._id.toString(), game: newGame.id});
    });
    opponentUser.friends.forEach((friend) => {
        const online: string[] = [];
        if (sessionStore.findSession(friend.toString())) {
            online.push(friend.toString());
        }
        io.to(online).emit('friend online', {id: opponentUser._id.toString(), game: newGame.id});
    });
    return newGame;
}

// Get the match played by the requesting user or the match played by the user that has been specified
gameRouter.get('/played',
    auth,
    moderator,
    query('user').optional().isMongoId(),
    async (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        if (!req.query?.user || req.user.id === req.query?.user) {
            try {
                const games = game.getModel().find({
                    $or: [{playerOne: req.user.id}, {playerTwo: req.user.id}]
                }).populate('playerOne', '_id username')
                    .populate('playerTwo', '_id username')
                    .populate('winner', '_id username');
                if (!games) {
                    return next({status: 404, error: true, message: 'No games found'});
                }
                return res.status(200).json(games);
            } catch (e: any) {
                console.error(e);
                return next({status: 500, error: true, message: "Error while retrieving games"});
            }
        } else {
            let currentUser;
            try {
                currentUser = await user.getModel().findOne({_id: req.user.id});
            } catch (e: any) {
                console.error(e);
                return next({status: 500, error: true, message: "Error while retrieving the user"});
            }

            if (!currentUser) {
                return next({status: 404, error: true, message: 'User not found'});
            }
            const friend = currentUser.friends.find((friend) => {
                return friend._id.toString() === req.query?.user?.toString();
            })
            if (!friend && !currentUser.hasRole(user.Role.MODERATOR)) {
                return next({
                    status: 403,
                    error: true,
                    message: 'You are not authorized to access this resource'
                });
            }
            try {
                const games = await game.getModel().find({
                    $or: [{playerOne: req.query?.user?.toString()}, {playerTwo: req.query?.user?.toString()}]
                }).populate('playerOne', '_id username')
                    .populate('playerTwo', '_id username')
                    .populate('winner', '_id username');

                if (!games) {
                    return next({status: 404, error: true, message: 'No games found'});
                }
                return res.status(200).json(games);
            } catch (e: any) {
                console.error(e);
                return next({status: 500, error: true, message: "Error while retrieving the games"});
            }
        }
    });


gameRouter.route('/invite')
    // Create a new game invitation if current user and invited user are friends
    .post(auth, moderator, async (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        try {
            const currentUser = await user.getModel().findOne({_id: req.user.id});
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
        } catch (e: any) {
            console.error(e);
            return next({status: 500, error: true, message: "Error while retrieving the user"});
        }
    })
    // Respond to the notification, if the invited user accepted a new game is created
    .put(auth, moderator, async (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (req.body.notification.receiver !== req.user.id || req.body.notification.sender === req.body.notification.receiver) {
            return next({status: 403, error: true, message: "This request doesn't belong to you!"});
        }

        if (!checkNotification(req.user, req.body.notification)) {
            return next({
                status: 403,
                error: true,
                message: "The invite that you are trying to accept doesn't exist or is expired"
            });
        }
        if (req.body.accept !== true) {
            return res.status(200).json({});
        }


        const currentUser = await user.getModel().findOne({_id: req.body.notification.receiver}, {
            username: 1,
            friends: 1
        }).catch((err) => {
            console.error(err);
        });

        const sender = await user.getModel().findOne({_id: req.body.notification.sender}, {username: 1, friends: 1})
            .catch((err) => {
                console.error(err);
            });

        if (!currentUser || !sender) {
            return next({status: 404, error: true, message: "User not found"});
        }
        // A new game is created and added to the list of games
        const newGame = createGame(currentUser, sender);
        return res.status(200).json(newGame);
    })


gameRouter.route("/ranked")
    // Get the ranked queue data
    .get(auth, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        return res.status(200).json({
            queued: rankedQueue.has(req.user.id),
            inQueue: rankedQueue.size
        });
    })
    // Subscribe/unsubscribe the current user to the ranked queue, if there at least one valid player creates a new match
    .put(auth, async (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        const currentUser = await user.getModel().findOne({_id: req.user.id}, {
            username: 1,
            friends: 1,
            victories: 1,
            defeats: 1
        }).catch(console.error);

        if (!currentUser) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (req.body.subscribe === true) {
            scrimmageQueue.delete(req.user.id);
            const currentUserRatio = currentUser.getRatio();
            let opponent: string | undefined = undefined;
            rankedQueue.forEach((opponentRatio, opponentId) => {
                if (!opponent && opponentId !== currentUser._id.toString() && currentUserRatio >= opponentRatio - 0.25 && currentUserRatio <= (opponentRatio + 0.25)) {
                    opponent = opponentId;
                }
            });
            if (!opponent) {
                rankedQueue.set(currentUser._id.toString(), currentUser.getRatio());
                io.emit("queue update");
                return res.status(200).json({error: false, message: ""});
            } else {
                rankedQueue.delete(opponent);
                const opponentUser = await user.getModel().findOne({_id: opponent}, {
                    username: 1,
                    friends: 1,
                    victories: 1,
                    defeats: 1
                }).catch(console.error);

                if (!opponentUser) {
                    return next({status: 500, error: true, message: "Generic error occurred"});
                }
                createGame(currentUser, opponentUser);
                io.emit("queue update");
                return res.status(200).json({error: false, message: ""});
            }
        } else if (req.body.subscribe === false) {
            rankedQueue.delete(req.user.id);
            io.emit("queue update");
            return res.status(200).json({error: false, message: ""});
        } else {
            return next({status: 500, error: true, message: "Invalid body request"});
        }
    })

gameRouter.route("/scrimmage")
    // Retrieve the scrimmage queue data
    .get(auth, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        return res.status(200).json({
            queued: scrimmageQueue.has(req.user.id),
            inQueue: scrimmageQueue.size
        });
    })
    // Subscribe/unsubscribe the current user to the scrimmage queue, if there is at least one player creates a new match
    .put(auth, async (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        const currentUser = await user.getModel().findOne({_id: req.user.id}, {
            username: 1,
            friends: 1
        }).catch(console.error);
        if (!currentUser) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }
        if (req.body.subscribe === true) {
            rankedQueue.delete(req.user.id);
            const opponent: string | undefined = scrimmageQueue.keys().next().value;
            if (!opponent) {
                scrimmageQueue.set(currentUser._id.toString(), currentUser.getRatio());
                io.emit("queue update");
                return res.status(200).json({error: false, message: ""});
            } else {
                scrimmageQueue.delete(opponent);
                const opponentUser = await user.getModel().findOne({_id: opponent}, {username: 1, friends: 1});
                if (!opponentUser) {
                    return next({status: 500, error: true, message: "Generic error occurred"});
                }
                createGame(currentUser, opponentUser);
                io.emit("queue update");
                return res.status(200).json({error: false, message: ""});
            }
        } else if (req.body.subscribe === false) {
            scrimmageQueue.delete(req.user.id);
            io.emit("queue update");
            return res.status(200).json({error: false, message: ""});
        } else {
            return next({status: 500, error: true, message: "Invalid body request"});
        }
    })

// Subscribe/unsubscribe the current user to the specified match so he can be notified through a socket.io room when
// there's a change in the match data
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
        } else {
            if (gameInfo.spectators.includes(req.user.id)) {
                gameInfo.spectators = gameInfo.spectators.filter((spectator) => {
                    return spectator !== req.user?.id
                });
            }
            io.to(req.user.id).socketsLeave(gameInfo.game._id.toString());
        }
        return res.status(200).json({error: false, message: ''});
    })

// Retrieves the messages related to a game from the database, if the user requesting the messages is a player it will
// receive only the messages sent by him and his opponent
gameRouter.route('/:game_message_id/messages')
    .get(auth,
        moderator,
        query("limit", "Must be a positive integer value greater than 0.").optional().isInt({min: 1}),
        async (req, res, next) => {
            if (!req.user) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }

            let limit = 50;
            const result = validationResult(req);
            if (!result.isEmpty()) {
                return next({status: 500, error: true, message: result.array({onlyFirstError: true}).pop()?.msg})
            } else if (req.query?.limit) {
                limit = parseInt(req.query?.limit as string);
            }

            const gameInfo = games.get(req.params.game_message_id);
            if (!gameInfo) {
                return next({status: 404, error: true, message: "Game not found"});
            }
            if (req.user.id === (gameInfo.game.playerOne as User)._id.toString() || req.user.id === (gameInfo.game.playerTwo as User)._id.toString()) {
                const messages = await message.getModel()
                    .find({
                        sender: {$in: [gameInfo.game.playerOne, gameInfo.game.playerTwo]},
                        receiver: req.params.game_message_id,
                    }, {onModel: 0})
                    .sort("-datetime")
                    .limit(limit).catch(console.error);
                if(messages === undefined || messages === null){
                    return next({status: 500, error: true, message: "Couldn't retrieve messages"});
                }
                return res.status(200).json(messages);
            } else if (gameInfo.spectators.includes(req.user.id)) {
                const messages = await message.getModel().find({receiver: req.params.game_message_id}, {onModel: 0})
                    .sort("-datetime")
                    .limit(limit).catch(console.error);
                if(messages === undefined || messages === null){
                    return next({status: 500, error: true, message: "Couldn't retrieve messages"});
                }
                return res.status(200).json(messages);
            } else {
                return next({status: 403, error: true, message: "You are not a player nor a spectator"});
            }
        })
    .post(auth, moderator, async (req, res, next) => {
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
        if (!req.body.message || req.body.message.content.trim().length <= 0) {
            return next({status: 500, error: true, message: "Message is too short"});
        }
        const mess = message.newMessage(req.user.id, gameInfo.game._id.toString(), message.Type.Game, req.body.message.content);
        try{
            await mess.save();
            io.to(gameInfo.game._id.toString()).emit('message new');
            return res.status(200).json({error: false, message: ""});
        }catch(e: any){
            console.error(e);
            return next({status: 500, error: true, message: "Error while saving message"});
        }
    })

gameRouter.route('/:id')
    // Get the status of a match
    .get(auth, moderator, (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        // Looking for the match info into the match map, if no info are found then we search for the game info
        // into the database
        const gameInfo = games.get(req.params.id);
        if (!gameInfo) {
            game.getModel().findOne({_id: req.params.id})
                .populate('playerOne', '_id username')
                .populate('playerTwo', '_id username')
                .populate('winner', '_id username')
                .then((game) => {
                    if (!game) {
                        return next({status: 404, error: true, message: "Game not found"});
                    }
                    return res.status(200).json({
                        board: {board: game.board},
                        playerOne: game.playerOne,
                        playerTwo: game.playerTwo,
                        winner: game.winner,
                        playerOneTurn: true,
                        spectators: [],
                        ended: game.ended
                    })
                })
                .catch((err) => {
                    console.error(err);
                    return next({status: 500, error: true, message: 'Generic error occurred'});
                })
        } else {
            return res.status(200).json({
                board: gameInfo.board,
                playerOne: gameInfo.game.playerOne,
                playerTwo: gameInfo.game.playerTwo,
                winner: gameInfo.game.winner,
                playerOneTurn: gameInfo.playerOneTurn,
                spectators: gameInfo.spectators,
                ended: gameInfo.game.ended
            })
        }
    })
    // Update the board making a move
    .put(auth,
        moderator,
        body('column', 'Request must contain an integer number between 0 and 6').isInt({min: 0, max: 6}),
        async (req, res, next) => {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                return next({status: 500, error: true, message: result.array({onlyFirstError: true}).pop()?.msg});
            }
            if (!req.user) {
                return next({status: 500, error: true, message: "Generic error occurred"});
            }
            const gameInfo = games.get(req.params.id);
            if (!gameInfo) {
                return next({status: 404, error: true, message: "Game not found"});
            }

            // If the game is ended we just send back the game info as-is
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

            let currentPlayer: string;
            let coin: Coin;

            // Identifying the turn, so we can block the move if it's not the current user turn
            if (gameInfo.playerOneTurn) {
                currentPlayer = (gameInfo.game.playerOne as User)._id.toString();
                coin = Coin.Red;
            } else {
                currentPlayer = (gameInfo.game.playerTwo as User)._id.toString();
                coin = Coin.Yellow;
            }

            if (req.user.id !== currentPlayer) {
                return next({status: 403, error: true, message: "You cannot play this game, or it's not your turn"});
            }

            // Trying to make the move, if the move is invalid (I.E: the column is full) we return an error
            if (!gameInfo.board.put(req.body.column, coin)) {
                return next({status: 403, error: true, message: "Invalid move"});
            }

            // Switching the player turn
            gameInfo.playerOneTurn = !gameInfo.playerOneTurn;

            // Checking if there's a winner, if a Coin is returned or there's no more space in the board
            // then we set the game as ended
            const winnerCoin = gameInfo.board.checkWinner();
            if (gameInfo.board.getRemainingMoves() === 0 || winnerCoin !== Coin.None) {
                let loserId;
                if (winnerCoin === Coin.Red) {
                    gameInfo.game.winner = gameInfo.game.playerOne;
                    loserId = gameInfo.game.playerTwo;
                } else if (winnerCoin === Coin.Yellow) {
                    gameInfo.game.winner = gameInfo.game.playerTwo;
                    loserId = gameInfo.game.playerOne;
                }

                gameInfo.game.board = gameInfo.board.get();
                gameInfo.game.moves = gameInfo.board.getMoves();
                gameInfo.game.ended = new Date();
                await gameInfo.game.save().catch(console.error);
                const winner = await user.getModel().findOne({_id: gameInfo.game.winner});
                if(winner){
                    winner.victories += 1;
                    await winner.save().catch(console.error);
                }
                const loser = await user.getModel().findOne({_id: loserId});
                if(loser){
                    loser.defeats += 1;
                    await loser.save().catch(console.error);
                }
            }

            // Signaling to the players/spectators that the board has been updated and sending back game info to the
            // current user
            io.to(gameInfo.game.id.toString()).emit('game update');
            return res.status(200).json({
                board: gameInfo.board,
                playerOne: gameInfo.game.playerOne,
                playerTwo: gameInfo.game.playerTwo,
                winner: gameInfo.game.winner,
                playerOneTurn: gameInfo.playerOneTurn,
                spectators: gameInfo.spectators,
                ended: gameInfo.game.ended
            })
        });
