import { Server } from "/../NetscriptDefinitions";

export class ServerInfo {
    constructor(server:Server, serverType:string) {
        this.server = server;
        this.serverType = serverType;
        this.created = Date.now();
    }

    server:Server;
    serverType:string;
    serverAtMinSecurity!:boolean;
    serverAtMaxMoney!:boolean;
    hackAmount!:number;
    hackTime!:number;
    hackSecurityRise!:number;
    hackPotential!:number;
    growThreadsToDouble!:number;
    growSecurityRise!:number;
    weakenAmount!:number;
    predictedSecurity!:number;
    fullBatchTime!:number;
    batchMoneyPerSecond!:number;
    freeRam!:number;
    created:number;
}