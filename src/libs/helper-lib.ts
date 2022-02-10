import {ServerPotential} from "models/server-potential"

export function sortServerPotential(a:ServerPotential,b:ServerPotential):number {
    return a.potential-b.potential;
}

/** 
 * @param{number[]} candidates 
 */
export function getMaxValue(candidates:number[]):number {
    let maxValue = 0;
    if (candidates != undefined) {
        for (const candidate of candidates) {
            if (candidate != undefined && candidate > maxValue)
                maxValue = candidate;
        }
    }
    return maxValue;
}

export function formatDate(ms:number):string {
    const date = new Date(ms);
    const formatted_date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    return formatted_date;
}