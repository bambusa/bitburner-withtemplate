import {
    NS
} from '@ns'
import {
    scripts
} from '/libs/deploy-lib';
import {
    ServerInfo
} from '/models/server-info';

export async function shareLoop(ns: NS, purchasedServers: Record < string, ServerInfo > , hackedServers: Record < string, ServerInfo > ): Promise < void > {
    const shareRam = ns.getScriptRam(scripts[3]);
    for (const hostname of Object.keys(purchasedServers).concat(Object.keys(hackedServers))) {
        let serverInfo = purchasedServers[hostname];
        if (serverInfo == undefined) {
            serverInfo = hackedServers[hostname];
        }

        const server = await ns.getServer(hostname);
        const threads = Math.floor((server.maxRam - server.ramUsed) / shareRam);
        if (threads > 0) {
        const pid = await ns.exec(scripts[3], hostname, threads, Date.now())
        if (pid > 0) {
            // console.log("sharing " + hostname + " with " + threads + " threads");
            serverInfo.freeRam -= shareRam * threads;
        } else {
            console.log("could not share " + hostname + " with " + threads + " threads");
        }
    }
    }
}