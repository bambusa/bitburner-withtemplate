import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    const started = Date.now();
    const target: string = ns.args[0] as string;
	const predictedStart: number = ns.args[1] as number;
	const predictedEnd: number = ns.args[2] as number;
    const predictedHacktime: number = ns.args[3] as number;
    
    const hacktime = Math.ceil(ns.getWeakenTime(target));
    const startDiff = predictedStart-started;
    if (startDiff > 12) {
        console.log("#predictionError start differs from prediction by "+startDiff+" ms");
    }    const server = ns.getServer(target);
    if (server.hackDifficulty == server.minDifficulty) {
        console.log("#predictionError weakening at server.hackDifficulty "+server.hackDifficulty+" == server.minDifficulty "+server.minDifficulty);
    }
	
    await ns.weaken(target);

    const ended = Date.now();
    const endDiff = predictedEnd-ended;
    if (endDiff > 12) {
        console.log("#predictionError end differs from prediction by "+(endDiff)+" ms (took "+(ended-started)+" ms, predicted "+(predictedEnd-predictedStart)+" ms, hacktime "+hacktime+" ms, predicted "+predictedHacktime+" ms");
    }
}