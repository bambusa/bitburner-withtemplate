import { NS } from '@ns'

export const scripts = ["weaken.js", "grow.js", "hack.js", "share.js"];

export async function main(ns : NS) : Promise<void> {
    const hostname = ns.args[0] as string;
    if (hostname != undefined) {
        await deployScriptTo(ns, scripts, "home", hostname);
    }
    else {
        console.log("define target to copy to");
    }
}

/** 
 * @param {NS} ns 
 * @param {string[]} copyScripts
 * @param {string} hostname
 * @param {string} targetname
 * @param {any[]} parameter
 * @param {boolean} runScript
 * @param {boolean} overwrite
 */
 export async function deployScriptTo(ns: NS, copyScripts: string[], hostname: string, targetname: string) : Promise < void > {
        for (const scriptname of copyScripts) {
            await ns.scp(scriptname, hostname, targetname);
            // await ns.sleep(100);
            console.log("Copied " + scriptname + " to " + targetname);
        }
}