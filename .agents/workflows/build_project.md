---
description: Build the complete Next.js project
---

### Project Build Workflow

This workflow installs package dependencies and checks types before producing an optimized production Next.js build.

1. Install project dependencies:
```bash
// turbo
npm install
```

2. Perform static TypeScript checking:
```bash
// turbo
npx tsc --noEmit
```

3. Build Next.js output:
```bash
// turbo
npx next build
```
