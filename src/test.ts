import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    const now = Date.now();
    await ns.share();
    const end = Date.now();
    console.log("share took "+(end-now)+" ms");
}