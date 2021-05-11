export class InMemorySessionStore{
    private sessions: Map<string, any>;
    constructor() {
        this.sessions = new Map();
    }

    findSession(id: string) {
        return this.sessions.get(id);
    }

    saveSession(id: string, online: boolean) {
        this.sessions.set(id, online);
    }

    findAllSessions() {
        return [...this.sessions.values()];
    }
}
