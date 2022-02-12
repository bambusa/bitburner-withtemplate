import {
    NS,
    Server
} from '@ns'
import {
    deployScriptTo,
    scripts
} from "libs/deploy-lib"
import {
    tryRootServer
} from '/libs/hack-lib';
import {
    executeInTerminal
} from "libs/terminal-lib";
import {
    ServerHierarchy
} from '/models/server-hierarchy';

const purchasedServerPrefix = "pserv";

export async function main(ns: NS): Promise < void > {
    const servers = findHackedServers(ns, "home", "home", null);
    for (const server of servers.concat(ns.getPurchasedServers())) {
        await deployScriptTo(ns, scripts, "home", server);
    }
}

export function findHackableServers(ns: NS, home: string, origin: string | null = null): string[] {
    const servers = ns.scan(home);
    const hackedServers: string[] = [];
    servers.forEach(function (server) {
        if (!server.startsWith(purchasedServerPrefix) && server != origin) {
            hackedServers.push(server);
        }
    });

    return hackedServers;
}

export function findHackedServers(ns: NS, home: string, origin: string, hackedServers: string[] | null): string[] {
    if (home == undefined) {
        ns.alert("server-lib:findHackedServers | missing home argument");
        return [];
    }
    if (hackedServers == null) {
        hackedServers = [];
    }
    const hostnames = findHackableServers(ns, home, origin);

    if (hostnames.length > 0) {
        for (let i = 0; i < hostnames.length; i++) {
            const iHostname = hostnames[i];
            const server = ns.getServer(iHostname);
            if (server.hasAdminRights) {
                hackedServers.push(iHostname);
                findHackedServers(ns, iHostname, home, hackedServers);
            }
        }
    }
    return hackedServers;
}

export function allServersUpgraded(ns: NS, ram: number): boolean {
    for (let i = 0; i < ns.getPurchasedServers().length; i++) {
        const hostname = ns.getPurchasedServers()[i];
        if (ns.getServerMaxRam(hostname) < ram) {
            return false;
        }
    }
    return true;
}

export async function exploreAndRootServers(ns: NS, hostname: string, visitedHosts: string[], serverHierarchy: ServerHierarchy | null = null): Promise < void > {
    // console.log("exploreAndRootServers " + hostname);
    visitedHosts.push(hostname);
    if (serverHierarchy == null) {
        serverHierarchy = new ServerHierarchy(hostname);
    }
    const hackableServers = findHackableServers(ns, hostname, visitedHosts[visitedHosts.length - 1]);
    for (const child of hackableServers) {
        serverHierarchy.children.push(new ServerHierarchy(child));
    }

    if (hostname != "home") {
        const server = ns.getServer(hostname);
        if (await tryRootServer(ns, server)) {
        await tryInstallBackdoor(ns, server, serverHierarchy);
        }
    }

    for (const child of serverHierarchy.children) {
        if (!visitedHosts.includes(child.hostname)) {
            await exploreAndRootServers(ns, child.hostname, visitedHosts, serverHierarchy);
        }
    }
}

async function tryInstallBackdoor(ns: NS, server: Server, serverHierarchy: ServerHierarchy): Promise < void > {
    const hostname = server.hostname;
    // console.log("tryInstallBackdoor at " + hostname);

    if (!server.backdoorInstalled) {
        ns.tprint("/// *** Using terminal to install backdoor at " + hostname + " *** \\\\\\");
        ns.tprint("/// *** please wait *** \\\\\\");
        if (!await executeInTerminal(ns, "home ")) {
            return;
        }

        const hostPath: string[] = [];
        const history: string[] = [];
        Search(ns, "home", hostname, hostPath, history);
        for (const host of hostPath) {
            if (host == "home") {
                continue
            }
            await executeInTerminal(ns, "connect " + host);
        }

        await executeInTerminal(ns, "backdoor");
        // wait for command to finish
        let terminalLi = await eval("document.getElementById('terminal').getElementsByTagName('li');");
        let lastLi = terminalLi[terminalLi.length - 1];
        const searchingFor = "Backdoor on '" + hostname + "' successful!";
        while (!lastLi.innerText.includes(searchingFor)) {
            // console.log("looking for " + searchingFor);
            await ns.sleep(1000);
            terminalLi = await eval("document.getElementById('terminal').getElementsByTagName('li');");
            lastLi = terminalLi[terminalLi.length - 1];
        }

        await executeInTerminal(ns, "home");
        ns.tprint("\\\\\\ *** Finished using terminal *** ///");
    }

}

function Search(ns: NS, node: string | null, value: string, track: string[], history: string[]): boolean {
    if (node == null) return false;
    history.push(node);

    if (node == value) {
        track.push(node);
        return true;
    }

    const children = findHackableServers(ns, node, track[track.length-1]);
    // console.log("found children of "+node+": "+children.toString());
    for (const child of children) {
        if (history.includes(child)) continue;
        if (Search(ns, child, value, track, history)) {
            track.splice(0, 0, node);
            return true;
        }
    }

    return false;
}

function searchInChildren(serverHierarchy: ServerHierarchy, hostPath: ServerHierarchy[], hostHistory: ServerHierarchy[], searchingFor: string): void {
    // console.log("searchInChildren "+serverHierarchy.hostname);
    // console.log("hostPath "+hostPath.length);
    hostHistory.push(serverHierarchy);
    for (const child of serverHierarchy.children) {
        if (!hostHistory.includes(child)) {
            hostPath.push(serverHierarchy);
            if (child.hostname == searchingFor) {
                // console.log("found it! "+child.hostname);
                hostPath.push(child);
                return;
            }
            searchInChildren(child, hostPath, hostHistory, searchingFor);
        }
    }

    const lastStep = hostHistory[hostPath.length - 1];
    // console.log("go back to lastStep "+lastStep.hostname);
    hostPath.splice(hostPath.indexOf(lastStep), 1);
    searchInChildren(lastStep, hostPath, hostHistory, searchingFor);
}

export async function tryReplaceServer(ns: NS, ram: number): Promise < string | null > {
    for (let i = 0; i < ns.getPurchasedServers().length; i++) {
        const hostname = ns.getPurchasedServers()[i];
        if (ns.getServerMaxRam(hostname) < ram) {
            const moneyAvailable = ns.getServerMoneyAvailable("home");
            const moneyNeeded = ns.getPurchasedServerCost(ram);
            if (moneyAvailable > moneyNeeded) {
                ns.tprintf("Replacing purchased server %s", hostname);
                ns.killall(hostname);
                ns.deleteServer(hostname);
                const purchased = await tryPurchaseServer(ns, ram);
                return purchased;
            } else {
                // console.log("- Money available %s; needed for %s GB RAM: %s", ns.nFormat(moneyAvailable, '0.a'), ram, ns.nFormat(moneyNeeded, '0.a'));
            }
        }
    }
    return null;
}

export async function tryPurchaseServer(ns: NS, ram: number | null): Promise < string | null > {
    //ns.tprintf("Trying to purchase new servers...");
    if (ram == null) {
        ram = 8;
    }

    const purchasedServerLength = ns.getPurchasedServers().length;
    if (purchasedServerLength < ns.getPurchasedServerLimit()) {
        const moneyAvailable = ns.getServerMoneyAvailable("home");
        const moneyNeeded = ns.getPurchasedServerCost(ram);
        if (moneyAvailable > moneyNeeded) {
            ns.tprintf("- Purchasing new %u GB server", ram);
            const purchased = ns.purchaseServer(purchasedServerPrefix, ram);
            if (purchased) {
                await deployScriptTo(ns, scripts, "home", purchased);
                return purchased;
            }
        } else {
            //console.log("-- Could not purchase server; Missing " + ns.nFormat(moneyAvailable - moneyNeeded, '0a') + " $ for sale price of " + ns.nFormat(moneyNeeded, '0a') + " $")
            //ns.tprint("-- Could not purchase server; Missing "+ns.nFormat(moneyAvailable - moneyNeeded, '0a')+" $ for sale price of "+ns.nFormat(moneyNeeded, '0a')+" $");
        }
    } else {
        //console.log("- Server limit reached");
        //ns.tprint("- Server limit reached");
    }
    return null;
}