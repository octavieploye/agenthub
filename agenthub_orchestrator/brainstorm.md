## Automated Rate Limit Orchestrator for Multi-Agent Claude Code Workflow

Here's a comprehensive automated workflow for managing Claude Code rate limits across 7 agents working on different projects with Opus 4.6/Sonnet 4.6 + Haiku subagents:

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              Rate Limit Orchestrator (Central)              │
│  - Monitors all 7 agent sessions                            │
│  - Tracks 5-hour rolling window usage                       │
│  - Manages weekly cap allocation                            │
│  - Implements intelligent queuing & backoff                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ Agent 1 │          │ Agent 2 │          │ Agent 3 │
   │ Project │          │ Project │          │ Project │
   │   A     │          │   B     │          │   C     │
   └─────────┘          └─────────┘          └─────────┘
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ Haiku   │          │ Haiku   │          │ Haiku   │
   │Subagent │          │Subagent │          │Subagent │
   └─────────┘          └─────────┘          └─────────┘
```

## Key Components

### 1. **Usage Monitoring Layer**

The orchestrator continuously monitors these metrics from each agent session:

- **5-hour rolling window consumption** (tokens + messages)
- **Weekly usage percentage** (resets every 7 days)
- **Per-session token burn rate**
- **Context window utilization** (200K-1M tokens depending on model) [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)

**Critical insight**: Usage limits apply across all Claude surfaces (Code, Desktop, web) and count toward the same pool. [krater](https://krater.ai/blog/claude-usage-limits)

### 2. **Rate Limit Allocation Strategy**

For 7 agents running 10-12h/day, 7 days/week:

```python
# Weekly usage budget allocation (example for Pro/Max plan)
WEEKLY_BUDGET = 100%  # Your plan's weekly limit

# Priority tiers:
TIER_1_CRITICAL = 40%   # 2 agents (production/deadline work)
TIER_2_STANDARD = 35%   # 3 agents (active development)
TIER_3_FLEXIBLE = 25%   # 2 agents (experimental/low-priority)

# 5-hour window distribution:
# Each agent gets dynamic allocation based on:
# - Current window usage
# - Task priority
# - Token efficiency score
```

### 3. **Automated Workflow Implementation**

```bash
#!/bin/bash
# orchestrator.sh - Main rate limit coordinator

# Configuration
AGENTS=("project_alpha" "project_beta" "project_gamma" "project_delta" 
        "project_epsilon" "project_zeta" "project_eta")
PRIORITY_MAP=(2 2 1 1 1 3 3)  # 1=critical, 2=standard, 3=flexible

# Continuous monitoring loop
while true; do
    # Check usage for all agents
    for i in "${!AGENTS[@]}"; do
        USAGE=$(claude_code --agent "${AGENTS[$i]}" /usage)
        WINDOW_REMAINING=$(echo "$USAGE" | grep "5-hour remaining")
        WEEKLY_REMAINING=$(echo "$USAGE" | grep "Weekly remaining")
        
        # Log to central dashboard
        echo "$(date '+%Y-%m-%d %H:%M:%S') | ${AGENTS[$i]} | Window: $WINDOW_REMAINING | Weekly: $WEEKLY_REMAINING" >> /var/log/claude_orchestrator.log
    done
    
    # Intelligent scheduling decisions
    if [[ $(check_weekly_threshold) -gt 80 ]]; then
        # Pause flexible agents, maintain critical
        pause_agents_by_tier 3
        alert_user "Weekly usage at 80% - flexible agents paused"
    fi
    
    # Exponential backoff with jitter for rate-limited agents
    if [[ $(check_rate_limit_hit) == true ]]; then
        apply_backoff_with_jitter $AGENT_ID
    fi
    
    sleep 300  # Check every 5 minutes
done
```

### 4. **Haiku Subagent Optimization**

Use Haiku 4.5 for bounded, token-efficient subtasks:

- **Context window**: 200K tokens (Claude Code) [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)
- **Best for**: Code review, linting, simple refactors, documentation
- **Token savings**: ~60-80% vs Opus/Sonnet for routine tasks

```yaml
# agents.md configuration
subagent_routing:
  haiku_triggers:
    - "review this code"
    - "fix linting errors"
    - "update documentation"
    - "run tests"
  
  opus_sonnet_triggers:
    - "architectural decision"
    - "complex refactoring"
    - "security analysis"
    - "performance optimization"
```

## Usage vs Length Limits: How They Work

### **Usage Limits** (Your "Conversation Budget")

Usage limits control **how much** you can interact with Claude over time:

- **5-hour rolling window**: Resets progressively over 5 hours (sliding window) [claudefa](https://claudefa.st/blog/guide/development/higher-usage-limits)
- **Weekly cap**: Absolute ceiling over 7-day period [claudefa](https://claudefa.st/blog/guide/development/higher-usage-limits)
- **Affected by**:
  - Message length and complexity
  - Model choice (Opus > Sonnet > Haiku in token cost)
  - Effort level setting (higher effort = more tokens)
  - Features used (web search, MCP connectors, code execution) [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)
  - Extended thinking toggle [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)

**Current promotion** (through August 31, 2026): Claude Code weekly limits are 50% higher for Pro/Max/Team plans. [claudefa](https://claudefa.st/blog/guide/development/higher-usage-limits)

### **Length Limits** (Context Window)

Length limits control **how much information** Claude can process in a single conversation:

| Model | Claude Code Context | Claude Chat Context |
|-------|-------------------|-------------------|
| Opus 4.6 | 1M tokens* | 500K tokens  [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans) |
| Sonnet 4.6 | 1M tokens* | 500K tokens  [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans) |
| Haiku 4.5 | 200K tokens | 200K tokens  [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans) |

*Requires usage credits enabled (except usage-based Enterprise) [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)

**Automatic context management**: When conversations approach the limit, Claude summarizes earlier messages while preserving full history. However, this consumes more of your usage limit. [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)

## Advanced Orchestration Tactics

### 1. **Worktree Isolation**
Each agent operates in separate Git worktrees to prevent file conflicts and enable parallel execution. [verdent](https://www.verdent.ai/guides/claude/code-agents)

### 2. **Dynamic Model Switching**
```python
def select_model(task_complexity, remaining_budget):
    if task_complexity > 0.8 and remaining_budget > 0.3:
        return "opus-4.6"
    elif task_complexity > 0.5:
        return "sonnet-4.6"
    else:
        return "haiku-4.5"  # Token-efficient default
```

### 3. **Token Efficiency Scoring**
Track each agent's token burn rate and adjust allocations:
- High-efficiency agents get priority during budget constraints
- Low-efficiency agents get throttled or switched to Haiku

### 4. **Queue Management**
```
Priority Queue Structure:
┌────────────────────────────────────┐
│ CRITICAL (40% budget)              │
│ - Production fixes                 │
│ - Deadline-driven work             │
├────────────────────────────────────┤
│ STANDARD (35% budget)              │
│ - Feature development              │
│ - Regular refactoring              │
├────────────────────────────────────┤
│ FLEXIBLE (25% budget)              │
│ - Experiments                      │
│ - Documentation                    │
│ - Low-priority improvements        │
└────────────────────────────────────┘
```

### 5. **Alerting & Auto-Recovery**
- **80% weekly usage**: Pause flexible agents, alert user
- **90% weekly usage**: Pause standard agents, maintain critical only
- **Rate limit hit**: Exponential backoff with randomized jitter (prevents "thundering herd") [tryinterlock](https://tryinterlock.com/blog/managing_api_rate_limits_for_multi_agent_orchestration.php)
- **Context window warning**: Auto-summarize or suggest new conversation [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)

## Best Practices for Your Setup

1. **Start with 2-3 agents**, measure token consumption patterns, then scale to 7 [verdent](https://www.verdent.ai/guides/claude/code-agents)
2. **Use Projects with RAG** to reduce context window pressure [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)
3. **Disable non-critical tools** (web search, connectors) when not needed [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)
4. **Keep project instructions concise** - reserve task-specific details for chats [support.claude](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)
5. **Monitor /usage output** regularly via CLI [news.ycombinator](https://news.ycombinator.com/item?id=49348751)
6. **Use agent view** for independent background sessions rather than subagents when workers don't need shared state [verdent](https://www.verdent.ai/guides/claude/code-agents)

This orchestrator ensures your 7-agent setup maximizes throughput while staying within usage limits, with Haiku handling routine tasks to preserve budget for Opus/Sonnet on complex work.