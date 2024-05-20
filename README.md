# gede-book-update

> 歌德电子书数据更新程序

## 快速开始

```bash
npm install gede-book-update
```

```ts
import { DataWork } from 'gede-book-update'

await new DataWork({
    user: 'root',
    password: '12345678',
    table: 'book',
    database: 'gede-book'
}).start()

console.log('更新完成')
```