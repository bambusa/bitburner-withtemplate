import { NS, Player } from '@ns'

export async function factionLoop (ns: NS, backdoorsInstalled: string[], player: Player): Promise<void> {
    if (!player.factions.includes("CyberSec") && backdoorsInstalled.includes("CSEC")) {
        ns.tprint("! Join Faction CyberSec");
    }
}