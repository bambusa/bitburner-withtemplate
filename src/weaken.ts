import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    const started = Date.now();
    const target = ns.args[0] as string;
	// const predictedStart = ns.args[1] as number;
	// const predictedEnd = ns.args[2] as number;
    // const predictedHacktime = ns.args[3] as number;
    // const expectedOutcome = ns.args[4] as number;
    
    // const serverBefore = ns.getServer(target);
    // const hacktime = Math.ceil(ns.getWeakenTime(target));
    // const startDiff = predictedStart-started;
    // if (startDiff > 12) {
    //     console.log("#predictionError start differs from prediction by "+startDiff+" ms");
    // }
	
    await ns.weaken(target);

    // const ended = Date.now();
    // const endDiff = predictedEnd-ended;
    // if (endDiff > 12) {
    //     console.log("#predictionError end differs from prediction by "+(endDiff)+" ms (took "+(ended-started)+" ms, predicted "+(predictedEnd-predictedStart)+" ms, hacktime "+hacktime+" ms, predicted "+predictedHacktime+" ms");
    // }
    // const serverAfter = ns.getServer(target);
    // if ((serverAfter.hackDifficulty - serverBefore.hackDifficulty - expectedOutcome) > 0.1 || (serverAfter.hackDifficulty - serverBefore.hackDifficulty - expectedOutcome) < -0.1) {
    //     console.log("#predictionError weakened "+target+" (serverAfter.hackDifficulty - serverBefore.hackDifficulty) "+(serverAfter.hackDifficulty - serverBefore.hackDifficulty)+" != expectedOutcome "+expectedOutcome);
    // }
}