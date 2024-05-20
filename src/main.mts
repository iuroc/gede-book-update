import { DataWork } from './run.mjs'

await new DataWork({
    user: 'root',
    password: '12345678',
    database: 'gede_book',
    table: 'book'
}).start()