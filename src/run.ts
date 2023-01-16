import { IExecutor } from './Executor';
import ITask from './Task';

type TTaskId = ITask['targetId']

interface IQueue{
    id: TTaskId
    tasks: ITask['action'][]
}

class Executor {
    public static run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
        this.iterator = queue[Symbol.asyncIterator]()
        this.executor = executor
        this.maxThreads = maxThreads

        return new Promise<void>(resolve => this.ender = resolve)
    }
    private static ender?: () => void

    private static maxThreads?: number
    private static tempTask?: ITask | null
    private static runner() { }
    private static async runNewThread() {
        const task = await this.getNextTask()
        if (task == null)
            return true

        this.exec(task)
    }

    private static readonly queue: Map<TTaskId, ITask[]> = new Map()
    private static getTaskFromId(id: TTaskId) { }
    private static setTask(task: ITask) { }
    private static async getNextTask(exemptedId?: TTaskId): Promise<ITask | null> {
        if (exemptedId != null) {
            const targetItems = this.queue.get(exemptedId)
            if (targetItems != null) {
                if (targetItems.length)
                    return targetItems.shift()! // Возврат отложенной таски
                else
                    this.queue.delete(exemptedId) // освобождение id
            }
        }

        while (true) {
            const task = await this.getNextQueueItem()
            if (task == null)
                return null

            // Откладывание таски
            if (!this.queue.has(task.targetId)) {
                this.queue.set(task.targetId, [])
                return task
            }

            this.queue.get(task.targetId)!.push(task)
        }
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
