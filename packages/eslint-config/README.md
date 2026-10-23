# @newax/eslint-config

Shared ESLint flat configs for every NEWAX project.

## Usage

```js
// eslint.config.mjs
import nextjs from '@newax/eslint-config/nextjs';

export default [
  ...nextjs,
  {
    // repo-specific overrides
  },
];
```

Non-Next.js (API, scripts, library packages):

```js
import base from '@newax/eslint-config/base';

export default base;
```
