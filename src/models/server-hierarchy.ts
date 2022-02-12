export class ServerHierarchy{
    hostname: string;
    children: ServerHierarchy[];
    constructor (hostname: string) {
        this.hostname = hostname;
        this.children = [];
    }
}