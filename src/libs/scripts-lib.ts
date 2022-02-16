import {
    NS,
    Player
} from '@ns'
import {
    scripts
} from '/libs/deploy-lib';
import {
    RunningJob
} from '/models/running-job'
import {
    RunningJobs
} from '/models/running-jobs'
import {
    ServerInfo
} from "models/server-info"
import {
    calculateServerGrowth
} from '/libs/formulas-lib';

const execSleep = 10;
let hackScriptRam = -1;
let weakenScriptRam = -1;
let growScriptRam = -1;

export async function runHack(hostInfo: ServerInfo, targetInfo: ServerInfo, moneyAvailable: number, ns: NS, hackStart: number, hackEnd: number, runningJobs: RunningJobs): Promise < RunningJob | null > {
    if (hackScriptRam < 0) {
        hackScriptRam = ns.getScriptRam(scripts[2]);
    }
    const maxThreads = Math.floor(hostInfo.freeRam / hackScriptRam);
    if (maxThreads < 1) {
        return null;
    }

    const hackThreadsNeeded = Math.ceil((targetInfo.server.moneyMax / 2) / targetInfo.hackAmount);
    let threads = maxThreads < hackThreadsNeeded ? maxThreads : hackThreadsNeeded;
    if (threads < 1) {
        threads = 1;
    }

    const hacktime = Math.ceil(ns.getHackTime(targetInfo.server.hostname));
    hackStart = Date.now();
    hackEnd = Math.ceil(hackStart + hacktime);
    const expectedOutcome = targetInfo.hackAmount * threads;
    const pid = await ns.exec(scripts[2], hostInfo.server.hostname, threads, targetInfo.server.hostname, hackStart, hackEnd, hacktime, expectedOutcome);
    await ns.sleep(execSleep);

    if (pid > 0) {
        const newRunningJob = new RunningJob(pid, scripts[2], hostInfo.server.hostname, targetInfo.server.hostname, threads, hackStart, hackEnd, expectedOutcome, hacktime);
        runningJobs.jobs.push(newRunningJob);
        hostInfo.freeRam -= hackScriptRam * threads;
        console.log("Exec " + pid + " " + scripts[2] + " on " + hostInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname + ", expectedOutcome " + expectedOutcome + ", duration "+(hackEnd-hackStart));
        return newRunningJob;
    } else {
        console.log("Failed " + scripts[2] + " on " + hostInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname);
    }
    return null;
}

export async function runWeaken(hostInfo: ServerInfo, targetInfo: ServerInfo, predictedStates: number[], ns: NS, hackStart: number, hackEnd: number, runningJobs: RunningJobs): Promise < RunningJob | null > {
    if (weakenScriptRam < 0) {
        weakenScriptRam = ns.getScriptRam(scripts[0]);
    }
    const maxThreads = Math.floor(hostInfo.freeRam / weakenScriptRam);
    if (maxThreads < 1) {
        return null;
    }

    const weakenThreadsNeeded = Math.ceil((predictedStates[0] - targetInfo.server.minDifficulty) / targetInfo.weakenAmount);
    let threads = maxThreads < weakenThreadsNeeded ? maxThreads : weakenThreadsNeeded;
    if (threads < 1) {
        threads = 1;
    }

    const hacktime = Math.ceil(ns.getWeakenTime(targetInfo.server.hostname));
    hackStart = Date.now();
    hackEnd = Math.ceil(hackStart + hacktime);
    const expectedOutcome = predictedStates[2] - targetInfo.weakenAmount * threads;
    const pid = await ns.exec(scripts[0], hostInfo.server.hostname, threads, targetInfo.server.hostname, hackStart, hackEnd, hacktime, expectedOutcome);
    await ns.sleep(execSleep);

    if (pid > 0) {
        const newRunningJob = new RunningJob(pid, scripts[0], hostInfo.server.hostname, targetInfo.server.hostname, threads, hackStart, hackEnd, expectedOutcome, hacktime);
        runningJobs.jobs.push(newRunningJob);
        hostInfo.freeRam -= weakenScriptRam * threads;
        console.log("Exec " + scripts[0] + " on " + hostInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname + ", expectedOutcome " + expectedOutcome + ", duration "+(hackEnd-hackStart));
        return newRunningJob;
    } else {
        console.log("Failed " + scripts[0] + " on " + hostInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname);
    }
    return null;
}

export async function runGrow(hostInfo: ServerInfo, targetInfo: ServerInfo, difficulty: number, moneyAvailable: number, ns: NS, hackStart: number, hackEnd: number, runningJobs: RunningJobs, player: Player): Promise < RunningJob | null > {
    if (moneyAvailable == 0) {moneyAvailable = 1;}
    if (growScriptRam < 0) {
        growScriptRam = ns.getScriptRam(scripts[1]);
    }
    const maxThreads = Math.floor(hostInfo.freeRam / growScriptRam);
    if (maxThreads < 1) {
        return null;
    }

    const growNeeded = targetInfo.server.moneyMax / moneyAvailable;
    if (growNeeded <= 1) {
        return null;
    }
    const growThreadsNeeded = Math.ceil(ns.growthAnalyze(targetInfo.server.hostname, growNeeded));
    let threads = maxThreads < growThreadsNeeded ? maxThreads : growThreadsNeeded;
    if (threads < 1) {
        threads = 1;
    }

    const hacktime = Math.ceil(ns.getGrowTime(targetInfo.server.hostname));
    hackStart = Date.now();
    hackEnd = Math.ceil(hackStart + hacktime);
    const predictedServer = targetInfo.server;
    predictedServer.hackDifficulty = difficulty;
    const expectedOutcome = calculateServerGrowth(targetInfo.server, threads, player);
    const pid = await ns.exec(scripts[1], hostInfo.server.hostname, threads, targetInfo.server.hostname, hackStart, hackEnd, hacktime, expectedOutcome);
    await ns.sleep(execSleep);

    if (pid > 0) {
        const newRunningJob = new RunningJob(pid, scripts[1], hostInfo.server.hostname, targetInfo.server.hostname, threads, hackStart, hackEnd, expectedOutcome, hacktime);
        runningJobs.jobs.push(newRunningJob);
        hostInfo.freeRam -= growScriptRam * threads;
        console.log("Exec " + scripts[1] + " on " + hostInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname + ", expectedOutcome " + expectedOutcome + ", duration "+(hackEnd-hackStart));
        return newRunningJob;
    } else {
        console.log("Failed " + scripts[1] + " on " + hostInfo.server.hostname + " with " + threads + " threads and target " + targetInfo.server.hostname);
    }
    return null;
}