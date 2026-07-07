# KNOWLEDGE: Human Constraints — The Real Time Budget
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Biological baselines, Hormozi backward planning, Loehr/Schwartz energy research

---

## PURPOSE

Defines the real available time budget for a human. All scheduling,
calendar generation, and task allocation must start from these constraints.
These are defaults — not asked of the user. Users only speak up for exceptions.

---

## THE BUDGET

A day has 24 hours. Here is what is actually available.

| Block | Hours | Non-negotiable | Notes |
|---|---|---|---|
| Sleep | 7-8h | YES | Biological minimum for sustained performance week over week |
| Personal daily | ~2h | YES | Meals, hygiene, family presence, gym/movement, basic human needs |
| Weekly leisure | ~4h (Fri-Sun) | YES | Social, going out, conferences, decompression |
| **Available for work** | **14-15h/day** | | This is the real budget |

Do NOT schedule from 24 hours. Do NOT schedule from 16 hours.
Schedule from 14-15 hours maximum.

---

## SANITY ANCHORS

Sanity anchors are the blocks a person would NEVER trade — the non-negotiable
personal commitments that keep a human functional week after week.

### Rules for sanity anchors:

1. They are ASSUMED by the system — not asked during setup
2. They do NOT appear on the calendar by default
3. They appear ONLY if the user explicitly requests to see them
4. They ARE factored into all scheduling calculations
5. They cannot be overridden by work tasks

### Default sanity anchors (built into the system):

| Anchor | When | Duration |
|---|---|---|
| Sleep | Night (user's timezone) | 7-8h |
| Morning routine | First 30-60 min after wake | 30-60 min |
| Meals | Roughly morning, midday, evening | 3 x 20-30 min |
| Movement/gym | Once per day | 30-60 min |
| Family/personal presence | Evening or user-defined | 30-60 min |
| Weekly decompression | Friday-Sunday window | ~4h total |

Some people need more. Some need less. But these are the baseline
for a human who does not burn out.

---

## EXCEPTIONS — THE ONLY INPUT SURFACE

The user is NOT asked 20 setup questions about sleep, lunch, gym.
The system assumes the defaults above.

The user ONLY provides exceptions — things that differ from the baseline.

### Exception examples:

| User says | System does |
|---|---|
| "Monday 4-6pm I pick up my daughter" | Blocks Monday 4-6pm as unavailable |
| "I can't start before 10am" | Shifts all morning blocks to start at 10am |
| "I travel Tuesday-Wednesday every other week" | Marks those days as reduced capacity |
| "I'm a morning person, peak focus 6-9am" | Allocates highest-priority maker work to 6-9am |
| "I work out at 6am not evening" | Moves gym anchor to 6am |
| "Friday is family day, no work after 2pm" | Blocks Friday 2pm onward |

### What is NOT asked:
- "How many hours do you sleep?"
- "When do you eat lunch?"
- "Do you exercise?"
- "How much personal time do you need?"

These are assumed. The system just works from the budget.

---

## CHRONOTYPE

Not everyone peaks at the same time. The system must know when the user's
peak energy occurs to place high-priority work correctly.

| Chronotype | Peak window | Best for | Declining window |
|---|---|---|---|
| Early bird | 6am - 10am | Deep work, maker blocks, hard decisions | After 2pm |
| Standard | 9am - 12pm | Deep work, maker blocks, hard decisions | After 3pm |
| Night owl | 10am - 1pm or 8pm - 12am | Deep work, maker blocks, hard decisions | Early morning |

### How to detect:
- Ask once: "When do you do your best thinking?" or
- Infer from exceptions: "I can't start before 10am" suggests not early bird

### How to apply:
- Peak window = maker blocks, IPAs, hard decisions (see prioritization-rules.md)
- Declining window = manager blocks, admin, email, meetings
- Low window = shutdown ritual, planning next day

---

## BACKWARD PLANNING

All scheduling builds BACKWARD from fixed commitments.

### The sequence:

```
1. Start with 24 hours
2. Subtract sleep (7-8h)                    → 16-17h remain
3. Subtract personal anchors (~2h)          → 14-15h remain
4. Subtract user exceptions                 → actual available hours
5. Subtract weekly leisure (~4h Fri-Sun)    → weekly capacity known
6. Place MUST-have deadlines first
7. Place maker blocks in peak energy windows
8. Place manager blocks in declining windows
9. Fill remaining with SHOULD and COULD tasks
10. Leave buffer (never fill 100%)
```

### Buffer rule:
Never schedule more than 85% of available time. The remaining 15% absorbs:
- Tasks running over estimate
- Emergencies and urgent interruptions
- Transition time between tasks
- Mental recovery between blocks

---

## WEEKLY VIEW

| Day part | Mon-Thu | Fri | Sat-Sun |
|---|---|---|---|
| Peak energy | Maker blocks / IPAs | Maker or half-day | Leisure or optional maker |
| Mid energy | Manager blocks / meetings | Wrap-up, planning | Personal / family |
| Low energy | Admin, email, shutdown ritual | Weekly review | Recovery |
| Evening | Personal / family | Leisure | Leisure |

This is a template. User exceptions override any slot.

---

## ANTI-PATTERNS

1. Scheduling from 24 hours instead of 14-15 hours
2. Asking users to configure their entire life during setup
3. Showing sleep, meals, gym on the calendar by default — adds clutter
4. Ignoring chronotype — putting deep work at low-energy times
5. Filling 100% of available time — no buffer for reality
6. Planning forward from morning instead of backward from deadlines
7. Treating weekends as full work days — leads to burnout within weeks
