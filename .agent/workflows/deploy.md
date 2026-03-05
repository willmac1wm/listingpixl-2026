---
description: Pause, test, and deploy Gravity Claw to Railway
---

1. Stop the live instance
// turbo
railway down

2. Ensure code is error-free
// turbo
npx tsc --noEmit

3. Deploy new version
// turbo
railway up --detach

4. Verify success
// turbo
railway logs --lines 50 | grep "Soul loaded"
