# @newax/typescript-config

Shared `tsconfig` bases for every NEWAX project.

| File           | For                                                          |
| -------------- | ------------------------------------------------------------ |
| `base.json`    | Any TS project. Strictness rules every NEWAX repo agrees on. |
| `library.json` | A publishable package (NodeNext + declarations).             |
| `nextjs.json`  | A Next.js app.                                               |

## Usage

```json
{
  "extends": "@newax/typescript-config/nextjs.json"
}
```
