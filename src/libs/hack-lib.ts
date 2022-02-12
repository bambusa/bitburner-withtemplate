import { NS } from '@ns'
import {
    deployScriptTo, scripts
} from "libs/deploy-lib"
import { Server } from '@ns';

export const portBusters = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];

export function getNumberOfOwnedPortBusters(ns: NS):number {
    let ownedBusters = 0;
    for (let i = 0; i < portBusters.length; i++) {
        if (ns.fileExists(portBusters[i], 'home')) {
            ownedBusters++;
        }
    }
    //ns.tprintf("Owned busters: %u", ownedBusters);
    return ownedBusters;
}

/** @param {NS} ns **/
export async function tryRootServer(ns: NS, server: Server) : Promise <boolean> {
    if (server.hasAdminRights) {
        //ns.tprintf("- Root access to %s already gained", hostname);
        return true;
    }

    const hostname = server.hostname;
    if (server.requiredHackingSkill <= ns.getHackingLevel()) {
        const ownedBusters = await getNumberOfOwnedPortBusters(ns);
        if (server.numOpenPortsRequired <= ownedBusters) {
            if (ownedBusters >= 1 && !server.sshPortOpen) {
                ns.brutessh(hostname);
                ns.tprintf("-- BruteSSH on %s", hostname);
            }
            if (ownedBusters >= 2 && !server.ftpPortOpen) {
                ns.ftpcrack(hostname);
                ns.tprintf("-- FTPCrack on %s", hostname);
            }
            if (ownedBusters >= 3 && !server.smtpPortOpen) {
                ns.relaysmtp(hostname);
                ns.tprintf("-- relaySMTP on %s", hostname);
            }
            if (ownedBusters >= 4 && !server.httpPortOpen) {
                ns.httpworm(hostname);
                ns.tprintf("-- HTTPWorm on %s", hostname);
            }
            if (ownedBusters >= 5 && !server.sqlPortOpen) {
                ns.sqlinject(hostname);
                ns.tprintf("-- SQLInject on %s", hostname);
            }
            ns.nuke(hostname);
            ns.tprintf("- Gained root access to %s", hostname);

            /*if (hostname == "CSEC") {
                ns.alert("Gained root access to CSEC > Need to install backdoor manually");
            }
            else if (hostname == "avmnite-02h") {
                ns.alert("Gained root access to avmnite-02h > Need to install backdoor manually");
            }
            else if (hostname == "I.I.I.I") {
                ns.alert("Gained root access to I.I.I.I > Need to install backdoor manually");
            }
            else if (hostname == "run4theh111z") {
                ns.alert("Gained root access to run4theh111z > Need to install backdoor manually");
            }
            else if (hostname == "fulcrumassets") {
                ns.alert("Gained root access to fulcrumassets > Need to install backdoor manually");
            }*/

            await deployScriptTo(ns, scripts, "home", hostname);
            return true;
        }
    } else {
        //ns.tprintf("- Could not obtain root access to %s", hostname);
    }

    return false;
}