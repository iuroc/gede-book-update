import { Book, Magazine, BookItem, MagazineItem } from 'gede-book-api'
import { Pool, PoolConnection, createPool } from 'mysql2/promise'
import PQueue from 'p-queue'

export class DataWork {
    /** 原表名称 */
    private table: string
    private _pool?: Pool
    /** 临时表名称 */
    private tempTable = `book_${Date.now()}${Math.floor(Math.random() * 1000)}`
    private _queue?: PQueue

    private bookItems: BookItem[] = []
    private magazineItems: MagazineItem[] = []

    constructor(public config: RunConfig) {
        this.table = config.table
    }

    get queue() {
        if (!this._queue) this._queue = new PQueue({ concurrency: 20 })
        return this._queue
    }

    get pool() {
        if (!this._pool) this._pool = createPool({
            host: this.config.host ?? 'localhost',
            port: this.config.port ?? 3306,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database
        })
        return this._pool
    }

    async initTempTable() {
        const connection = await this.pool.getConnection()
        await connection.query(`CREATE TABLE IF NOT EXISTS \`${this.tempTable}\` (
                \`row_id\` INT PRIMARY KEY AUTO_INCREMENT,
                \`name\` VARCHAR(300) COMMENT '书刊名称',
                \`author\` VARCHAR(300) COMMENT '图书作者',
                \`id\` VARCHAR(50) COMMENT '书刊编号',
                \`publish\` VARCHAR(300) COMMENT '图书出版社',
                \`summary\` VARCHAR(3000) COMMENT '书刊摘要',
                \`bigCover\` VARCHAR(500) COMMENT '图书封面大图',
                \`smallCover\` VARCHAR(500) COMMENT '图书封面小图',
                \`cover\` VARCHAR(500) COMMENT '期刊封面',
                \`surl\` VARCHAR(300) COMMENT '阅读器资源标识',
                \`price\` VARCHAR(50) COMMENT '图书价格',
                \`cn\` VARCHAR(50) COMMENT '国内刊号',
                \`issn\` VARCHAR(50) COMMENT '国际刊号',
                \`isbn\` VARCHAR(50) COMMENT '国际书号',
                \`is_book\` INT COMMENT '是否图书',
                \`type\` VARCHAR(5) COMMENT 'HY或GD'
            )`)
    }

    async start() {
        await this.initTempTable()
        this.queue.addListener('idle', async () => {
            await this.database_work()
            await this.pool.end()
            console.log(`数据库更新完成`)
        })
        await this.request_work()
    }

    async database_work() {
        let connection: PoolConnection | undefined
        try {
            connection = await this.pool.getConnection()
            const sql = `INSERT INTO \`${this.tempTable}\` (
                \`name\`,
                \`author\`,
                \`id\`,
                \`publish\`,
                \`summary\`,
                \`bigCover\`,
                \`smallCover\`,
                \`cover\`,
                \`surl\`,
                \`price\`,
                \`cn\`,
                \`issn\`,
                \`isbn\`,
                \`is_book\`,
                \`type\`
            ) VALUES ?`

            console.log(`正在保存 Book 数据`)
            for (let page = 0; page < this.bookItems.length / 10; page++) {
                const data = this.bookItems.slice(page * 10, (page + 1) * 10)
                await connection.query(sql, [data.map(i => [
                    i.name,
                    i.author,
                    i.id,
                    i.publish,
                    i.summary,
                    i.bigCover,
                    i.smallCover,
                    null,
                    i.surl,
                    i.price,
                    null,
                    null,
                    i.isbn,
                    1,
                    i.type
                ])])
            }

            console.log(`正在保存 Magazine 数据`)
            for (let page = 0; page < this.magazineItems.length / 10; page++) {
                const data = this.magazineItems.slice(page * 10, (page + 1) * 10)
                await connection.query(sql, [data.map(i => [
                    i.name,
                    null,
                    i.id,
                    null,
                    i.summary,
                    null,
                    null,
                    i.cover,
                    i.surl,
                    null,
                    i.cn,
                    i.issn,
                    null,
                    0,
                    null
                ])])
            }

            connection.query(`DROP TABLE IF EXISTS \`${this.table}\``)
            connection.query(`RENAME TABLE \`${this.tempTable}\` TO \`${this.table}\``)
        } catch (error) {
            if (error instanceof Error) console.log(error.message)
        } finally {
            connection?.release()
        }
    }

    async request_work() {
        for (let id = 0; id < 3000; id++) {
            this.queue.add(() => new Promise<void>(async resolve => {
                let page = 0
                while (true) {
                    try {
                        const list = await Book.getList(id, page++)
                        this.bookItems.push(...list.filter(item => !this.ifBookExists(item)))
                        console.log(`book-${id}-${page}-ok`)
                    } catch {
                        break
                    }
                }
                resolve()
            }))
        }

        for (let id = 0; id < 1000; id++) {
            this.queue.add(() => new Promise<void>(async resolve => {
                let page = 0
                while (true) {
                    try {
                        const list = await Magazine.getList(id, page++)
                        this.magazineItems.push(...list.filter(item => !this.ifMagazineExists(item)))
                        console.log(`magazine-${id}-${page}-ok`)
                    } catch {
                        break
                    }
                }
                resolve()
            }))
        }
    }

    ifBookExists(bookItem: BookItem) {
        return Boolean(this.bookItems.filter(item =>
            item.name == bookItem.name &&
            item.author == bookItem.author &&
            item.publish == bookItem.publish
        ).length)
    }

    ifMagazineExists(magazineItem: MagazineItem) {
        return Boolean(this.magazineItems.filter(item =>
            item.name == magazineItem.name &&
            item.issn == magazineItem.issn
        ).length)
    }

}

type MySQLConfig = {
    host?: string,
    port?: number,
    user: string,
    password: string,
    database: string
}

type RunConfig = MySQLConfig & { table: string }