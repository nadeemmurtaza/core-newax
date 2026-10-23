# @newaxhq/eslint-config

Shared ESLint flat configs for every NEWAX project.

## Usage

```js
// eslint.config.mjs
import nextjs from '@newaxhq/eslint-config/nextjs';

export default [
  ...nextjs,
  {
    // repo-specific overrides
  },
];
```

Non-Next.js (API, scripts, library packages):

```js
import base from '@newaxhq/eslint-config/base';

export default base;
```
