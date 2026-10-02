# Destructive Commands — Universal Ban List
# Place this file at: .claude/commands/destructive-commands-ban.md
# Then add the reference block (at the bottom of this file) to your CLAUDE.md
#
# Created: 2026-07-25
# Trigger: git clean -fd incident destroyed all untracked files in opeidos repo
# Scope: ALL agents, ALL workflows, ALL repos in the Optimaeus ecosystem

---

## ABSOLUTE BAN — No agent may run these. No exceptions. No user override.

These commands permanently destroy data with NO recovery path.

### Git — Permanent Data Destruction

| Command | What it destroys | Recovery |
|---|---|---|
| `git clean` (any flags) | ALL untracked files and directories — drafts, research, working docs, anything not committed | **NONE** — bypasses Trash, not in git history |
| `git clean -fd` | Untracked files + directories | **NONE** |
| `git clean -fdx` | Untracked + gitignored files (.env, secrets, vendor) | **NONE** — may destroy credentials |
| `git reflog expire --expire=now` | Destroys the recovery mechanism itself | **NONE** — makes orphaned commits permanently unrecoverable |
| `git gc --prune=now` | Garbage-collects orphaned commits immediately | **NONE** |

### Shell — Permanent File Destruction

| Command | What it destroys | Recovery |
|---|---|---|
| `rm -rf` (any target) | Entire directory trees — bypasses Trash | **NONE** |
| `rm -f` (any target) | Single files — bypasses Trash, no confirmation | **NONE** |
| `find ... -delete` | All files matching pattern | **NONE** |
| `find ... -exec rm` | All files matching pattern via exec | **NONE** |
| `shred` | Overwrites file contents before deletion | **NONE** — designed to be unrecoverable |
| `dd if=/dev/zero of=<file>` | Overwrites file with zeros | **NONE** |
| `truncate -s 0 <file>` | Empties file contents | **NONE** for content |

### Database — Permanent Data Destruction

| Command | What it destroys | Recovery |
|---|---|---|
| `DROP TABLE` | Entire table schema + all rows | **NONE** without backup |
| `DELETE FROM <table>` (no WHERE) | All rows in table | **NONE** if committed |
| `rm *.db` / `rm *.sqlite` | Entire database files | **NONE** |

### Docker — Permanent Volume Destruction

| Command | What it destroys | Recovery |
|---|---|---|
| `docker system prune -a --volumes` | ALL stopped containers, images, volumes | **NONE** for volume data |
| `docker volume rm` | Named volume data | **NONE** |
| `docker rm -fv` | Container + its volumes | **NONE** for volume data |

### Credentials & System

| Command | What it destroys | Recovery |
|---|---|---|
| `rm ~/.ssh/id_rsa` | SSH private key | **NONE** — must regenerate + update all servers |
| `rm .env` / `rm .env.local` | All secrets and environment variables | **NONE** if not backed up |

---

## CRITICAL BAN — Requires explicit human admin approval + 3-step confirmation

These commands cause severe damage but have partial recovery paths.

### Git — History Rewriting

| Command | Risk | Recovery |
|---|---|---|
| `git reset --hard` | Discards ALL uncommitted changes (staged + unstaged) | Partial via `git reflog` |
| `git reset --hard HEAD~N` | Orphans N commits + discards working changes | Partial via `git reflog` |
| `git push --force` | Overwrites remote history — affects entire team | Partial if teammates have local copies |
| `git push --force-with-lease` | Same as force-push with reflog check | Partial |
| `git rebase -i` | Rewrites commit history interactively | Partial via `git reflog` |
| `git checkout .` | Reverts ALL local changes to tracked files | Partial if HEAD intact |
| `git restore .` | Same as `git checkout .` | Partial if HEAD intact |
| `git branch -D` | Force-deletes branch, orphans unique commits | Partial via `git reflog` (2 weeks) |
| `git stash drop` | Deletes a stash entry | Partial via `git fsck` |

### Shell — Broad Deletion

| Command | Risk | Recovery |
|---|---|---|
| `rm -r` (without -f) | Recursive delete with prompts | **NONE** for confirmed deletions |
| `mv <path> /dev/null` | Moves file to null device | **NONE** |

### Process Killing

| Command | Risk | Recovery |
|---|---|---|
| `kill -9 <pid>` | Force-kills process — unsaved state lost | Restart process; in-memory data lost |
| `pkill -9 node` | Kills ALL Node.js processes | Restart; pending writes lost |
| `killall -9 <process>` | Kills all instances of named process | Restart |

### npm/Node

| Command | Risk | Recovery |
|---|---|---|
| `rm package-lock.json` | Destroys exact dependency versions | `npm install` recreates but versions may differ |
| `npm uninstall <pkg>` (without review) | Removes dependency; dependents break | `npm install <pkg>@version` |

---

## 3-STEP CONFIRMATION PROTOCOL

When a human explicitly requests a CRITICAL BAN command, the agent MUST:

**Step 1 — Scope:** "This will [exact description of what will be destroyed]. Affected: [list files/commits/data]."

**Step 2 — Recovery:** "Recovery is [possible via X / NOT possible]. [If recoverable: here's how. If not: this is permanent.]"

**Step 3 — Confirm:** "Type the exact command you want me to run. I will not proceed from a 'yes' — I need the command repeated back."

If the human says "just do it" or "yes" without repeating the command, the agent MUST refuse and re-ask for the explicit command.

---

## SAFE ALTERNATIVES

Instead of destructive commands, agents MUST use these patterns:

| Destructive | Safe Alternative |
|---|---|
| `git clean -fd` | `git status --porcelain` → show untracked files → ask human what to do |
| `rm -rf <dir>` | `mv <dir> /tmp/<dir>-backup-$(date +%s)` → confirm → delete backup later |
| `git reset --hard` | Commit the work first (a commit is recoverable via `git reflog`), then reset |
| `git checkout .` | Commit the work first, or `git diff > backup.patch` before discarding |
| `rm -f <file>` | Use the Write tool to create empty file, or `mv` to backup location |
| `git push --force` | `git push --force-with-lease` (minimum) → but still requires 3-step confirmation |
| `DROP TABLE` | `ALTER TABLE <table> RENAME TO <table>_backup_YYYYMMDD` |
| `DELETE FROM <table>` | `SELECT COUNT(*) FROM <table>` first → confirm scope → then delete |
| `docker system prune` | `docker ps -a` + `docker volume ls` → show what will be removed → confirm |

---

## DETECTION PATTERNS

Agents MUST scan their own planned commands for these patterns before execution:

```
BLOCKED PATTERNS (regex):
  git\s+clean
  rm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r)
  rm\s+-rf
  find\s+.*-delete
  find\s+.*-exec\s+rm
  git\s+reset\s+--hard
  git\s+push\s+(--force|--force-with-lease|-f)
  git\s+rebase
  git\s+checkout\s+\.
  git\s+restore\s+\.
  git\s+branch\s+-D
  DROP\s+TABLE
  TRUNCATE\s+TABLE
  DELETE\s+FROM\s+\w+\s*;
  docker\s+system\s+prune
  docker\s+volume\s+(rm|prune)
  docker\s+rm\s+-[a-zA-Z]*v
  kill\s+-9
  pkill\s+-9
  killall\s+-9
  shred\s+
  dd\s+if=/dev/zero
  truncate\s+-s\s+0
```

If a planned command matches any pattern: STOP. Do not execute. Show the match to the human. Follow 3-step confirmation if they insist.

---

## CLAUDE.md REFERENCE BLOCK

Add this block to every CLAUDE.md in the ecosystem:

```markdown
## Destructive Command Ban (non-negotiable)

**ABSOLUTE BAN — never run, no exceptions:**
`git clean`, `rm -rf`, `rm -f`, `find -delete`, `shred`, `dd if=/dev/zero`,
`DROP TABLE`, `DELETE FROM` (no WHERE), `docker system prune --volumes`,
`git reflog expire`, `git gc --prune=now`

**CRITICAL BAN — requires 3-step human confirmation:**
`git reset --hard`, `git push --force`, `git rebase`, `git checkout .`,
`git restore .`, `git branch -D`, `kill -9`, `pkill -9`, `rm package-lock.json`

**Safe alternatives are mandatory.** See `.claude/commands/destructive-commands-ban.md`.

**If you are about to delete more than 1 file:** STOP. List the files. Ask the human.
**If you see `clean` in a git command:** STOP. That word means permanent deletion.
**If recovery is "NONE":** You may NOT proceed regardless of human instruction.
```
