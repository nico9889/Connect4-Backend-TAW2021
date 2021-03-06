import mongoose from 'mongoose';

import crypto from "crypto";

export enum Role {
    ADMIN = "ADMIN",
    MODERATOR = "MODERATOR"
}

export interface User extends mongoose.Document {
    readonly _id: mongoose.Types.ObjectId,
    username: string,
    roles: Role[],
    friends: User[],
    salt: string,                                   // Random salt
    digest: string,                                 // Password digest
    enabled: boolean,
    last_password_change: Date,
    registered_on: Date,
    victories: number,
    defeats: number,
    avatar: string,
    setPassword: (pwd: string) => void,
    validatePassword: (pwd: string) => boolean,
    setRole: (role: Role) => Role,
    hasRole: (role: Role) => boolean,
    getRatio: () => number
}

export interface Friend{
    _id: string;
    username: string;
    online: boolean;
    game: string;
    avatar?: string;
}

let userSchema = new mongoose.Schema<User>({
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
    friends: [
        { type: mongoose.SchemaTypes.ObjectId,
            required: true,
            ref: 'User'
        }],
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
    registered_on: {
        type: mongoose.SchemaTypes.Date,
        required: true,
        default: new Date()
    },
    victories: {
        type: mongoose.SchemaTypes.Number,
        required: true,
        min: 0,
        default: 0
    },
    defeats: {
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

userSchema.methods.setPassword = function (pwd: string) {
    this.salt = crypto.randomBytes(16).toString('hex');
    let hmac = crypto.createHmac('sha512', this.salt);
    hmac.update(pwd);
    this.digest = hmac.digest('hex');
    this.last_password_change = new Date();
}

userSchema.methods.validatePassword = function (pwd: string): boolean {
    let hmac = crypto.createHmac('sha512', this.salt);
    hmac.update(pwd);
    let digest = hmac.digest('hex');
    return (this.digest === digest);
}

userSchema.methods.hasRole = function (role: Role): boolean {
    return this.roles.indexOf(role) > -1;
}

userSchema.methods.setRole = function (role: Role): void {
    if (!this.hasRole(role)) {
        this.roles.push(role);
    }
}

userSchema.methods.getRatio = function(): number{
    return this.victories / (this.defeats + 1);
}

export function getSchema() {
    return userSchema;
}


// Singleton pattern
let userModel: mongoose.Model<User>;

export function getModel(): mongoose.Model<User> {
    if (!userModel) {
        userModel = mongoose.model('User', getSchema());
    }
    return userModel;
}

export function checkRoles(user: Express.User | undefined, roles: Role[]) {
    let allowed = false;
    if (user) {
        const _usermodel = getModel();
        let u = new _usermodel(user);
        roles.forEach(item => {
            allowed ||= u.hasRole(item);
        });
    }
    return allowed;
}

export function newUser(data: { username: string, enabled: boolean }): User {
    const _usermodel = getModel();
    return new _usermodel(data);
}





