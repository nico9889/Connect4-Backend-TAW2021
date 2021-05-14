export enum Type {
    ERROR,
    FRIEND_REQUEST,
    GAME_INVITE,
    PRIVATE_MESSAGE
}

class Notification {
    type: Type;
    sender: string;
    senderUsername: string;
    receiver: string;
    expiry: Date;

    constructor(type: Type, senderUser: Express.User, receiverUser: string, expiry: number) {
        this.type = type;
        this.sender = senderUser.id;
        this.senderUsername = senderUser.username;
        this.receiver = receiverUser;
        this.expiry = new Date(Date.now() + expiry * 60000);
    }
}

function equals(not1: Notification, not2: Notification): boolean{
    return new Date(not1.expiry).getTime() === new Date(not2.expiry).getTime() && not1.sender === not2.sender && not1.receiver === not2.receiver && not1.type === not2.type;
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

export function getNotifications(user: Express.User): Notification[] {
    let userNotifications = notifications.get(user.id);
    if(userNotifications){
        if(sentNotifications.has(user.id)){
            // @ts-ignore can't be undefined since I checked before if it has a value
            sentNotifications.get(user.id).concat(userNotifications);
        }else{
            let sentUserNotifications: Notification[] = [];
            sentUserNotifications.concat(userNotifications);
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
            return equals(not, notification);
        });
        let notExpiredNotifications = userSentNotifications.filter((not) => {
            return new Date(notification.expiry) < new Date || !equals(not, notification);
        })
        sentNotifications.set(user.id, notExpiredNotifications);
        return result !== undefined && new Date(notification.expiry) < new Date();
    }
    return false;
}

