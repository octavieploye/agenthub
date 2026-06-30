# Token Optimizer — Criteria Reference

## Compression Targets (project-editable)
# Increase N values incrementally after reviewing dry-run previews.
# Scientific basis: 5 independent academic sources — see spec for citations.

CR_RULES=1.5          # Rules/constraints: target 1.5x (ceiling 3x)
CR_CONTEXT=1.5        # Context/narrative: target 1.5x (ceiling 5x)
CR_WORKFLOW=1.5       # Workflow/checklist: target 1.5x (ceiling 4x)
CR_HUMAN=1.0          # Human-facing: never compress

QR_FLOOR_RULES=0.98   # Quality retention floor for rules
QR_FLOOR_CONTEXT=0.95 # Quality retention floor for context
QR_FLOOR_WORKFLOW=0.97 # Quality retention floor for workflow

## Model-Size Adjustment
# Override CR ceiling based on model in use.
MODEL_LARGE_CEILING=5.0    # Opus, GPT-4 class
MODEL_MID_CEILING=3.0      # Sonnet, GPT-3.5 class
MODEL_SMALL_CEILING=1.5    # Haiku, Mistral-7B class

## Token Estimation
CHARS_PER_TOKEN=4     # Proxy: 1 token ~ 4 characters in English

## Log Rotation
MAX_AUDIT_SESSIONS=5  # Keep only the last N session audits in the log

## KEEPLIST — patterns that must NEVER be compressed or removed
# Regex patterns (one per line). Matched lines are excluded from rewriting.
# These protect structural anchors that LLMs use for parsing.
KEEPLIST_PATTERNS=(
  '^#{1,3} '           # Markdown headings (h1-h3)
  '^\|.*\|'            # Markdown table rows
  '^```'               # Code fence boundaries
  'NEVER|ALWAYS|MUST NOT|DO NOT'  # Behavioral directives
  ':[0-9]{4}'          # Port numbers (e.g., :8000, :9400)
  '_id |_at |PRIMARY KEY|FOREIGN KEY|DEFAULT'  # DB schema tokens
  '^(queued|pending|in_progress|done|failed|cancelled|fetched|draft|candidate|validated|rejected|promoted|quarantine|superseded|active)' # Status vocabulary
)

## Agent Profiles
# Per-domain overrides. Profile files live in profiles/ next to this file.
# Each profile can override: CR targets, QR floors, KEEPLIST additions.
# Format: profiles/<domain>.conf (shell-sourceable key=value)
# Profiles are selected via: --profile=<domain>
DEFAULT_PROFILE=coding
