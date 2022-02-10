export class RunningJob {
    constructor(pid:number, type:string, hostname:string, target:string, threads:number, start:number, end:number, expectedOutcome:number){
        this.pid = pid;
        this.type = type;
        this.hostname = hostname;
        this.target = target;
        this.threads = threads;
        this.start = start;
        this.end = end;
        this.expectedOutcome = expectedOutcome;
    }
    /** @type{number} */
    pid:number;
    /** @type{string} */
    type:string;
    /** @type{string} */
    hostname:string;
    /** @type{string} */
    target:string;
    /** @type{number} */
    threads:number;
    /** @type{number} */
    start:number;
    /** @type{number} */
    end:number;
    /** @type{number} */
    expectedOutcome:number;
}

RunningJob.prototype.toString = function () {
    return ""+this.pid+" "+this.type+" "+this.hostname+" "+this.target+" "+this.threads+" "+this.start+" "+this.end+" "+this.expectedOutcome;
}