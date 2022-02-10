import { NS } from '@ns'

export function tryPurchaseNode(ns: NS, maxNumNodes: number): number | null {
    if (maxNumNodes == undefined) {
        maxNumNodes = 10;
    }

    if (ns.hacknet.numNodes() < maxNumNodes) {
        ns.print("Trying to purchase hacknet nodes");
        const moneyAvailable = ns.getServerMoneyAvailable("home");
        const moneyNeeded = ns.hacknet.getPurchaseNodeCost();
        if (moneyAvailable > moneyNeeded) {
            ns.tprintf("- Purchasing new hacknet node");
            return ns.hacknet.purchaseNode();
        }
    }
    else {
        ns.print("- Hacknet node limit reached");
    }
    return null;
}

export function tryUpgradeNodes(ns:NS, level:number): void {
    if (level == undefined) {
        level = 10;
    }

    if (!allNodesUpgraded(ns, level, null)) {
        ns.print("Trying to upgrade hacknet nodes");

        for (let i = 0; i < ns.hacknet.numNodes(); i++) {
            const node = ns.hacknet.getNodeStats(i);
            if (node.level < level) {
                if (ns.hacknet.getLevelUpgradeCost(i, level - node.level) < ns.getServerMoneyAvailable("home")) {
                    ns.hacknet.upgradeLevel(i, level - node.level);
                    ns.tprintf("-- Upgraded node %s by %u levels", node.name, level - node.level);
                }
            }
            if (node.ram < 64) {
                if (ns.hacknet.getRamUpgradeCost(i, 6) < ns.getServerMoneyAvailable("home")) {
                    ns.hacknet.upgradeRam(i, 6);
                    ns.tprintf("-- Upgraded node %s RAM", node.name, node.ram);
                }
            }
        }
    }
}

export function allNodesUpgraded(ns:NS, numNodes: number, level: number | null | undefined): boolean {
    if (level == undefined) {
        level = 10;
    }
    if (numNodes == undefined) {
        numNodes = 10;
    }

    if (ns.hacknet.numNodes() < numNodes) {
        return false;
    }
    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
        const node = ns.hacknet.getNodeStats(i);
        if (node.level < level) {
            return false;
        }
        if (node.ram < 64) {
            return false;
        }
    }

    ns.tprintf("- All nodes upgraded");
    return true;
}