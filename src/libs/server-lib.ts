import {
    NS
} from '@ns'
import {
    deployScriptTo,
    scripts
} from "libs/deploy-lib"
import { tryRootServer } from '/libs/hack-lib';

const purchasedServerPrefix = "pserv";

export async function main(ns: NS): Promise < void > {
    const servers = findHackedServers(ns, "home", "home", null);
    for (const server of servers.concat(ns.getPurchasedServers())) {
        await deployScriptTo(ns, scripts, "home", server);
    }
}

export function findHackableServers(ns: NS, home: string, origin: string) : string[] {
    const servers = ns.scan(home);
    const hackedServers: string[] = [];
    servers.forEach(function (server) {
        if (!server.startsWith(purchasedServerPrefix) && server != origin) {
            hackedServers.push(server);
        }
    });

    return hackedServers;
}

export function findHackedServers(ns: NS, home: string, origin: string, hackedServers: string[] | null) : string[] {
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

export function allServersUpgraded(ns: NS, ram: number) : boolean {
    for (let i = 0; i < ns.getPurchasedServers().length; i++) {
        const hostname = ns.getPurchasedServers()[i];
        if (ns.getServerMaxRam(hostname) < ram) {
            return false;
        }
    }
    return true;
}

export async function exploreAndRootServers(ns: NS, home: string, origin: string): Promise<void> {
    const hostnames = findHackableServers(ns, home, origin);
    if (hostnames.length > 0) {
        //ns.tprintf("-- Found hackable servers at %s from %s: %s", home, origin, hostnames);
        for (let i = 0; i < hostnames.length; i++) {
            const iHostname = hostnames[i];
            if (await tryRootServer(ns, iHostname)) {
                await exploreAndRootServers(ns, iHostname, home);
            }
        }
    }
}

export async function tryReplaceServer(ns:NS, ram:number):Promise<string|null> {
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
                return  purchased;
            } else {
                console.log("- Money available %s; needed for %s GB RAM: %s", ns.nFormat(moneyAvailable, '0.a'), ram, ns.nFormat(moneyNeeded, '0.a'));
                
            }
        }
    }
    return null;
}

export async function tryPurchaseServer(ns:NS, ram:number|null):Promise<string|null> {
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