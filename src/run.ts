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

class qwe{
    private static readonly executor: IExecutor
    private static async exec(tasks: ITask[], executor: IExecutor) {
        while (tasks.length)
            await this.executor.executeTask(tasks.shift()!)
        return tasks
    }
    private static readonly tasks: Map<TTaskId, ITask[]> = new Map()
    private static readonly threads: WeakMap<ITask[], Promise<ITask[]>> = new WeakMap()
    private static freeId(id: TTaskId) {
        const tasks = this.tasks.get(id)
        if (tasks == null)
            return
        if (!tasks.length)
            return this.tasks.delete(id)
    }
    private static
}

export default async function run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
    maxThreads = Math.max(0, maxThreads);

    /** максимум ожидающих тасков для каждого потока */
    const MAX_AWAITED_TASKS = 1

    /** очереди тасков распределённых по id. size <= maxThreads */
    const queuesTask: Map<TTaskId, ITask[]> = new Map()
    /** активные потоки обработки тасков */
    const threads: WeakMap<ITask[], Promise<TTaskId>> = new WeakMap()
    /** вычисляет возможность запустить дополнительный поток */
    const existEmptyThreads = () => maxThreads === 0 || queuesTask.size < maxThreads
    /** ожидание первого освободившегося потока */
    const race = () => Promise.race(Array.from(queuesTask.values()).map(t => threads.get(t)!).filter(p => p))

    /**
     * ! Нельзя запускать одновременно несколько методов с одинаковыми id !
     *
     * Последовательный запуск тасков из массива привязанного к указанному id.
     * Массив можно мутировать пока он доступен в queuesTask.
     * Метод в конце работы, синхронно удаляет соответсвующее поле из queuesTask.
     *
     * Если по указанному ключу из queuesTask нельзя найти таски, метод завершается немедленно, возвращая переданный ключ.
     * @param id: TTaskId ключ уже существущего, не пустого массива из queuesTask
     * @returns TTaskId удалённый ключ массива из queuesTask, по которому работал метод. На момент выхода из метода в queuesTask этого поля уже нет
     */
    async function thread(id: TTaskId): Promise<number> {
        const queue = queuesTask.get(id)
        if (queue == null)
            return id
        if (!queue.length)
            return threads.get(queue) ?? id

        while (queue.length)
            await executor.executeTask(queue.shift()!)

        // не знаю относится-ли последняя проверка в цикле вверху к текущему микротаску.
        // если точно нельзя встроить микротаск между последней проверкой и кодом ниже, условие можно убрать.
        // это условие - подстраховка на случай мутации массива после проверки останавливающей цикл.
        // код ниже точно синхронный, потому забытых тасков не будет.
        if (queue.length)
            return thread(id)

        queuesTask.delete(id)
        return id
    }

    for await (const task of queue) {
        const id = task.targetId
        { // пополнение существующей очереди
            const queue = queuesTask.get(id)
            if (queue != null) {
                queue.push(task)
                continue
            }
        }

        // запуск новой очереди
        if (!existEmptyThreads())
            await race()
        const queue = [task]
        queuesTask.set(id, queue)
        threads.set(queue, thread(id))
    }
}
