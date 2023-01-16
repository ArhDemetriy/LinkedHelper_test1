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

class Iterator {
    constructor(queue: AsyncIterable<ITask>) {
        this.iterator = queue[Symbol.asyncIterator]()
    }
    private iterator: AsyncIterator<ITask, any, undefined> | null
    protected async getNextIteratorItem(): Promise<ITask | null> {
        if (this.iterator == null)
            return null

        const next = await this.iterator.next()
        if (next.done)
            return this.iterator = null

        return next.value
    }
}
class Tasks extends Iterator{
    private readonly maxAwaitedTasks = 10
    constructor(queue: AsyncIterable<ITask>, private readonly maxThreads: number) {
        super(queue)
    }
    private readonly queue: Map<TTaskId, ITask[]> = new Map()
    private tempTask?: ITask | null
    private setTempTask(task: ITask) {
        this.tempTask = task
    }
    private getTempTask() {
        const temp = this.tempTask
        this.tempTask = null
        return temp
    }
    private fillingQueue = false
    private async fillQueue() {
        if (this.fillingQueue)
            return
        if (this.maxThreads && this.queue.size >= this.maxThreads)
            return
        this.fillingQueue = true

        while (true) {
            const task = this.getTempTask() ?? await new Promise<ITask | null>((t, c) => setTimeout(() => this.getNextIteratorItem().then(t, c)))
            if (task == null)
                break

            if (!this.queue.has(task.targetId)) {
                if (this.maxThreads && this.queue.size >= this.maxThreads) {
                    this.setTempTask(task)
                    break
                }
                this.queue.set(task.targetId, [])
            }

            const tasks = this.queue.get(task.targetId)!
            tasks.push(task)
            if (tasks.length >= this.maxAwaitedTasks) // стараемся не набирать слишком много тасков в очередь
                if (this.maxThreads && this.queue.size >= this.maxThreads) // однако в приоритете занимаем все потоки
                    break
        }

        this.fillingQueue = false
    }
}

export default async function run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
    maxThreads = Math.max(0, maxThreads);

    const threads: Set<TTaskId> = new Set()
    const tasks: Map<TTaskId, ITask[]> = new Map()
    async function addNewTask(tasks: ITask[]) { }
    async function taskRunner(tasks: ITask[], executor: IExecutor) {
        while (true) {
            if (!tasks.length)
                await addNewTask(tasks)
            if (!tasks.length)
                break

            await executor.executeTask(tasks.shift()!)
        }
    }

    function runNewTask(task: ITask) {
        if (threads.has(task.targetId)) {

        }



    }

    for await (const task of queue) {

        executor.executeTask(task)
            .then(() => {

                task.targetId
            })
    }
}
