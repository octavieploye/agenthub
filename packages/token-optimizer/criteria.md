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
CHARS_PER_TOKEN=4     # Proxy: 1 token ≈ 4 characters in English

## LLM Settings
TOKEN_OPT_MODEL="${TOKEN_OPT_MODEL:-claude-haiku-4-5-20251001}"
ANTHROPIC_API_VERSION="2023-06-01"
