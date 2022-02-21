import {
    NS,
    Player
} from '@ns'
import {
    findHackedServers
} from "libs/server-lib"
import {
    ServerInfo
} from "models/server-info"
import {
    gameStateLoop,
    gameStateFile
} from "libs/network-lib"
import {
    Misc
} from "models/misc"
import {
    RunningJobs
} from '/models/running-jobs'
import {
    calculateHackingTime
} from '/libs/formulas-lib';
import { hackXpLoop, weakGrowHackLoop } from '/libs/hack-lib'
import { shareLoop } from '/libs/share-lib'

const batchLogFile = "batch-log-file.txt";

export async function main(ns: NS): Promise < void > {
    console.log("/// *** Starting main function of gameloop.js *** \\\\\\");
    const loop = ns.args[0] as boolean ?? true;
    const mode = ns.args[1] as string;
    const hackedServers: Record < string, ServerInfo > = {};
    const purchasedServers: Record < string, ServerInfo > = {};
    const runningJobs: RunningJobs = new RunningJobs;
    const misc: Misc = {
        ram: 0
    };
    const backdoorsInstalled: string[] = [];

    await ns.write(batchLogFile, "[]", "w");
    await ns.write(gameStateFile, "1", "w");

    while (true) {
        const started = Date.now();
        const player = ns.getPlayer();

        const gameStateLevel = await gameStateLoop(ns, backdoorsInstalled);
        console.log("/// *** Starting loop of gameloop.js at level " + gameStateLevel + " *** \\\\\\");
        updateServerInfo(ns, hackedServers, purchasedServers, misc, player);
        await weakGrowHackLoop(ns, player, purchasedServers, hackedServers, runningJobs);
        if (mode == "share") await shareLoop(ns, purchasedServers, hackedServers);
        else if (mode == "hack") await hackXpLoop(ns, purchasedServers, hackedServers);
        else {
            if (gameStateLevel < 3) {
                await hackXpLoop(ns, purchasedServers, hackedServers);
            }
            else {
                await shareLoop(ns, purchasedServers, hackedServers);
            }
        }

        const ended = Date.now();
        console.log("Loop took " + (ended - started) + " ms");
        if (!loop) break;
        await ns.sleep(1000);
    }
}

function updateServerInfo(ns: NS, hackedServers: Record < string, ServerInfo > , purchasedServers: Record < string, ServerInfo > , misc: Misc, player: Player) {
    //console.log("updateServerInfo");
    misc.ram = 0;
    updateHackedServers(ns, hackedServers, player, misc);
    updatePurchasedServers(ns, purchasedServers, misc);
    //console.log(hackedServers);
}

function updateHackedServers(ns: NS, hackedServers: Record < string, ServerInfo > , player: Player, misc: Misc): void {
    const servers = findHackedServers(ns, "home", "home", null);
    for (const serverName of servers) {
        const server = ns.getServer(serverName);
        /** @type{ServerInfo} */
        const serverInfo = hackedServers[serverName] ?? new ServerInfo(server, "hacked");
        serverInfo.serverAtMinSecurity = server.hackDifficulty == server.minDifficulty;
        serverInfo.serverAtMaxMoney = server.moneyMax == server.moneyAvailable;
        serverInfo.freeRam = server.maxRam - server.ramUsed;
        serverInfo.growThreadsToDouble = ns.growthAnalyze(serverName, 2);
        serverInfo.growSecurityRise = ns.growthAnalyzeSecurity(1);
        serverInfo.weakenAmount = ns.weakenAnalyze(1);
        serverInfo.hackSecurityRise = ns.hackAnalyzeSecurity(1);
        serverInfo.hackAmount = ns.hackAnalyze(server.hostname) * serverInfo.server.moneyMax;
        const minServer = server;
        server.hackDifficulty = server.minDifficulty;
        serverInfo.hackPotential = serverInfo.hackAmount / (calculateHackingTime(minServer, player) * 8);
        hackedServers[serverName] = serverInfo;
        misc.ram += server.maxRam;
    }
}

function updatePurchasedServers(ns: NS, purchasedServers: Record < string, ServerInfo > , misc: Misc): void {
    const servers = ns.getPurchasedServers();
    servers.push("home");
    for (const serverName of servers) {
        const server = ns.getServer(serverName);
        const serverInfo = purchasedServers[serverName] ?? new ServerInfo(server, "purchased");
        serverInfo.freeRam = server.maxRam - server.ramUsed;
        purchasedServers[serverName] = serverInfo;
        misc.ram += server.maxRam;
    }
}