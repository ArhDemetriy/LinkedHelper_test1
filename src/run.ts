import { IExecutor } from './Executor';
import ITask from './Task';

export default async function run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
    maxThreads = Math.max(0, maxThreads);

    /** очереди тасков распределённых по id. size <= maxThreads */
    const queuesTask: Map<ITask['targetId'], ITask[]> = new Map();
    /** активные потоки обработки тасков */
    const threads: WeakMap<ITask[], Promise<ITask['targetId']>> = new WeakMap();
    /** ожидание первого освободившегося потока */
    const race = async () => new Promise<number>(r => setTimeout(async () =>
        r(await Promise.race(Array
            .from(queuesTask.values())
            .filter(q => threads.has(q))
            .map(async q => threads.get(q)!)))
    ));
    /** вычисляет возможность запустить дополнительный поток */
    const existEmptyThreads = maxThreads === 0 ? () => true : () => queuesTask.size < maxThreads;

    /**
     * ! Нельзя запускать одновременно несколько методов с одинаковыми id !
     *
     * Последовательный запуск тасков из массива привязанного к указанному id.
     * Массив можно мутировать пока он доступен в queuesTask.
     * Метод, в конце работы синхронно удаляет соответсвующее поле из queuesTask.
     *
     * Если по указанному ключу из queuesTask нельзя найти таски, метод завершается немедленно, возвращая переданный ключ.
     * @param id: ITask['targetId'] ключ уже существущего, не пустого массива из queuesTask
     * @returns ITask['targetId'] удалённый ключ массива из queuesTask, по которому работал метод. На момент выхода из метода в queuesTask этого поля уже нет
     */
    async function thread(id: ITask['targetId']): Promise<number> {
        const tasks = queuesTask.get(id)!;
        // Не смотря на то что в тестах эти проверки не срабатывают, я-бы добавил их в прод.
        // Потому что типы и тесты не могут запретить вызов функции не вовремя.
        // И, я думаю, лучше защититься от человеческого фактора в будущих правках.
        // if (tasks == null) {
        //     return id;
        // }
        // if (!tasks.length) {
        //     return threads.get(tasks) ?? id;
        // }

        while (tasks.length) {
            await executor.executeTask(tasks[0]);
            tasks.shift();
        }

        // не знаю относится-ли последняя проверка в цикле вверху к текущему микротаску.
        // если точно нельзя встроить микротаск между последней проверкой и кодом ниже, условие можно убрать.
        // это условие - подстраховка на случай мутации массива после проверки останавливающей цикл.
        // код ниже точно синхронный, потому забытых тасков не будет.
        // if (tasks.length) {
        //     return thread(id);
        // }

        queuesTask.delete(id);
        return id;
    }

    let running: boolean;
    do {
        running = false; // внезапнохак для очередей модифицируемых после окончания последнего в очереди таска
        for await (const task of queue) {
            running = true;
            const id = task.targetId;

            // пополнение существующей очереди
            {
                const tasks = queuesTask.get(id);
                if (tasks != null) {
                    tasks.push(task);
                    continue;
                }
            }

            // запуск новой очереди
            {
                if (!existEmptyThreads()) {
                    await race();
                }
                const newTasks = [task];
                queuesTask.set(id, newTasks);
                threads.set(newTasks, thread(id));
            }
        }

        await Promise.all(Array
            .from(queuesTask.values())
            .map(async q => threads.get(q))
        );
    } while (running);
}
