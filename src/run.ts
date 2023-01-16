import { IExecutor } from './Executor';
import ITask from './Task';

interface IQueue{
    id: ITask['targetId']
    tasks: ITask['action'][]
}

class Executor {
    public static run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
        this.iterator = queue[Symbol.asyncIterator]()
        this.executor = executor
    }

    // executor
    private static executor?: Pick<IExecutor, 'executeTask'>
    private static async exec(task: ITask): Promise<void> {
        if (this.executor != null)
            return this.executor.executeTask(task)
    }
    // iterator
    private static iterator?: AsyncIterator<ITask, any, undefined> | null
    private static async getNextQueueItem(): Promise<ITask | null> {
        if (this.iterator == null)
            return null

        const next = await this.iterator.next()
        if (next.done)
            return this.iterator = null

        return next.value
    }
}

export default async function run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
    maxThreads = Math.max(0, maxThreads);

    for await (const task of queue) {

        executor.executeTask(task)
            .then(() => {

                task.targetId
            })
    }
}
