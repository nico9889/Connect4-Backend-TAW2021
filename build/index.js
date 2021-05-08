"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var http = require("http");
var mongoose = require("mongoose");
var express = require("express");
var cors = require("cors");
var User_1 = require("./models/User");
var user = __importStar(require("./models/User"));
var user_router_1 = require("./routers/user_router");
var auth_router_1 = require("./routers/auth_router");
var app = express();
// ExpressJS Middleware
app.use(cors());
app.use(express.json());
// Routers
app.use("/v1/users", user_router_1.user_router);
app.use("/v1/", auth_router_1.auth_router);
// Error handling middleware
// @ts-ignore
app.use(function (err, req, res, next) {
    console.log("Request error: " + JSON.stringify(err));
    console.log(err);
    var statusCode = err.status || 500;
    // @ts-ignore
    res.status(statusCode).json({ statusCode: statusCode, error: true, message: err.message });
});
// Mongoose settings to avoid deprecation warning
mongoose.set('useNewUrlParser', true);
mongoose.set('useUnifiedTopology', true);
mongoose.set('useCreateIndex', true);
// Mongoose initialization and server start
mongoose.connect('mongodb://127.0.0.1:27017/connect4-874273')
    .then(function () {
    console.log("Connected to MongoDB");
    return user.getModel().findOne({ username: "admin" });
}).then(function (doc) {
    if (!doc) {
        console.log("Creating admin user");
        var u = user.newUser({
            username: "admin",
            enabled: true
        });
        u.setRole(User_1.Role.ADMIN);
        u.setRole(User_1.Role.MODERATOR);
        var r = Math.random().toString(36).substring(7);
        console.log("Administrator password: " + r + "\nChange it asap!");
        u.setPassword(r);
        return u.save();
    }
})
    .then(// Once database is initialized we start the HTTP server
function () {
    var server = http.createServer(app);
    server.listen(8080, function () { return console.log("HTTP Server started on port 8080"); });
})
    .catch(function (err) {
    console.log("Error Occurred during initialization");
    console.log(err);
});
//# sourceMappingURL=index.js.map