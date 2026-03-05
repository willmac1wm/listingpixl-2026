---
name: railway-deploy
description: Automated Railway deployments for Gravity Claw
---

# Railway Deployment Skill

This skill allows the agent to manage the full Railway lifecycle: Pause → Test → Deploy → Verify.

## Core Commands

1. **Pause Railway**: `railway down`
2. **Local Test**: `npm run dev` (run in background/isolated shell)
3. **Check Types**: `npx tsc --noEmit`
4. **Deploy**: `railway up --detach`
5. **Logs**: `railway logs --lines 100`

## Procedure

When the user says "deploy":

1. Check if Railway CLI is installed.
2. Run `railway down` to avoid bot conflicts.
3. Run `npx tsc --noEmit` to ensure code is valid.
4. Run `railway up --detach`.
5. Wait 60s, then verify logs for `✅ Connected`.
