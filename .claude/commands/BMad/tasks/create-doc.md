# /create-doc Task

When this command is used, execute the following task:

<!-- Powered by BMAD™ Core -->

# Create Document from Template (YAML Driven)

## ⚠️ CRITICAL EXECUTION NOTICE ⚠️

**THIS IS AN EXECUTABLE WORKFLOW - NOT REFERENCE MATERIAL**

When this task is invoked:

1. **DISABLE ALL EFFICIENCY OPTIMIZATIONS** - This workflow requires full user interaction
2. **MANDATORY STEP-BY-STEP EXECUTION** - Each section must be processed sequentially with user feedback
3. **ELICITATION IS REQUIRED** - When `elicit: true`, you MUST use the 1-9 format and wait for user response
4. **NO SHORTCUTS ALLOWED** - Complete documents cannot be created without following this workflow

**VIOLATION INDICATOR:** If you create a complete document without user interaction, you have violated this workflow.

## Critical: Template Discovery

If a YAML Template has not been provided, list all templates from .bmad-core/templates or ask the user to provide another.

## Documentation Anchor ID Standard

**Requirement:** All markdown headings must include stable anchor IDs using the format `{#anchor-id}`.

**Format:** `# Heading Text {#anchor-id}`

**Naming Convention:**
- Use kebab-case (lowercase with hyphens)
- Keep concise but descriptive
- Include hierarchy context for sub-sections when helpful
- Ensure uniqueness within each document

**Examples:**
```markdown
# Architecture Document {#architecture-document}
## Library-First Implementation {#library-first-implementation}
### Constitutional Requirements {#library-constitutional-requirements}
#### Package Structure {#package-structure-standard}
```

**Implementation:** When creating or editing documentation, add `{#anchor-id}` immediately after each heading text on the same line. This enables precise cross-referencing, table of contents generation, and stable deep linking.

## CRITICAL: Resolve Section Assumptions Format

Scoped override: Only within ‘Resolve Section Assumptions’, suspend the ‘Mandatory Elicitation Format’. Outside this section, the standard ‘Mandatory Elicitation Format’ applies.

**Assumption Output Format:**

Display each assumption as follows:
- Format: `[{Status}] {Title}`
- Status indicators:
    - `✅` = Validated/Confirmed
    - `❌` = Invalid/Rejected
    - `❔` = Needs Resolution (Ambiguous | Conflicting | Tradeoffs | Unclear | Pending)

Additional Assumption Output formatting rules:
- Place status indicator directly before title with a single space
- If Intent is provided, append as: ` → {Intent}`. If Decision is available or pending, append: ` → Decision: {Decision|Pending}`. If both are present: ` → {Intent}; Decision: {Decision|Pending}`.
- For lists of assumptions, use consistent indentation
- Example outputs:
    - `✅ User authentication is required`
    - `❌ Database will handle 1M concurrent users`
    - `❔ Third-party API rate limits → Need to verify actual limits`
    - `❔ Third-party API rate limits → Need to verify actual limits; Decision: Pending`
    - `✅ Preferred framework → React 18; Decision: React 18`

**When `elicit: true`, this is a HARD STOP requiring user interaction:**

Begin Assumptions Mode
- Suspend the ‘Mandatory Elicitation Format’.
- Use focused Q&A or up to three concise options per single assumption.
- Yes/no confirmations are allowed only for:
  - Per-assumption resolution confirmation.
  - Final approval of the ordered list of assumptions.
- Require explicit user approval; do not self-approve.
End Assumptions Mode — Upon exiting this section, immediately resume the standard ‘Mandatory Elicitation Format’ for the section’s content.

Scope Determination — IDs: RULE-1, RULE-2
- RULE-1 (Effective Scope Precedence): Determine an effective scope for each section as the minimal information required to render that section. Precedence for scope sources: `content` > `template` > `instruction` > `assumptions.guidance` > `assumptions.checklist`.
- RULE-2 (Content-First Assumptions): If a section defines `content`, limit assumptions strictly to what is required to render that `content` and its immediate explanatory context. Do not introduce assumptions that are only relevant to sibling/child sections or later steps.

Assumptions Preparation Output Scope
- Outputs produced while executing `assumptions.guidance` are ephemeral and for preparation only.
- Do not include `assumptions.guidance` outputs in the final document body; only use them to inform decisions and follow-up elicitation.

Nesting and Recursion
- The properties `assumptions.guidance` and `assumptions.checklist` may appear at any section nesting depth.
- Guard: Run “Resolve Section Assumptions” for a section only when that section defines an `assumptions` property; otherwise skip directly to drafting that section’s `instruction`.
- Apply this rule recursively: for every subsection, process its assumptions (if present) before drafting its own content.
- GUARD-1 (Child Section Isolation): While resolving assumptions for a parent section, do not parse, evaluate, or act on any child section’s `assumptions.guidance` or `assumptions.checklist`. Process each section’s assumptions only when that section is active.

### Example: Assumption Evaluation Loop (Assumptions Mode)

- Context: Resolve assumptions before drafting section content. Keep all interactions within Assumptions Mode rules.

1) Initialization
- Assistant: "Resolve Section Assumptions — Section: <section_title>"
- Assistant: "Effective Scope: <one-line summary of the minimal inputs/intent for this section>"  
  (UI-1)
- Assistant: "Identified assumptions (ordered by priority):"
  - "❔ <Assumption A Title> → <Intent/what we need to clarify>"
  - "❔ <Assumption B Title> → <Intent/what we need to clarify>"
  - "❔ <Assumption C Title> → <Intent/what we need to clarify>"

2) Per‑Assumption Evaluation (A)
- Assistant: "Assumption: <Assumption A Title>"
- Assistant: "Status: ❔ unclear"
- Assistant: "Intent: <short intent statement>"
- Choose one path:
  - Focused question
    - "Question: <one focused question to resolve ambiguity>. You may reply in your own words (brief is fine)."
  - Up to 3 options
    - "Options (choose 1–3, or reply in your own words):"
      - "1) <Option 1, concise rationale>"
      - "2) <Option 2, concise rationale>"
      - "3) <Option 3, concise rationale>"
- STOP and wait for user.

3) Evaluate Response
- Re‑evaluate Status based on reply:
  - If clear:
    - "Updated: <Assumption A Title> → Status: ✅ clear — Decision: <brief decision>"
  - If still unclear:
    - "Status remains ❔ unclear. Follow‑up question: <one focused question>. Please choose an option or clarify in your own words."
    - STOP and wait for user.
  - If explicitly skipped:
    - "Marked ❌ unanswered — Note: <brief follow‑up note>"

4) Progression Rule
- For Status ✅: Proceed to the next assumption without additional confirmation.
- For Status ❌ or ❔: Continue the loop (focused Q&A or refined options) until resolved or explicitly skipped.

5) Apply Decision Scope
- Never apply a decision from one assumption to others implicitly.
- If a similar decision could apply, ask explicitly:
  - "Apply the same decision to assumptions [B, C]? (yes/no)"
  - STOP and wait for user.

6) Proceed to Next Assumption (B, C)
- Repeat steps 2–5 for each assumption in order of priority.

7) Final Ordered List Approval
- "Final ordered assumptions list for <section_title>:"
  - "✅ <Assumption A Title> → <Decision/Intent>"
  - "✅ <Assumption B Title> → <Decision/Intent>"
  - "❔ <Assumption C Title> → Decision: Pending"
  - "❌ <Assumption D Title> → <Follow‑up note>"
- "Please type exactly: 'APPROVE ASSUMPTIONS' to confirm, or provide changes/additions/removals."
- STOP and wait for user.

Notes
- Use yes/no only for per‑assumption resolution confirmation and the final list approval.
- Do not include any Assumptions Mode interactions or prep outputs in the final document body.

### Implementer Checklist (Assumptions Mode)

- Identify and prioritize assumptions (from `assumptions.checklist` and context).
- For each assumption: present Title/Status/Intent/Decision; ask one focused question OR up to 3 options; re‑evaluate; if ✅ ask for yes/no confirmation; if ❌/❔ continue or mark accordingly.
- After all assumptions: present the ordered list and require the exact token 'APPROVE ASSUMPTIONS'.

### Edge Cases Guidance

- Shared decisions: ask explicitly to apply decisions across assumptions; never infer.
- Blocked preparation: if an assumption depends on unavailable resources, use Execution Fallbacks (provide artifacts, proceed‑generic, defer) and record ephemerally.
- Nested sections: run this loop for each subsection before drafting its content.

**YOU MUST:**

Implementation Note (IMPL-1 — non-output guidance)
- Purpose: Reinforce scope-first behavior during assumption discovery for a section.
- Pseudocode:
  - `source = firstNonNull(section.content, section.template, section.instruction, section.assumptions.guidance, section.assumptions.checklist)`
  - `scopeIntent = summarizeMinimalIntent(source)`
  - `assumptions = identifyFrom(section.assumptions.checklist + contextualInputs)`
  - `assumptions = filterByAlignment(assumptions, scopeIntent)`
  - Proceed only with assumptions needed to render the current section per RULE-1 and RULE-2.
  - Status evaluation order: clear → unanswered → conflicting → ambiguous → tradeoffs → unclear. Use ‘tradeoffs’ only when options are comparable with no clear winner; otherwise prefer a more specific non-clear type.

1. Think hard with step-wise reasoning to execute the section assumptions.guidance (if available)

2. Starting with the optional section assumptions.checklist property identify and list all assumptions that would need to be made to properly follow the section instruction. Consider:
    1. Contextual assumptions - What background knowledge, domain expertise, or situational context is presumed?
    2. Input assumptions - What characteristics about the data, format, or quality of inputs are assumed?
    3. Capability assumptions - What tools, resources, or abilities are assumed to be available?
    4. Scope assumptions - What boundaries, limitations, or constraints are implied but not explicitly stated?
    5. Audience assumptions - What level of expertise, familiarity, or goals are assumed about the end user?
    6. Unstated prerequisites - What prior steps, conditions, or preparations are implicitly required?

3. For each assumption identified, note whether it's:
    - Explicitly stated section assumptions checklist
    - Explicitly stated in the prompt
    - Reasonably inferable from context
    - Potentially problematic if incorrect

4. Order the assumptions based on their priority as they relate to the intent of the section instruction, and more broadly the project

5. Output the section title and the list of assumptions that need to be evaluated and resolved with a relevant message to the user

6. When asked to evaluate an assumption for clarity:
    1. Evaluate the intent of the assumption as it relates to this workflow and project
    2. Evaluate all the information provided so far, including any new information, to determine Status:
        - clear — intent is fully and unambiguously resolved.
        - unanswered — no information to address the intent.
        - ambiguous (❔) — multiple plausible interpretations; clarify meaning or scope.
        - conflicting (❔) — inputs disagree; identify source of truth or reconcile.
        - tradeoffs (❔) — multiple viable options with comparable value and no clear winner; require decision criteria.
        - unclear (❔) — insufficient detail or missing constraints; does not fit the above categories.

        Note: Use “tradeoffs” only when options are comparable, satisfy constraints, and lack decisive criteria. If any option clearly dominates or constraints eliminate others, prefer “clear” (if decided) or another non-clear type (ambiguous/unclear) with a targeted question.

    3. return these properties:

    - Title: the title of each assumption (e.g. Team preferences or mandated technologies, Deployment/hosting targets and constraints, etc)
    - Intent: the evaluated intent of the assumption
    - Status: the evaluated status of the assumption
    - Decision: the current decision value or ‘Pending’ (even for ❔/❌ states)

7. For each assumption being evaluated (INTERACTIVE LOOP — HARD STOPS):

    1. Evaluate the assumption for clarity (per 3. above)
    2. Output the assumption summary using this exact format (ensures spacing and readability):
        - Line 1: "⏺ Assumption: <Title>  Status: <Status>"
        - Line 2: "Intent: <Intent>"
        - Line 3: "Decision: <Decision>"
    3. If Status is ✅ clear:
        - Echo the updated assumption using the summary format above and continue. Do not prompt for confirmation.
    4. If Status is ❌ unanswered or any ❔ non-clear type (ambiguous/conflicting/tradeoffs/unclear), start an interactive loop for THIS assumption only:
        - Ask one focused question OR present up to 3 viable options with concise pros/cons and a recommended path.
        - For ambiguous: ask a clarifying question to disambiguate meaning or scope.
        - For conflicting: ask to choose the source of truth or how to reconcile inputs.
        - For tradeoffs: present up to 3 options with concise pros/cons and a recommended path; ask for tie-break criteria (e.g., cost, time, risk) when no clear winner.
        - For unclear: ask for the minimal missing detail or constraint required to proceed.
        - End with a direct prompt: "Please choose an option (1–3) or clarify in your own words."
        - STOP and WAIT for user response. Do not proceed until the user replies.
        - After each user reply, re-evaluate Status (✅/❌/❔) using 3. above.
        - If Status is still ❌/❔, continue the loop with another focused question or refined options.
        - When Status becomes ✅ clear, echo the updated assumption using the summary format above and continue. Do not prompt for confirmation.
    5. Do NOT proceed to the next assumption until this assumption is either:
        - ✅ clear, or
        - Explicitly skipped by the user. If skipped, mark as ❌ Unanswered and record a brief follow-up note.
    6. Never apply a decision from one assumption to others implicitly. If you believe the same decision should apply, ASK: "Apply the same decision to assumptions [X, Y, Z]?" — then STOP and WAIT for confirmation.

    Note: Enumerated option detection — treat a reply as a selection if it is exactly the numeric index (e.g., "1", "2", "3"), a phrase like "Option <n>", or the exact option text (minor whitespace/case differences acceptable).

8. **Continue until complete**

9. Order the evaluated and resolved assumptions based on their priority as they relate to the section, and more broadly the project

10. Then Prompt the user to confirm the status of the ordered list containing evaluated and resolved assumptions (HARD STOP):

     - Output the ordered list of evaluated and resolved assumptions
     - MANDATORY while the user has NOT approved the assumptions:
         - Invite feedback from the user; allow them to discuss, clarify, change, add, or remove assumptions
         - STOP and WAIT for explicit approval. Do not proceed to drafting until approved.
         - Require explicit typed approval token: 'APPROVE ASSUMPTIONS'. Do not accept implicit or agent-generated confirmations.

11. Provide an ephemeral Decision Recap to the user; do not include decision logs in the document body.

12. Return the ordered list of evaluated and resolved assumptions

### Deviation Protocol (Generic)

When proposing a choice that conflicts with previously approved constraints, documented requirements, or enforced environment/tooling constraints:

- Always include “Adhere to Existing Constraint” as one option.
- Provide 1–2 alternative options with concise pros/cons covering security, operability, cost, performance, team skills, and reversibility/lock‑in.
- If recommending a deviation, include a short Deviation Impact Summary (timeline, complexity, operability burden, cost, skill fit, reversibility/lock‑in, and compliance implications if applicable).
- Require explicit typed approval for deviations: user must reply exactly with “APPROVE DEVIATION: <short summary>” or “DECLINE DEVIATION”.
- Keep approval recaps ephemeral; do not include them in the document body.

### Execution Fallbacks for `assumptions.guidance`

If `assumptions.guidance` cannot be executed due to missing permissions, unavailable resources, or restricted environment (e.g., no network access):

- Prompt the user to choose one of the following paths:
  1) Provide the required artifacts or access details (e.g., files, links, tokens) so the preparation can proceed.
  2) Proceed with generic assumptions for the blocked items (explicitly list them), acknowledging potential rework.
  3) Defer this section (or specific blocked assumptions) until resources/access are available.
- Do not self-approve a fallback. Record the chosen path ephemerally and continue per the user’s decision.
- Maintain the standard Assumptions Mode interaction rules (focused Q&A; no per-assumption confirmations) while working through fallbacks.

## CRITICAL: Mandatory Elicitation Format

**When `elicit: true`, this is a HARD STOP requiring user interaction:**

**YOU MUST:**

1. Present section content
2. Provide detailed rationale (explain trade-offs, assumptions, decisions made)
3. **STOP and present numbered options 1-9:**
   - **Option 1:** Always "Proceed to next section"
   - **Options 2-9:** Select 8 methods from data/elicitation-methods
   - End with: "Select 1-9 or just type your question/feedback:"
4. **WAIT FOR USER RESPONSE** - Do not proceed until user selects option or provides feedback

**WORKFLOW VIOLATION:** Creating content for elicit=true sections without user interaction violates this task.

**NEVER ask yes/no questions or use any other format.**

## Processing Flow

1. **Parse YAML template** - Load template metadata and sections
2. **Set preferences** - Show current mode (Interactive), confirm output file
3. **Process each section:**
   - Skip if condition unmet
   - Check agent permissions (owner/editors) - note if section is restricted to specific agents
   - Resolve Section Assumptions (only if `assumptions` is defined)
   - Draft content using section instruction
   - Present content + detailed rationale
   - **IF elicit: true** → MANDATORY **IF elicit: true** → **EXECUTE "Mandatory Elicitation Format" protocol**
   - **MANDATORY: Save section content to file immediately after completion** - do not wait until end
4. **Continue until complete**

## Detailed Rationale Requirements

When presenting section content, ALWAYS include rationale that explains:

- Trade-offs and choices made (what was chosen over alternatives and why)
- Key assumptions made during drafting
- Interesting or questionable decisions that need user attention
- Areas that might need validation

## Elicitation Results Flow

After user selects elicitation method (2-9):

1. Execute method from data/elicitation-methods
2. Present results with insights
3. Offer options:
   - **1. Apply changes and update section**
   - **2. Return to elicitation menu**
   - **3. Ask any questions or engage further with this elicitation**

## Agent Permissions

When processing sections with agent permission fields:

- **owner**: Note which agent role initially creates/populates the section
- **editors**: List agent roles allowed to modify the section
- **readonly**: Mark sections that cannot be modified after creation

**For sections with restricted access:**

- Include a note in the generated document indicating the responsible agent
- Example: "_(This section is owned by dev-agent and can only be modified by dev-agent)_"

## YOLO Mode

User can type `#yolo` to toggle to YOLO mode (process all sections at once).

## CRITICAL REMINDERS

**❌ NEVER:**

- Ask yes/no questions for elicitation
- Use any format other than 1-9 numbered options
- Create new elicitation methods
Exception: Inside ‘Resolve Section Assumptions’, yes/no is allowed solely for final assumptions-list approval.

**✅ ALWAYS:**

- Use exact 1-9 format when elicit: true
- Select options 2-9 from data/elicitation-methods only
- Provide detailed rationale explaining decisions
- End with "Select 1-9 or just type your question/feedback:"
