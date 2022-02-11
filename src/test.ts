import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    let now = Date.now();
    let hackEnd = Math.ceil(now+ns.getHackTime("n00dles"));
    ns.exec("hack.js", "foodnstuff", 1, "n00dles", now, hackEnd);
    await ns.sleep(10);
    now = Date.now();
    hackEnd = Math.ceil(now+ns.getGrowTime("n00dles"));
    ns.exec("grow.js", "foodnstuff", 1, "n00dles", now, hackEnd);
    await ns.sleep(10);
    now = Date.now();
    hackEnd = Math.ceil(now+ns.getWeakenTime("n00dles"));
    ns.exec("weaken.js", "foodnstuff", 1, "n00dles", now, hackEnd);
}