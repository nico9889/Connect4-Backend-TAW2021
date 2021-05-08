"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newUser = exports.checkRoles = exports.getModel = exports.getSchema = exports.Role = void 0;
var mongoose = require("mongoose");
var crypto = require("crypto");
var Role;
(function (Role) {
    Role["ADMIN"] = "ADMIN";
    Role["MODERATOR"] = "MODERATOR";
})(Role = exports.Role || (exports.Role = {}));
var userSchema = new mongoose.Schema({
    username: {
        type: mongoose.SchemaTypes.String,
        required: true,
        minLength: [4, "username is too short"],
        maxLength: [32, "username exceed 32 characters length"],
        match: [new RegExp('^[a-zA-Z0-9\-_]+$'), "username contains invalid characters. Only a-z A-Z 0-9 - _ allowed."],
        unique: true
    },
    roles: {
        type: [mongoose.SchemaTypes.String],
        required: true,
        default: []
    },
    salt: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    digest: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    enabled: {
        type: mongoose.SchemaTypes.Boolean,
        required: true,
        default: false
    },
    last_password_change: {
        type: mongoose.SchemaTypes.Date,
        required: false
    },
    victories: {
        type: mongoose.SchemaTypes.Number,
        required: true,
        min: 0,
        default: 0
    },
    losses: {
        type: mongoose.SchemaTypes.Number,
        required: true,
        min: 0,
        default: 0
    },
    avatar: {
        type: mongoose.SchemaTypes.String,
        required: false
    }
});
userSchema.methods.setPassword = function (pwd) {
    this.salt = crypto.randomBytes(16).toString('hex');
    var hmac = crypto.createHmac('sha512', this.salt);
    hmac.update(pwd);
    this.digest = hmac.digest('hex');
    this.last_password_change = new Date();
};
userSchema.methods.validatePassword = function (pwd) {
    var hmac = crypto.createHmac('sha512', this.salt);
    hmac.update(pwd);
    var digest = hmac.digest('hex');
    return (this.digest === digest);
};
userSchema.methods.hasRole = function (role) {
    return this.roles.indexOf(role) > -1;
};
userSchema.methods.setRole = function (role) {
    if (!this.hasRole(role)) {
        this.roles.push(role);
    }
};
function getSchema() { return userSchema; }
exports.getSchema = getSchema;
// Singleton pattern
var userModel;
function getModel() {
    if (!userModel) {
        userModel = mongoose.model('User', getSchema());
    }
    return userModel;
}
exports.getModel = getModel;
function checkRoles(user, roles) {
    var allowed = false;
    if (user) {
        var _usermodel = getModel();
        var u_1 = new _usermodel(user);
        roles.forEach(function (item) {
            allowed || (allowed = u_1.hasRole(item));
        });
    }
    return allowed;
}
exports.checkRoles = checkRoles;
function newUser(data /* FIXME: why in the world JS has to be so ugly */) {
    var _usermodel = getModel();
    return new _usermodel(data);
}
exports.newUser = newUser;
//# sourceMappingURL=User.js.map