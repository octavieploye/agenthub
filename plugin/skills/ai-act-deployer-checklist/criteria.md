# AI Act Classification Criteria

Reference document for the AI Act Deployer Checklist skill. Apply these criteria exactly as written — do not invent additional categories or modify thresholds.

Legal basis: Regulation (EU) 2024/1689 (EU AI Act), published 12 July 2024, entered into force 1 August 2024.

---

## Section A — Prohibited Practices (Art. 5)

In force since: **2 February 2025**. Any system matching these descriptions MUST be discontinued.

### A1. Subliminal manipulation
AI that deploys subliminal techniques beyond a person's consciousness, or purposefully manipulative or deceptive techniques, to materially distort behavior causing significant harm.

### A2. Exploitation of vulnerabilities
AI that exploits vulnerabilities of persons due to age, disability, or specific social/economic situation to materially distort behavior causing significant harm.

### A3. Social scoring by public authorities
AI used by public authorities (or on their behalf) for evaluating/classifying persons based on social behavior or personal characteristics, leading to detrimental treatment unrelated to the context of data collection or disproportionate to behavior.

### A4. Individual criminal offense risk assessment
AI that assesses the risk of a natural person committing a criminal offense solely based on profiling or personality traits. Exception: AI augmenting human assessment based on objective, verifiable facts directly linked to criminal activity.

### A5. Untargeted facial image scraping
AI that creates or expands facial recognition databases through untargeted scraping of facial images from the internet or CCTV footage.

### A6. Emotion recognition in workplaces and education
AI that infers emotions of persons in the workplace or educational institutions. Exceptions: systems used for medical or safety reasons (e.g., monitoring pilot fatigue).

### A7. Biometric categorization for sensitive attributes
AI that categorizes persons based on biometric data to deduce or infer race, political opinions, trade union membership, religious/philosophical beliefs, sex life, or sexual orientation. Exception: labeling or filtering of lawfully acquired biometric datasets, or law enforcement categorization of biometric data.

### A8. Real-time remote biometric identification in public spaces for law enforcement
Real-time remote biometric identification in publicly accessible spaces for law enforcement. Limited exceptions: targeted search for victims of specific crimes, prevention of genuine/imminent threat to life or terrorist attack, identification of suspects for specific serious crimes.

---

## Section B — Risk Classification Decision Tree

Apply this decision tree sequentially for each AI system. Stop at the first match.

### Step 1: Is it an AI system under the Act?

The AI Act defines an AI system as: "a machine-based system designed to operate with varying levels of autonomy, that may exhibit adaptiveness after deployment and that, for explicit or implicit objectives, infers, from the input it receives, how to generate outputs such as predictions, content, recommendations, or decisions that can influence physical or virtual environments." (Art. 3(1))

**NOT AI systems** (out of scope):
- Simple rule-based software with no inference capability
- Traditional statistical methods without machine learning
- Basic search and database queries
- Spreadsheet formulas and calculators
- Software that follows pre-programmed instructions without inferring from data

If NOT an AI system -> **OUT OF SCOPE**. Stop.

### Step 2: Is it a prohibited practice?

Apply Section A criteria above.

If YES -> **PROHIBITED**. Must discontinue.

### Step 3: Is it a high-risk AI system?

An AI system is HIGH-RISK if it meets EITHER of these conditions:

#### Condition 1 — Safety component of regulated products (Annex I)

The AI is:
- A safety component of a product covered by EU harmonization legislation listed in Annex I, OR
- Is itself such a product

AND the product is required to undergo third-party conformity assessment.

**Annex I sectors include** (non-exhaustive):
- Machinery (Regulation (EU) 2023/1230)
- Toys (Directive 2009/48/EC)
- Recreational craft (Directive 2013/53/EU)
- Lifts (Directive 2014/33/EU)
- Equipment for explosive atmospheres (Directive 2014/34/EU)
- Radio equipment (Directive 2014/53/EU)
- Pressure equipment (Directive 2014/68/EU)
- Civil aviation safety
- Motor vehicles and trailers
- Medical devices (Regulation (EU) 2017/745)
- In-vitro diagnostic medical devices (Regulation (EU) 2017/746)
- Rail systems interoperability

Enforcement deadline: **2 August 2027**

#### Condition 2 — Annex III use cases (standalone high-risk)

The AI system falls into one of these categories based on its INTENDED PURPOSE:

**B3.1 Biometrics** (where permitted by EU/national law)
- Remote biometric identification (not real-time in public for law enforcement, which is prohibited)
- Biometric categorization by sensitive/protected attributes
- Emotion recognition

**B3.2 Critical infrastructure**
- Safety components of: management/operation of road traffic, water/gas/heating/electricity supply, digital infrastructure
- Exception: AI whose output is purely ancillary and poses no risk to critical infrastructure safety

**B3.3 Education and vocational training**
- Determining access to or admission into educational institutions
- Evaluating learning outcomes (including using outcomes to steer learning process)
- Assessing appropriate level of education for individuals
- Monitoring/detecting prohibited behavior during tests

**B3.4 Employment, workers management, access to self-employment**
- Recruitment: placing targeted job ads, screening/filtering applications, evaluating candidates
- Decisions affecting terms of work: promotion, termination, task allocation based on individual behavior/traits/characteristics
- Monitoring and evaluating worker performance and behavior

**B3.5 Access to essential private services and public services**
- Creditworthiness assessment / credit scoring of natural persons (exception: fraud detection)
- Risk assessment and pricing for life and health insurance
- Evaluation of eligibility for public assistance benefits/services (and granting, reducing, revoking, reclaiming)
- Evaluating eligibility for public assistance or emergency services dispatching (emergency call triage)

**B3.6 Law enforcement** (where permitted by applicable law)
- Assessment of risk of person becoming victim
- Polygraphs and similar tools
- Evidence reliability assessment
- Assessment of risk of offending/re-offending (not solely based on profiling — that is prohibited)
- Profiling during detection, investigation, prosecution

**B3.7 Migration, asylum, border control**
- Polygraph-like tools for assessing risk
- Application assessment for asylum, visa, residence permits, and associated complaints
- Detection, recognition, identification of persons (except document verification)

**B3.8 Administration of justice and democratic processes**
- AI used by judicial authorities to research and interpret facts/law, apply law to concrete facts
- AI used to influence outcome of elections/referendums or voting behavior (excluding organizational/logistical tools)

Enforcement deadline: **2 August 2026**

#### Significant exception for Annex III systems (Art. 6(3))

An Annex III AI system is NOT classified as high-risk if it does NOT pose a significant risk of harm to health, safety, or fundamental rights — including by not materially influencing the outcome of decision-making. This exception does NOT apply if the system performs profiling of natural persons.

The provider must document this exception determination and notify the national market surveillance authority before placing the system on the market.

If HIGH-RISK -> proceed to Gate 4a in SKILL.md.

### Step 4: Does it have transparency obligations?

The following systems have mandatory transparency obligations regardless of their risk classification:

| System type | Test question | Obligation |
|---|---|---|
| Chatbot / conversational AI | "Does a human interact with this system via text or voice, and could they think they're talking to a human?" | Disclose AI interaction (Art. 50.1) |
| Emotion recognition | "Does this system detect or infer emotional states?" | Inform exposed persons (Art. 50.2) |
| Biometric categorization | "Does this system categorize persons by physical/behavioral/physiological characteristics?" | Inform exposed persons (Art. 50.2) |
| Deep fake (image/audio/video) | "Does this system generate or manipulate image, audio, or video content that resembles existing persons, objects, places?" | Label as artificially generated/manipulated (Art. 50.4) |
| AI-generated text on public interest matters | "Does this system generate text published to inform the public on matters of public interest?" | Label as AI-generated, unless human editorial review (Art. 50.4) |

If any apply -> **LIMITED RISK** (transparency obligations). Proceed to Gate 4b in SKILL.md.

### Step 5: Minimal risk

If the system is not prohibited, not high-risk, and has no transparency obligations -> **MINIMAL RISK**.

No mandatory obligations apply. Voluntary codes of conduct are encouraged (Art. 95). Proceed to Gate 4c in SKILL.md.

---

## Section C — Penalty Framework

| Violation | Max fine |
|---|---|
| Prohibited AI practices (Art. 5) | EUR 35 million or 7% of global annual turnover (whichever is higher) |
| High-risk obligations, GPAI obligations, other main provisions | EUR 15 million or 3% of global annual turnover |
| Supplying incorrect/incomplete/misleading information to authorities | EUR 7.5 million or 1% of global annual turnover |

**SME / startup reduction**: for SMEs and startups, the penalty is the lower of the absolute amount or the percentage — providing a de facto cap for smaller companies.

---

## Section D — AI Literacy (Art. 4)

**In force since 2 February 2025.** Applies to ALL providers and deployers, regardless of risk level.

Providers and deployers must ensure that their staff and other persons dealing with AI systems on their behalf have a sufficient level of AI literacy, taking into account:
- Their technical knowledge
- Their experience
- The context of the AI system
- The persons or groups of persons on which the AI system is to be used

This is NOT a check-the-box training requirement — it is a competence obligation proportionate to context.

---

## Section E — Substantial Modification (Art. 3(23))

A **substantial modification** is a change to an AI system after its placing on the market or putting into service which:
- Is not foreseen or planned in the initial conformity assessment by the provider, AND
- Affects the compliance of the AI system with the Act's requirements, OR changes the intended purpose for which the AI system has been assessed

**Examples of substantial modification:**
- Fine-tuning a model that changes its risk classification
- Changing the intended purpose (e.g., from entertainment to recruitment screening)
- Retraining on fundamentally different data that changes system behavior in high-risk domains
- Integrating the AI into a different product where it becomes a safety component

**NOT substantial modification:**
- Bug fixes and security patches
- Performance optimization without changing intended purpose
- Interface/UX changes that don't affect the AI's inference logic
- Updating training data of the same type and distribution
