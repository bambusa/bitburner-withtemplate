import { NS } from '@ns'

/**
 * Executes the specified command in the terminal by typing it out and pressing enter.
 * Sleeps for 1 second after the command is executed.
 * If the terminal is not available, a toast will appear with a warning and this function will
 * sleep for 10 seconds.
 * @param {NS} ns the Singularity interface
 * @param {string} command The command to be executed
 * @returns void
 */
 export async function executeInTerminal(ns: NS, command: string) : Promise<boolean> {
    const terminalInput = eval("document.getElementById('terminal-input');");
    if (terminalInput == null || terminalInput == undefined) return false;
    // await ns.prompt(terminalInput);
    if (!terminalInput) {
        ns.toast("Could not find terminal input.", "warning");
        await ns.sleep(1000 * 10);
        return false;
    }

    // Set the value to the command you want to run.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment     
    // @ts-ignore
    terminalInput.value = command;

    // Get a reference to the React event handler.
    const handler = Object.keys(terminalInput)[1];

    // Perform an onChange event to set some internal values.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment     
    // @ts-ignore
    terminalInput[handler].onChange({ target: terminalInput });

    // Simulate an enter press
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment     
    // @ts-ignore
    terminalInput[handler].onKeyDown({ keyCode: 13, preventDefault: () => null });
    await ns.sleep(1000);
    return true;
}