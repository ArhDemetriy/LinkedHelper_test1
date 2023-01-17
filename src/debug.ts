import { getQueue } from '../test/data';
import ExecutorExt from '../test/ExecutorExt';
import run from './run';

async function q() {
    const queue = getQueue();
    const executor = new ExecutorExt(undefined, queue);
    executor.start();
    await run(executor, queue);
    executor.stop();
}

q();
