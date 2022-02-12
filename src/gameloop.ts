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
    sortServerPotential
} from "libs/helper-lib.js"
import {
    scripts
} from "libs/deploy-lib.js"
import {
    RunningJob
} from "models/running-job"
import {
    progressLoop
} from "libs/network-lib"
import {
    Misc
} from "models/misc"
import {
    ServerPotential
} from "models/server-potential"
import {
    RunningJobs
} from '/models/running-jobs'
import {
    runGrow,
    runHack,
    runWeaken
} from '/libs/scripts-lib'
import {
    calculateServerGrowth,
    calculateHackingTime
} from '/libs/formulas-lib';

const batchLogFile = "batch-log-file.txt";

export async function main(ns: NS): Promise < void > {
    console.log("/// *** Starting main function of gameloop.js *** \\\\\\");
    const loop = ns.args[0] as boolean ?? true;
    const hackedServers: Record < string, ServerInfo > = {};
    const purchasedServers: Record < string, ServerInfo > = {};
    const runningJobs: RunningJobs = new RunningJobs;
    const misc: Misc = {
        ram: 0
    };

    await ns.write(batchLogFile, "[]", "w");
    while (true) {
        const started = Date.now();
        const player = ns.getPlayer();
        const gameStateLevel = await progressLoop(ns);
        console.log("/// *** Starting loop of gameloop.js at level " + gameStateLevel + " *** \\\\\\");
        updateServerInfo(ns, hackedServers, purchasedServers, misc, player);
        const priotizedServers = prioitizeServers(hackedServers, misc, gameStateLevel);

        for (const targetname of priotizedServers) {

            /** @type{ServerInfo} */
            const targetInfo = hackedServers[targetname];
            targetInfo.server = ns.getServer(targetname);
            const hacktime = ns.getHackTime(targetname);
            const growtime = ns.getGrowTime(targetname);
            const weakentime = ns.getWeakenTime(targetname);
            // console.log("#predictedStates initially:");
            // console.log(predictedStates);
            
            const now = Date.now();
            const hackEnd = Math.ceil(now + hacktime);
            const growEnd = Math.ceil(now + growtime);
            const weakenEnd = Math.ceil(now + weakentime);
            const predictedStates: Record < string, number[] > = {};
            predictTargetStates(predictedStates, targetInfo, player, ns, hackEnd, growEnd, weakenEnd, runningJobs);

            // runJobs
            for (const hostname of Object.keys(purchasedServers).concat(Object.keys(hackedServers))) {
                let serverInfo = purchasedServers[hostname];
                if (serverInfo == undefined) {
                    serverInfo = hackedServers[hostname];
                }
                if (serverInfo.freeRam < 4) continue;

                const beforeHackJobCount = 0;
                const beforeWeakenJobCount = 0;
                const beforeGrowJobCount = 0;

                if (predictedStates[scripts[2]][0] == targetInfo.server.minDifficulty && predictedStates[scripts[2]][1] == targetInfo.server.moneyMax) {
                    // console.log("predict " + targetname + " after hacktime: security " + predictedStates[scripts[2]][0] + "/" + targetInfo.server.minDifficulty + "; money " + predictedStates[scripts[2]][1] + "/" + targetInfo.server.moneyMax + "; " + beforeHackJobCount + " jobs before");
                    const newRunningJob = await runHack(serverInfo, targetInfo, predictedStates[scripts[2]][1], ns, now, hackEnd, runningJobs);
                    if (newRunningJob != null) {
                        predictTargetStatesAfterHack(predictedStates, newRunningJob, targetInfo, ns, player)
                        continue;
                    }
                }
                if (predictedStates[scripts[0]][0] != targetInfo.server.minDifficulty) {
                    console.log("predict " + targetname + " after weakentime: security " + predictedStates[scripts[0]][0] + "/" + targetInfo.server.minDifficulty + "; money " + predictedStates[scripts[0]][1] + "/" + targetInfo.server.moneyMax + "; " + beforeWeakenJobCount + " jobs before");
                    const newRunningJob = await runWeaken(serverInfo, targetInfo, predictedStates[scripts[0]], ns, now, weakenEnd, runningJobs);
                    if (newRunningJob != null) {
                        predictTargetStatesAfterWeaken(predictedStates, newRunningJob, targetInfo, ns, player)
                        continue;
                    }
                }
                if (predictedStates[scripts[1]][0] == targetInfo.server.minDifficulty && predictedStates[scripts[1]][1] != targetInfo.server.moneyMax) {
                    console.log("predict " + targetname + " after growtime: security " + predictedStates[scripts[1]][0] + "/" + targetInfo.server.minDifficulty + "; money " + predictedStates[scripts[1]][1] + "/" + targetInfo.server.moneyMax + "; " + beforeGrowJobCount + " jobs before");
                    const newRunningJob = await runGrow(serverInfo, targetInfo, predictedStates[scripts[1]][0], predictedStates[scripts[1]][1], ns, now, growEnd, runningJobs, player);
                    if (newRunningJob != null) {
                        predictTargetStatesAfterGrow(predictedStates, newRunningJob, targetInfo, ns, player)
                        continue;
                    }
                }
            }
        }

        console.log(runningJobs);
        const ended = Date.now();
        console.log("Loop took " + (ended - started) + " ms");
        if (!loop) break;
        await ns.sleep(10000);
    }
}

function predictTargetStates(predictedStates: Record < string, number[] > , targetInfo: ServerInfo, player: Player, ns: NS, hackEnd: number, growEnd: number, weakenEnd: number, runningJobs: RunningJobs): void {
    predictedStates[scripts[0]] = [targetInfo.server.hackDifficulty, targetInfo.server.moneyAvailable, 0];
    predictedStates[scripts[1]] = [targetInfo.server.hackDifficulty, targetInfo.server.moneyAvailable, 0];
    predictedStates[scripts[2]] = [targetInfo.server.hackDifficulty, targetInfo.server.moneyAvailable, 0];

    const runningJobsOnTarget = runningJobs.jobs?.filter((x: RunningJob) => x.target == targetInfo.server.hostname);
    for (let i = 0; i < runningJobsOnTarget.length; i++) {
        const runningJob = runningJobsOnTarget[i];

        // Remove finished jobs
        if (!ns.isRunning(runningJob.pid, runningJob.hostname)) {
            // console.log("did not find job " + runningJob.type + " on " + runningJob.hostname + " args " + runningJob.target + ", " + runningJob.start);
            const index = runningJobs.jobs.indexOf(runningJob);
            runningJobs.jobs.splice(index, 1);
            continue;
        }

        // Predict state end of hack job
        if (runningJob.end < hackEnd) {
            predictTargetStatesAfterHack(predictedStates, runningJob, targetInfo, ns, player)
        }

        // Predict state end of grow job
        if (runningJob.end < growEnd) {
            predictTargetStatesAfterGrow(predictedStates, runningJob, targetInfo, ns, player)
        }

        // Predict state end of weaken job
        if (runningJob.end < weakenEnd) {
            predictTargetStatesAfterWeaken(predictedStates, runningJob, targetInfo, ns, player)
        }
        // console.log("#predictedStates "+runningJob.type+" leads to:");
        // console.log(predictedStates);
    }
}

function predictTargetStatesAfterWeaken(predictedStates: Record<string, number[]>, runningJob: RunningJob, targetInfo: ServerInfo, ns: NS, player: Player) {
    const predictedSecurity = predictSecurityForJob(runningJob, predictedStates[scripts[0]][0], targetInfo)
    const securityDiff = (predictedSecurity - predictedStates[scripts[0]][0])
    predictedStates[scripts[0]][0] = predictedSecurity
    predictedStates[scripts[0]][1] = predictMoneyForJob(predictedStates[scripts[0]][0], predictedStates[scripts[0]][1], runningJob, targetInfo, ns, player)
    predictedStates[scripts[0]][2] += securityDiff
}

function predictTargetStatesAfterGrow(predictedStates: Record<string, number[]>, runningJob: RunningJob, targetInfo: ServerInfo, ns: NS, player: Player) {
    const predictedSecurity = predictSecurityForJob(runningJob, predictedStates[scripts[1]][0], targetInfo)
    const securityDiff = (predictedSecurity - predictedStates[scripts[1]][0])
    predictedStates[scripts[1]][0] = predictedSecurity
    predictedStates[scripts[1]][1] = predictMoneyForJob(predictedStates[scripts[1]][0], predictedStates[scripts[1]][1], runningJob, targetInfo, ns, player)
    predictedStates[scripts[1]][2] += securityDiff
}

function predictTargetStatesAfterHack(predictedStates: Record<string, number[]>, runningJob: RunningJob, targetInfo: ServerInfo, ns: NS, player: Player) {
    const predictedSecurity = predictSecurityForJob(runningJob, predictedStates[scripts[2]][0], targetInfo)
    const securityDiff = (predictedSecurity - predictedStates[scripts[2]][0])
    predictedStates[scripts[2]][0] = predictedSecurity
    predictedStates[scripts[2]][1] = predictMoneyForJob(predictedStates[scripts[2]][0], predictedStates[scripts[2]][1], runningJob, targetInfo, ns, player)
    predictedStates[scripts[2]][2] += securityDiff
}

function prioitizeServers(hackedServers: Record < string, ServerInfo > , misc: Misc, gameStateLevel: number): string[] {

    let servers: ServerPotential[] = [];

    for (const hostname in hackedServers) {
        /** @type{ServerInfo} */
        const serverInfo = hackedServers[hostname];
        servers.push(new ServerPotential(serverInfo.hackPotential, hostname));
    }
    servers = servers.sort(sortServerPotential).reverse();

    const priotizedServers = [];
    for (const server of servers) {
        if (server.potential > 1000) {
            // if (hackedServers[server.hostname].server.minDifficulty > (gameStateLevel > 3 ? gameStateLevel + 1 : 3)) {
            //     // console.log("too early for "+server[1]);
            // } else {
            //     priotizedServers.push(server.hostname);
            // }
            priotizedServers.push(server.hostname);
        }
    }

    // console.log("Priotize target " + priotizedServers[0] + " with minSecurity " + hackedServers[priotizedServers[0]].server.minDifficulty + " and maxMoney " + hackedServers[priotizedServers[0]].server.moneyMax);
    return priotizedServers;
}

function predictMoneyForJob(predictedSecurity: number, predictedMoney: number, runningJob: RunningJob, targetInfo: ServerInfo, ns: NS, player: Player): number {
    if (runningJob.type == scripts[1]) {
        let money = predictedMoney * runningJob.expectedOutcome;
        if (money > targetInfo.server.moneyMax) money = targetInfo.server.moneyMax;
        return money;
    }
    if (runningJob.type == scripts[2]) {
        let money = predictedMoney - runningJob.expectedOutcome;
        if (money < 0) money = 0;
        return money;
    }
    return predictedMoney;
}

function predictSecurityForJob(runningJob: RunningJob, predictedSecurity: number, targetInfo: ServerInfo): number {
    if (runningJob.type == scripts[0]) {
        let security = predictedSecurity - (targetInfo.weakenAmount * runningJob.threads);
        if (security < targetInfo.server.minDifficulty) {
            security = targetInfo.server.minDifficulty;
        }
        return security;
    }
    if (runningJob.type == scripts[1]) {
        return predictedSecurity + (targetInfo.growSecurityRise * runningJob.threads);
    }
    if (runningJob.type == scripts[2]) {
        return predictedSecurity + (targetInfo.hackSecurityRise * runningJob.threads);
    }
    return predictedSecurity;
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