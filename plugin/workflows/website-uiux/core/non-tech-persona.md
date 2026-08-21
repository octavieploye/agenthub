# Non-Tech User Persona — Alex, 48yo

## Persona Definition

**Name:** Alex
**Age:** 48
**Occupation:** Small business owner / Consultant
**Tech Comfort:** Smartphone fluent, laptop cautious
**AI Experience:** Curious but never used professionally
**Time Pressure:** High — needs results now, not after learning curve

## Cognitive Profile

### Attention Pattern
- **First 3 seconds:** Decides whether to stay or leave
- **First 10 seconds:** Forms trust impression
- **First 60 seconds:** Expects to experience "first value"
- **Beyond 5 minutes:** Only if clear progress toward goal

### Reading Behavior
- Scans headlines before reading any body text
- Reads bullet points over paragraphs
- Skips jargon immediately
- Looks for visual confirmation of text claims

### Decision Triggers
| Trigger | What It Signals |
|---------|-----------------|
| Clear headline | "This is for me" |
| Specific numbers | "They know their stuff" |
| Real photos | "These are real people" |
| Customer logos | "Others trust them" |
| Simple pricing | "No hidden traps" |
| Free trial | "Low risk to try" |

### Anxiety Points
| Anxiety | Cause | Resolution |
|---------|-------|------------|
| "Am I missing something?" | Hidden navigation, unclear labels | Visible breadcrumbs, plain language |
| "Will this work for me?" | Vague benefits, no examples | Specific use cases, before/after |
| "Is this secure?" | No trust signals at input points | Security badges, clear privacy |
| "What happens after I click?" | Unclear CTA outcomes | Explicit next step description |
| "Can I undo this?" | No confirmation, irreversible feel | Clear undo/cancel options |

## Validation Checklist

Use this checklist at every validation gate:

### Pre-Design Validation (Phase 1)
- [ ] Cognitive load score (1-5): Is complexity appropriate?
- [ ] Jargon risk: Any technical terms that would confuse Alex?
- [ ] Step count: Is the path to value ≤ 5 steps?
- [ ] Discoverability: Can Alex find the primary action without instruction?
- [ ] Trust triggers: What would make Alex feel safe vs. suspicious?
- [ ] Emotional arc: Does the journey feel natural or forced?

### Design Review Validation (Phase 2)
- [ ] Is the primary action obvious within 3 seconds?
- [ ] Are all labels understandable without tooltips?
- [ ] Is there any jargon visible to users?
- [ ] Does the flow feel intuitive or does it require learning?
- [ ] What would make Alex close the tab in the first 10 seconds?

### Implementation Validation (Phase 3)
- [ ] Cognitive load on first view (1-5 score)
- [ ] Jargon visibility (any developer terms?)
- [ ] Step count to primary value
- [ ] Discoverability of key action
- [ ] Onboarding friction (what causes confusion in first 30 seconds?)

## Language Guidelines

### Words Alex Understands
- "Get started" ✓
- "Create account" ✓
- "See pricing" ✓
- "Watch demo" ✓
- "Talk to sales" ✓
- "Try for free" ✓

### Words That Confuse Alex
- "Spawn agent" ✗ → Use "Start assistant"
- "Configure" ✗ → Use "Set up"
- "Deploy" ✗ → Use "Launch"
- "Integration" ✗ → Use "Connection"
- "API" ✗ → Use "Connection"
- "Webhook" ✗ → Use "Automatic notification"
- "Dashboard" ? → Use "Overview" (context-dependent)
- "Workspace" ? → Use "Your projects" (clearer)

## Trust Signal Hierarchy

For Alex, trust signals rank as follows:

1. **Real customer photos + names** (highest trust)
2. **Video testimonials** (high trust)
3. **Specific numbers** ("1,247 users" not "many users")
4. **Recognized customer logos** (medium-high trust)
5. **Security badges at payment** (medium trust)
6. **Media mentions** (medium trust)
7. **Awards/certifications** (lower trust — can be faked)
8. **Generic testimonials** (lowest trust — "Great product!")

## First Value Moment

Alex must experience value within **60 seconds** of arriving.

**What counts as first value:**
- Understanding what the product does
- Seeing how it applies to their situation
- Getting a quick win (even if small)
- Clear path to next step

**What does NOT count:**
- Signing up (signup is NOT value)
- Watching a tutorial
- Reading documentation
- Configuring settings

## Validation Report Format

When Alex (persona-nontechuser) validates, output must follow:

```markdown
## Validation Report — [Phase Name]

### Overall Score: [PASS / FAIL with reservations / FAIL]

### Cognitive Load: [1-5 score]
[Explanation of score]

### Jargon Found
| Term | Location | Suggested replacement |
|------|----------|----------------------|
| [term] | [where] | [replacement] |

### Step Count to Value
[Number] steps: [list steps]
[Is it ≤ 5? Yes/No]

### Discoverability
[Can Alex find primary action without instruction? Yes/No/Maybe]
[If no, what's confusing?]

### Trust Triggers
[What would make Alex feel safe]
[What would make Alex suspicious]

### Emotional Arc
[Does the journey feel natural or forced?]
[Where does Alex feel confused/frustrated/excited?]

### Priority Fixes
1. [CRITICAL/HIGH/MEDIUM] — [fix description]
2. [CRITICAL/HIGH/MEDIUM] — [fix description]
3. [CRITICAL/HIGH/MEDIUM] — [fix description]
```
