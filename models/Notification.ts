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


export function newNotification(type: Type, senderUser: Express.User | undefined, receiverUser: string, expiry: number): void {
    if(senderUser && type) {
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
    const toSend = notifications.get(user.id);
    if(toSend){
        const filtered = toSend.filter((notification) => {return notification.type !== Type.PRIVATE_MESSAGE});
        notifications.set(user.id, filtered);
        return toSend;
    }else{
        return [];
    }
}

// Check if the notification that the user is responding is a valid notification that has been sent
export function checkNotification(user: Express.User, notification: Notification): boolean {
    const userSentNotifications = notifications.get(user.id);
    if(userSentNotifications){
        let result = userSentNotifications.find((not) => {
            return not.uid === notification.uid;
        });
        let notExpiredNotifications = userSentNotifications.filter((not) => {
            return new Date(notification.expiry) < new Date && not.uid !== notification.uid;
        })
        notifications.set(user.id, notExpiredNotifications);
        return result !== undefined && new Date(notification.expiry) > new Date();
    }
    return false;
}

