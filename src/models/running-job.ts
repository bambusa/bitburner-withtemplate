export class RunningJob {
    constructor(pid: number, type: string, hostname: string, target: string, threads: number, start: number, end: number, expectedOutcome: number, hacktime: number) {
        this.pid = pid;
        this.type = type;
        this.hostname = hostname;
        this.target = target;
        this.threads = threads;
        this.start = start;
        this.end = end;
        this.expectedOutcome = expectedOutcome;
        this.hacktime = hacktime;
    }
    pid: number;
    type: string;
    hostname: string;
    target: string;
    threads: number;
    start: number;
    end: number;
    expectedOutcome: number;
    hacktime: number;
}

RunningJob.prototype.toString = function () {
    return "" + this.pid + " " + this.type + " " + this.hostname + " " + this.target + " " + this.threads + " " + this.start + " " + this.end + " " + this.expectedOutcome;
}