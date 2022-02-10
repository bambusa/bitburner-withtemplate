import {
    NS, Player
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
import {calculateHackingTime, calculateGrowTime, calculateWeakenTime} from "libs/formulas-lib"
import {Misc} from "models/misc"
import {ServerPotential} from "models/server-potential"
import { RunningJobs } from '/models/running-jobs'

let hackScriptRam : number;
let weakenScriptRam : number;
let growScriptRam : number;
const batchLogFile = "batch-log-file.txt";

export async function main(ns: NS): Promise < void > {
    console.log("/// *** Starting main function of gameloop.js *** \\\\\\");
    const loop = ns.args[0] as boolean ?? true;
    const hackedServers : Record<string, ServerInfo> = {};
    const purchasedServers : Record<string, ServerInfo> = {};
    const runningJobs : RunningJobs = new RunningJobs;
    const misc : Misc = {ram:0};

    await ns.write(batchLogFile, "[]", "w");
    initScriptRam(ns);
    while (true) {
        console.log("/// *** Starting loop of gameloop.js *** \\\\\\");
        const started = Date.now();
        const player = ns.getPlayer();
        const gameStateLevel = await progressLoop(ns);
        console.log("Game State Level: " + gameStateLevel);
        updateServerInfo(ns, hackedServers, purchasedServers, misc, player);
        const priotizedServers = prioitizeServers(hackedServers, misc, gameStateLevel);

        // runJobs
        for (const hostname of Object.keys(purchasedServers).concat(Object.keys(hackedServers))) {
            let serverInfo = purchasedServers[hostname];
            if (serverInfo == undefined) {
                serverInfo = hackedServers[hostname];
            }
            if (serverInfo.freeRam < weakenScriptRam) continue;

            for (const targetname of priotizedServers) {
                if (serverInfo.freeRam < weakenScriptRam) continue;

                /** @type{ServerInfo} */
                const targetInfo = hackedServers[targetname];
                const hacktime = ns.getHackTime(targetname);
                const growtime = ns.getGrowTime(targetname);
                const weakentime = ns.getWeakenTime(targetname);

                const predictedStates : Record<string,number[]> = {};
                predictedStates[scripts[0]] = [targetInfo.server.hackDifficulty, targetInfo.server.moneyAvailable];
                predictedStates[scripts[1]] = [targetInfo.server.hackDifficulty, targetInfo.server.moneyAvailable];
                predictedStates[scripts[2]] = [targetInfo.server.hackDifficulty, targetInfo.server.moneyAvailable];

                // console.log("Check host " + hostname + " target " + targetname + " with freeRam " + serverInfo.freeRam + " approximately free threads " + approxThreads);

                const now = Date.now();
                const hackEnd = Math.ceil(now + hacktime);
                const growEnd = Math.ceil(now + growtime);
                const weakenEnd = Math.ceil(now + weakentime);

                for (const runningJob of runningJobs.jobs?.filter((x:RunningJob) => x.target == targetname)) {

                    // Remove finished jobs
                    if (!ns.isRunning(runningJob.type, runningJob.hostname, runningJob.target, runningJob.start.toString())) {
                        // console.log("did not find job "+runningJob.type+" on "+runningJob.hostname+" args "+runningJob.target+", "+runningJob.start);
                        const index = runningJobs.jobs.indexOf(runningJob);
                        runningJobs.jobs.splice(index, 1);
                        continue;
                    }

                    // Predict state end of hack job
                    if (runningJob.end < hackEnd) {
                        predictedStates[scripts[2]][0] = predictSecurityForJob(runningJob, predictedStates[scripts[2]][0], targetInfo);
                        predictedStates[scripts[2]][1] = predictMoneyForJob(predictedStates[scripts[2]][1], runningJob, targetInfo, ns);
                    }

                    // Predict state end of grow job
                    if (runningJob.end < growEnd) {
                        predictedStates[scripts[1]][0] = predictSecurityForJob(runningJob, predictedStates[scripts[1]][0], targetInfo);
                        predictedStates[scripts[1]][1] = predictMoneyForJob(predictedStates[scripts[1]][1], runningJob, targetInfo, ns);
                    }

                    // Predict state end of weaken job
                    if (runningJob.end < weakenEnd) {
                        predictedStates[scripts[0]][0] = predictSecurityForJob(runningJob, predictedStates[scripts[0]][0], targetInfo);
                        predictedStates[scripts[0]][1] = predictMoneyForJob(predictedStates[scripts[0]][1], runningJob, targetInfo, ns);
                    }
                }


                // console.log("predict "+targetname+" after hacktime: security " + predictedStates[scripts[2]][0] + "/" + targetInfo.server.minDifficulty + "; money " + predictedStates[scripts[2]][1] + "/" + targetInfo.server.moneyMax + "; " + beforeHackJobCount + " jobs before");
                // console.log("predict "+targetname+" after weakentime: security " + predictedStates[scripts[0]][0] + "/" + targetInfo.server.minDifficulty + "; money " + predictedStates[scripts[0]][1] + "/" + targetInfo.server.moneyMax + "; " + beforeWeakenJobCount + " jobs before");
                // console.log("predict "+targetname+" after growtime: security " + predictedStates[scripts[1]][0] + "/" + targetInfo.server.minDifficulty + "; money " + predictedStates[scripts[1]][1] + "/" + targetInfo.server.moneyMax + "; " + beforeGrowJobCount + " jobs before");

                if (predictedStates[scripts[2]][0] == targetInfo.server.minDifficulty && predictedStates[scripts[2]][1] == targetInfo.server.moneyMax) {
                    const newRunningJob = runHack(serverInfo, targetInfo, predictedStates[scripts[2]][1], ns, now, hackEnd, runningJobs);
                    if (newRunningJob != null) {
                        await ns.sleep(200);
                        continue;
                    }
                }
                if (predictedStates[scripts[0]][0] != targetInfo.server.minDifficulty) {
                    const newRunningJob = runWeaken(serverInfo, targetInfo, predictedStates[scripts[0]][0], ns, now, hackEnd, runningJobs);
                    if (newRunningJob != null) {
                        await ns.sleep(200);
                        continue;
                    }
                }
                if (predictedStates[scripts[1]][0] == targetInfo.server.minDifficulty && predictedStates[scripts[1]][1] != targetInfo.server.moneyMax) {
                    const newRunningJob = runGrow(serverInfo, targetInfo, predictedStates[scripts[1]][1], ns, now, hackEnd, runningJobs);
                    if (newRunningJob != null) {
                        await ns.sleep(200);
                        continue;
                    }
                }

            }
        }

        console.log(runningJobs);
        const ended = Date.now();
        console.log("Loop took " + (ended - started) + " ms");
        if (!loop) break;
        await ns.sleep(10);
    }
}

function prioitizeServers(hackedServers: Record<string, ServerInfo>, misc: Misc, gameStateLevel: number): string[] {
    
    let servers : ServerPotential[] = [];

    for (const hostname in hackedServers) {
        /** @type{ServerInfo} */
        const serverInfo = hackedServers[hostname];
        servers.push(new ServerPotential(serverInfo.hackPotential, hostname));
    }
    servers = servers.sort(sortServerPotential).reverse();

    const priotizedServers = [];
    for (const server of servers) {
        if (server.potential > 1000) {
            // console.log("server[0] / misc[ram] = "+(server[0] / misc["ram"]));
            if (hackedServers[server.hostname].server.minDifficulty > (gameStateLevel > 3 ? gameStateLevel + 1 : 3)) {
                // console.log("too early for "+server[1]);
            } else {
                priotizedServers.push(server.hostname);
            }
        }
    }

    console.log("Priotize target " + priotizedServers[0] + " with minSecurity " + hackedServers[priotizedServers[0]].server.minDifficulty + " and maxMoney " + hackedServers[priotizedServers[0]].server.moneyMax);
    // console.log("misc[ram] = "+misc["ram"]);
    // console.log(servers);
    return priotizedServers;
}

function runHack(serverInfo: ServerInfo, targetInfo: ServerInfo, predictedMoney: number, ns: NS, now: number, hackEnd: number, runningJobs: RunningJobs): RunningJob | null {
    let threads = Math.floor(serverInfo.freeRam / hackScriptRam);
    if (threads < 1) {
        // console.log("hack threads < 1: serverInfo.freeRam "+serverInfo.freeRam+" / hackScriptRam "+hackScriptRam+")");
        return null;
    }
    if (targetInfo.hackAmount * threads > predictedMoney) {
        threads = Math.ceil(predictedMoney / targetInfo.hackAmount);
        if (threads < 1) {
            console.log("hack threads < 1: (predictedMoney " + predictedMoney + " / targetInfo.hackAmount " + targetInfo.hackAmount + " = " + threads);
        }
    }
    if (threads < 1) {
        threads = 1;
    }
    const pid = ns.exec(scripts[2], serverInfo.server.hostname, threads, targetInfo.server.hostname, now, hackEnd);
    if (pid > 0) {
        const expectedOutcome = predictedMoney - (targetInfo.hackAmount * threads);
        const newRunningJob = new RunningJob(pid, scripts[2], serverInfo.server.hostname, targetInfo.server.hostname, threads, now, hackEnd, expectedOutcome);
        runningJobs["jobs"].push(newRunningJob);
        serverInfo.freeRam -= hackScriptRam * threads;
        // console.log("Exec " +pid+" " +scripts[2] + " on " + serverInfo.server.hostname + " with " + threads + " threads and args " + targetInfo.server.hostname + ", "+now+ "; expectedOutcome " + expectedOutcome);
        return newRunningJob;
    } else {
        console.log("Failed " + scripts[2] + " on " + serverInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname);
    }
    return null;
}

function runWeaken(serverInfo: ServerInfo, targetInfo: ServerInfo, predictedSecurity: number, ns: NS, now: number, hackEnd: number, runningJobs: RunningJobs) : RunningJob | null {
    let threads = Math.floor(serverInfo.freeRam / weakenScriptRam);
    if (threads < 1) {
        // console.log("weaken threads < 1: serverInfo.freeRam "+serverInfo.freeRam+" / weakenScriptRam "+weakenScriptRam);
        return null;
    }
    if (targetInfo.weakenAmount * threads > predictedSecurity - targetInfo.server.minDifficulty) {
        threads = Math.ceil((predictedSecurity - targetInfo.server.minDifficulty) / targetInfo.weakenAmount);
        if (threads < 1) {
            console.log("weaken threads < 1: (predictedSecurity " + predictedSecurity + " - targetInfo.server.minDifficulty " + targetInfo.server.minDifficulty + ") / targetInfo.weakenAmount " + targetInfo.weakenAmount + " = " + threads);
        }
    }
    if (threads < 1) {
        threads = 1;
    }

    const pid = ns.exec(scripts[0], serverInfo.server.hostname, threads, targetInfo.server.hostname, now, hackEnd);
    if (pid > 0) {
        const expectedOutcome = predictedSecurity - (targetInfo.weakenAmount * threads);
        // console.log("expectedOutcome "+expectedOutcome+" = predictedSecurity "+predictedSecurity+" - (targetInfo.weakenAmount "+targetInfo.weakenAmount +" * threads "+threads+")");
        const newRunningJob = new RunningJob(pid, scripts[0], serverInfo.server.hostname, targetInfo.server.hostname, threads, now, hackEnd, expectedOutcome);
        runningJobs["jobs"].push(newRunningJob);
        serverInfo.freeRam -= weakenScriptRam * threads;
        // console.log("Exec " + scripts[0] + " on " + serverInfo.server.hostname + " with " + threads + " threads and args " + targetInfo.server.hostname + ", "+now+ "; expectedOutcome " + expectedOutcome);
        return newRunningJob;
    } else {
        console.log("Failed " + scripts[0] + " on " + serverInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname);
    }
    return null;
}

function runGrow(serverInfo: ServerInfo, targetInfo: ServerInfo, predictedMoney: number, ns: NS, now: number, hackEnd: number, runningJobs: RunningJobs): RunningJob | null {
    let threads = Math.floor(serverInfo.freeRam / growScriptRam);
    if (threads < 1) {
        // console.log("grow threads < 1: serverInfo.freeRam "+serverInfo.freeRam+" / growScriptRam "+growScriptRam);
        return null;
    }
    const growNeeded = targetInfo.server.moneyMax / predictedMoney;
    if ((targetInfo.growThreadsToDouble * threads / 2) > growNeeded) {
        threads = Math.ceil(growNeeded / targetInfo.growThreadsToDouble / 2);
        if (threads < 1) {
            console.log("grow threads < 1: (growNeeded " + growNeeded + " / targetInfo.growThreadsToDouble " + targetInfo.growThreadsToDouble + " / 2 = " + threads);
        }
    }
    if (threads < 1) {
        threads = 1;
    }
    const pid = ns.exec(scripts[1], serverInfo.server.hostname, threads, targetInfo.server.hostname, now, hackEnd);
    if (pid > 0) {
        const expectedOutcome = (threads / targetInfo.growThreadsToDouble * 2) * predictedMoney;
        const newRunningJob = new RunningJob(pid, scripts[1], serverInfo.server.hostname, targetInfo.server.hostname, threads, now, hackEnd, expectedOutcome);
        runningJobs["jobs"].push(newRunningJob);
        serverInfo.freeRam -= growScriptRam * threads;
        // console.log("Exec " + scripts[1] + " on " + serverInfo.server.hostname + " with " + threads + " threads and args " + targetInfo.server.hostname + ", "+now+ "; expectedOutcome " + expectedOutcome);
        return newRunningJob;
    } else {
        console.log("Failed " + scripts[1] + " on " + serverInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname);
    }
    return null;
}

function predictMoneyForJob(predictedMoney: number, runningJob: RunningJob, targetInfo: ServerInfo, ns: NS): number {
    let money = predictedMoney;
    if (runningJob.type == scripts[1]) {
        const growMultiplier = 2 * runningJob.threads / ns.growthAnalyze(targetInfo.server.hostname, 2);
        // console.log("growMultiplier "+growMultiplier+" = 2 * runningJob.threads "+runningJob.threads+" / ns.growthAnalyze(targetInfo.server.hostname, 2) "+ns.growthAnalyze(targetInfo.server.hostname, 2));
        money += money * growMultiplier;
        if (targetInfo.server.moneyMax < money) {
            money = targetInfo.server.moneyMax;
        }
    }
    return money;
}

function predictSecurityForJob(runningJob: RunningJob, predictedSecurity: number, targetInfo: ServerInfo): number {
    let security = predictedSecurity;
    if (runningJob.type == scripts[0]) {
        security -= targetInfo.weakenAmount * runningJob.threads;
        if (security < targetInfo.server.minDifficulty) {
            security = targetInfo.server.minDifficulty;
        }
        if (isNaN(security) || security == undefined) {
            console.log("security isNan || security == undefined: predictedSecurity " + predictedSecurity + " targetInfo.weakenAmount " + targetInfo.weakenAmount + " runningJob.threads " + runningJob.threads + " targetInfo.server.minDifficulty " + targetInfo.server.minDifficulty);
        }
    } else if (runningJob.type == scripts[1]) {
        security += targetInfo.growSecurityRise * runningJob.threads;
        if (isNaN(security) || security == undefined) {
            console.log("security isNan || security == undefined: predictedSecurity " + predictedSecurity + " targetInfo.growSecurityRise " + targetInfo.growSecurityRise + " runningJob.threads " + runningJob.threads + " targetInfo.server.minDifficulty " + targetInfo.server.minDifficulty);
        }
    } else if (runningJob.type == scripts[2]) {
        security += targetInfo.hackSecurityRise * runningJob.threads;
        if (isNaN(security) || security == undefined) {
            console.log("security isNan || security == undefined: predictedSecurity " + predictedSecurity + " targetInfo.hackSecurityRise " + targetInfo.hackSecurityRise + " runningJob.threads " + runningJob.threads + " targetInfo.server.minDifficulty " + targetInfo.server.minDifficulty);
        }
    }
    return security;
}

function initScriptRam(ns: NS) {
    if (weakenScriptRam == undefined) {
        weakenScriptRam = ns.getScriptRam(scripts[0]);
    }
    if (growScriptRam == undefined) {
        growScriptRam = ns.getScriptRam(scripts[1]);
    }
    if (hackScriptRam == undefined) {
        hackScriptRam = ns.getScriptRam(scripts[2]);
    }
}

function updateServerInfo(ns: NS, hackedServers: Record<string, ServerInfo>, purchasedServers: Record<string, ServerInfo>, misc: Misc, player: Player) {
    //console.log("updateServerInfo");
    misc.ram = 0;
    updateHackedServers(ns, hackedServers, player, misc);
    updatePurchasedServers(ns, purchasedServers, misc);
    //console.log(hackedServers);
}

function updateHackedServers(ns: NS, hackedServers: Record<string, ServerInfo>, player: Player, misc: Misc): void {
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
        serverInfo.hackPotential = serverInfo.hackAmount / serverInfo.server.minDifficulty;
        hackedServers[serverName] = serverInfo;
        misc.ram += server.maxRam;
    }
}

function updatePurchasedServers(ns: NS, purchasedServers: Record<string, ServerInfo>, misc: Misc): void {
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