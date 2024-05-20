import { DataWork } from './run.mjs'

export { DataWork }

new DataWork({
    user: 'root',
    password: '12345678',
    table: 'book',
    database: 'gede-book'
}).start()