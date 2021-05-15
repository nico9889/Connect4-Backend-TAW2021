import crypto = require('crypto');

export enum Type {
    ERROR,
    FRIEND_REQUEST,
    GAME_INVITE,
    PRIVATE_MESSAGE
}


class Notification {
    uid: string;
    type: Type;
    sender: string;
    senderUsername: string;
    receiver: string;
    expiry: Date;

    constructor(type: Type, senderUser: Express.User, receiverUser: string, expiry: number) {
        this.uid = crypto.randomBytes(20).toString('hex');
        this.type = type;
        this.sender = senderUser.id;
        this.senderUsername = senderUser.username;
        this.receiver = receiverUser;
        this.expiry = new Date(Date.now() + expiry * 60000);
    }
}

let notifications: Map<string, Notification[]> = new Map();
let sentNotifications: Map<string, Notification[]> = new Map();


export function newNotification(type: Type, senderUser: Express.User | undefined, receiverUser: string, expiry: number): void {
    if(senderUser) {
        let userNotifications = notifications.get(receiverUser);
        if(userNotifications) {
            userNotifications.push(new Notification(type, senderUser, receiverUser, expiry));
        }else{
            userNotifications = [];
            userNotifications.push(new Notification(type, senderUser, receiverUser, expiry));
            notifications.set(receiverUser, userNotifications);
        }
    }
}

// Get all the user notifications that has to be sent to the users.
// Preserving game notification and friend notification to check later if they have been accepted
export function getNotifications(user: Express.User): Notification[] {
    const userNotifications = notifications.get(user.id);
    if(userNotifications){
        // We need to preserve only the invites. Preserving chat messages notification is useless.
        const invites = userNotifications.filter((not) => {
           return not.type != Type.PRIVATE_MESSAGE;
        });
        if(sentNotifications.has(user.id)){
            console.log("User exists, adding notification");
            const userSentNotification = sentNotifications.get(user.id);
            // @ts-ignore can't be undefined since I checked before if it has a value
            const concat = userSentNotification.concat(invites)
            sentNotifications.set(user.id, concat);
        }else{
            console.log("User do not exists, adding user");
            const sentUserNotifications: Notification[] = [...invites];
            sentUserNotifications.concat(invites);
            sentNotifications.set(user.id, sentUserNotifications);
        }
        notifications.set(user.id, []);
        return userNotifications;
    }else{
        return [];
    }
}

// Check if the notification that the user is responding is a valid notification that has been sent
export function checkSentNotification(user: Express.User, notification: Notification): boolean {
    let userSentNotifications = sentNotifications.get(user.id);
    if(userSentNotifications){
        let result = userSentNotifications.find((not) => {
            return not.uid === notification.uid;
        });
        let notExpiredNotifications = userSentNotifications.filter((not) => {
            return new Date(notification.expiry) < new Date && not.uid !== notification.uid;
        })
        sentNotifications.set(user.id, notExpiredNotifications);
        console.log(result);
        return result !== undefined && new Date(notification.expiry) > new Date();
    }
    return false;
}

