# Category: Project Sync

Creating and updating project pages in Notion.

## When to load

- New repo/project discovered
- First-time workspace setup
- Stack or project brief needs updating

## Workflow

### 1. Create project page

If the project page does not exist under Internal Tools/ or Commercial Products/:
- Create the page following the per-project template in `workspace-blueprint.md`
- Place under the correct section (Internal vs Commercial)

### 2. Stack summary (from CODE)

Read actual source files to build the stack summary:
- `package.json` / `requirements.txt` / `pyproject.toml` → dependencies
- `src/` directory structure → architecture pattern
- Database files → DB technology (SQLite, PostgreSQL, etc.)
- Config files → build tools, frameworks

**NEVER trust README.md or plan documents for stack info.** Code is truth. Plans change.

### 3. Git history brief

Run `git log --oneline -20` (or read from notion-memory entries with git_refs) to understand:
- Recent activity
- Key milestones
- Active contributors (human vs agent)

### 4. Project brief

Write a one-paragraph summary of what the project does. CEO-readable. No jargon. Answer:
- What problem does it solve?
- Who uses it?
- What state is it in? (dev / staging / production)

### 5. Cross-references

Link to:
- Commercial counterpart (if exists)
- Entity in Neuronal System section
- Related architecture decisions

## Output

A complete project page with: stack summary table, brief, git activity, deployment status, empty todo sections ready for population.
