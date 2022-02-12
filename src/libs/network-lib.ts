import { NS } from '@ns'
import {
	tryPurchaseServer,
	tryReplaceServer,
	allServersUpgraded,
	exploreAndRootServers
} from "libs/server-lib.js";
import {
	tryPurchaseNode,
	tryUpgradeNodes,
	allNodesUpgraded
} from "libs/node-lib.js";
import {
	getNumberOfOwnedPortBusters
} from "libs/hack-lib";

// Comment import of getNumberOfOwnedPortBusters and executeInTerminal if home RAM is under 64 GB
import { executeInTerminal } from "libs/terminal-lib";

export const gameStateFile = "game-state-level.txt";
let gameStateLevel;

export async function main(ns: NS): Promise < void > {
	const loop = ns.args[0] ?? true;
	await progressLoop(ns);
	while (loop) {
		await progressLoop(ns);
		await ns.asleep(1000);
	}
}

export async function getGameStateLevel(ns: NS) : Promise<number> {
	let level = parseInt(await ns.read(gameStateFile));
	if (level < 2 && ns.getPlayer().money >= 440000) {
		ns.tprintf("!!! Progressed to Game State Level 2: Purchasing servers");
		level = 2;
		await ns.write(gameStateFile, level, "w");
	} else if (level < 3) {
		const servers = ns.getPurchasedServers();
		if (servers.length == ns.getPurchasedServerLimit()) {
			ns.tprintf("!!! Progressed to Game State Level 3: All servers purchased, start purchasing nodes");
			level = 3;
			await ns.write(gameStateFile, level, "w");
		}
	} else if (level == 3 && allNodesUpgraded(ns, 10, 10)) {
		ns.tprintf("!!! Progressed to Game State Level 4: All nodes upgraded, start buying port busters");
		level = 4;
		await ns.write(gameStateFile, level, "w");
	} else if (level == 4 && getNumberOfOwnedPortBusters(ns) == 5) {
		if (getNumberOfOwnedPortBusters != undefined && getNumberOfOwnedPortBusters(ns) == 5) {
			ns.tprintf("!!! Progressed to Game State Level 5: All port busters bought, start upgrading purchased servers");
			level = 5;
			await ns.write(gameStateFile, level, "w");
		} else {
			ns.tprint("Upgrade home RAM and uncomment imports in libs\network-lib.js");
		}
	} else if (level == 5 && ns.getPlayer().money >= 500000000) {
		ns.tprintf("!!! Progressed to Game State Level 6: 500m $");
		level = 6;
		await ns.write(gameStateFile, level, "w");
	} else if (level == 6 && allServersUpgraded(ns, 4096)) {
		ns.tprintf("!!! Progressed to Game State Level 7: All servers upgraded, next node upgrades");
		level = 7;
		await ns.write(gameStateFile, level, "w");
	} else if (level == 7 && allNodesUpgraded(ns, 20, 200)) {
		ns.tprintf("!!! Progressed to Game State Level 8: More server upgrades...");
		level = 8;
		await ns.write(gameStateFile, level, "w");
	}

	//ns.tprintf("getGameStateLevel: %u", level);
	return level;
}

export async function progressLoop(ns: NS) : Promise<number> {
	// const previousLevel = gameStateLevel;
	gameStateLevel = await getGameStateLevel(ns);
	// const progressedGameStateLevel = (previousLevel == undefined && gameStateLevel != undefined) || (previousLevel < gameStateLevel);

	if (gameStateLevel == 1) {
		//tryBuyPortBusters(ns);
		await exploreAndRootServers(ns, "home", "home");
	} else if (gameStateLevel == 2) {
		//tryBuyPortBusters(ns);
		await exploreAndRootServers(ns, "home", "home");
		await tryPurchaseServer(ns, null);
	} else if (gameStateLevel == 3) {
		//tryBuyPortBusters(ns);
		await exploreAndRootServers(ns, "home", "home");
		await tryPurchaseNode(ns, 10);
		await tryUpgradeNodes(ns, 10);
	} else if (gameStateLevel == 4) {
		await exploreAndRootServers(ns, "home", "home");
		if (!ns.scan("home").includes("darkweb") && ns.getPlayer().money >= 200000) {
			ns.tprint("Buy TOR router");
		} else {
			if (typeof executeInTerminal !== 'undefined') {
				const ownedPortBusters = getNumberOfOwnedPortBusters(ns);
				if (ownedPortBusters == 0 && ns.getPlayer().money >= 500000) {
					await executeInTerminal(ns, "buy BruteSSH.exe");
				} else if (ownedPortBusters == 1 && ns.getPlayer().money >= 1500000) {
					await executeInTerminal(ns, "buy FTPCrack.exe");
				} else if (ownedPortBusters == 2 && ns.getPlayer().money >= 5000000) {
					await executeInTerminal(ns, "buy relaySMTP.exe");
				} else if (ownedPortBusters == 3 && ns.getPlayer().money >= 30000000) {
					await executeInTerminal(ns, "buy HTTPWorm.exe");
				} else if (ownedPortBusters == 4 && ns.getPlayer().money >= 250000000) {
					await executeInTerminal(ns, "buy SQLInject.exe");
				}
			} else {
				ns.tprint("Buy RAM and import executeInTerminal in script or buy port busters");
			}
		}
	} else if (gameStateLevel == 5) {
		//tryBuyPortBusters(ns);
		await exploreAndRootServers(ns, "home", "home")
		await tryReplaceServer(ns, 512);
	} else if (gameStateLevel == 6) {
		//tryBuyPortBusters(ns);
		await exploreAndRootServers(ns, "home", "home")
		await tryReplaceServer(ns, 4096);
	} else if (gameStateLevel == 7) {
		//tryBuyPortBusters(ns);
		await exploreAndRootServers(ns, "home", "home")
		await tryPurchaseNode(ns, 20);
		await tryUpgradeNodes(ns, 200);
	} else if (gameStateLevel == 8) {
		await exploreAndRootServers(ns, "home", "home")
		// await tryReplaceServer(ns, 65536);
	}

	return gameStateLevel;
}