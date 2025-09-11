# /develop-story Task

When this command is used, execute the following task:

<!-- Powered by BMAD™ Core -->

# develop-story

Implement a story by following requirements, executing tasks sequentially, and ensuring all acceptance criteria are met with proper testing and validation.

## Inputs

```yaml
required:
  - story_path: 'Path to story file to implement'
  - developer_type: 'Type of developer executing (senior|junior)'
optional:
  - implementation_plan_path: 'Path to implementation plan (required for junior developers)'
  - skip_ui_check: 'Skip UI documentation check if explicitly not needed'
```

## Prerequisites

### For Senior Developers

- Story must exist and be in "Approved" status (not draft)
- All architecture documents from devLoadAlwaysFiles must be loaded
- Story contains complete acceptance criteria and tasks

### For Junior Developers

- Story must exist and have an implementation plan at `{story-filename}-implementation-plan.md`
- Implementation plan must contain required sections: Tasks, Technical Details, Dependencies, Testing Strategy
- If implementation plan missing or incomplete, HALT and request senior developer create one

## Development Process

### 1. Story Validation and Setup

#### 1.1 Load Story Context

- Load the complete story file
- Verify story status is appropriate for development
- Extract acceptance criteria, tasks, and dev notes
- Review any existing Dev Agent Record entries

#### 1.2 Implementation Plan Check

##### For Senior Developers (developer_type=senior)

- Check for implementation plan at: `{story-directory}/{story-filename}-implementation-plan.md`
- If exists:
  - **Ultra think to THOROUGHLY READ AND UNDERSTAND the entire implementation plan:**
    - Study all architectural decisions and their rationale
    - Review all Mermaid diagrams (component, sequence, flowcharts) step-by-step
    - Understand pseudo-code algorithms and business logic flows
    - Analyze the planned data flow and integration patterns
    - Review test scenarios and edge cases identified in the plan
    - Understand WHY each technical decision was made
  - Consider plan recommendations but use professional judgment based on full understanding
  - When deviating from plan based on expertise:
    - Document deviation in implementation plan by adding/updating "Plan Amendments" section
    - Include: original approach, actual implementation, technical justification
    - Update affected sections to reflect actual implementation
  - Ensure plan remains accurate for future reference and knowledge sharing
- If no plan exists: Proceed using expertise and story requirements

##### For Junior Developers (developer_type=junior)

- Construct implementation plan path: `{story-directory}/{story-filename}-implementation-plan.md`
- Attempt to read implementation plan file
- If file does not exist:
  - Display: "❌ IMPLEMENTATION PLAN REQUIRED"
  - Display: "I need a detailed implementation plan from James before I can help with this story."
  - Display: "Expected file: {story-filename}-implementation-plan.md"
  - HALT - do not proceed with any development work
- If file exists but is incomplete:
  - Display: "⚠️ INCOMPLETE IMPLEMENTATION PLAN"
  - Display: "Required sections: Tasks, Technical Details, Dependencies, Testing Strategy"
  - HALT - do not proceed until plan is complete
- If file exists and is complete:
  - **THOROUGHLY STUDY AND UNDERSTAND the entire implementation plan:**
    - Read all sections multiple times until fully understood
    - Study all Mermaid diagrams - trace through each sequence diagram step by step
    - Understand every line of pseudo-code before attempting implementation
    - Review architectural decisions and understand WHY each was made
    - Study test scenarios to understand expected behavior and edge cases
    - Analyze data flow patterns and integration approaches
    - If ANY part is unclear: Add questions to implementation plan Questions section before starting
  - Only proceed to implementation after fully understanding the complete plan

### 2. Interface/UI Documentation Check (Technology-Agnostic)

**CRITICAL: Perform this check for ALL stories that involve any user interface or client changes (web, mobile, desktop).**

#### 2.1 Analyze Story for UI/Client Components

- Scan acceptance criteria and tasks for UI/client-related keywords:
  - Components, views, screens, pages, forms, layouts, styling, user interactions
  - Frontend, UI, UX, interface, client, display, render
  - Button, input, modal, page, screen, view, navigation
  - Responsive/adaptive, accessibility, mobile, desktop, iOS, Android, Electron

#### 2.2 Load UI/Client Documentation if Needed

If the story involves ANY UI/client changes:

- Read relevant UI/client docs in `docs/architecture/` (look for: frontend, ui, client, web, mobile, ios, android, desktop, electron, view, component, design)
- If present, also read any consolidated UI specs (e.g., `docs/front-end-spec.md`) without assuming web-only context
- Document key platform-appropriate patterns and requirements found:
  - Component/view structure patterns
  - Styling/appearance conventions appropriate to the platform
  - State management approaches
  - Input handling and validation patterns
  - Responsiveness/adaptivity across form factors
  - Accessibility requirements for the target platform
- For junior developers: Add questions to the implementation plan if UI/client requirements are unclear

#### 2.3 Skip Condition

- Only skip this check if `skip_ui_check=true` is explicitly passed
- Never skip for stories that mention UI/client in any capacity

### 3. Implementation Execution

#### 3.1 Task Processing Workflow

**For Each Task in Story:**

1. **Read Task**: Load the current task and all its subtasks
2. **Implement Task**:
   - For senior: Use expertise to implement based on requirements
   - For junior: Follow implementation plan step-by-step literally
3. **Write Tests**: Create comprehensive tests for the functionality
4. **Execute Validations**: Run project validation commands (lint, type-check, tests)
5. **Update Progress**: Only if ALL validations pass, mark task checkbox with [x]
6. **Update File List**: Add all new/modified/deleted files to story File List section
7. **Repeat**: Continue to next task until all complete

#### 3.1.a Traceability Step (All Developers)

- For each Acceptance Criterion (AC), confirm that implemented code maps to the test IDs and modules declared in the implementation plan's Traceability Matrix
- If an AC has no mapped tests or modules, add a question (junior) or add a Plan Amendment (senior) and resolve before proceeding
- **API Endpoint Contract Validation**: Verify that any API endpoint contract changes between backend and frontend are documented in the implementation plan's "API Contract Changes" section
  - For junior developers: If undocumented API endpoint changes are detected, halt and raise a question to the Senior Developer
  - For senior developers: If undocumented API changes are needed, update the implementation plan's "API Endpoint Contract Changes" section before proceeding

#### 3.1.b Project Structure Compliance (All Developers)

- Ensure all new/modified file paths and test locations conform to `docs/architecture/unified-project-structure.md`
- Place tests according to the prescribed structure and naming conventions; do not assume generic folders like `__tests__` unless explicitly defined there
- If a required path is unclear or appears to conflict with the plan:
  - Junior: add a question to the implementation plan and halt that step
  - Senior: update the plan (Plan Amendments) to correct paths and proceed

#### 3.2 Junior Developer Conservative Approach (if developer_type=junior)

**When Uncertain (confidence < 80%):**

- Add question to implementation plan Questions section
- Format: "**Q{number}: {Brief Title}** - {Detailed explanation with context}"
- Include: Current task, specific uncertainty, attempted approaches, why guidance needed
- Never assume implementation details not explicitly covered in plan
- If multiple valid approaches exist: Document options, ask for preference
- If debugging takes >30 minutes: Document issue and ask for help
- Timebox: If a single task exceeds 45 minutes or 2 failed attempts, add a question and halt that task
- Dependencies: Do not introduce any new dependencies unless explicitly whitelisted in the plan's Dependency Policy; otherwise, add a question and halt
- **API Endpoint Contracts**: **MUST NOT** change API endpoint contracts unless the change is specifically documented in the implementation plan's "API Endpoint Contract Changes" section; if this scenario is encountered, raise a question to the Senior Developer and halt that task

#### 3.3 Code Quality Standards

**After Each Implementation Step:**

- Run project validation commands immediately
- Fix any lint or type errors before proceeding
- Ensure code follows project patterns and conventions
- Add appropriate error handling and edge case coverage
- Write clear, maintainable code with proper abstractions

### 4. Story File Updates

**CRITICAL: Only update these specific sections of the story file:**

#### 4.1 Authorized Sections for Updates

- Tasks/Subtasks checkboxes (mark with [x] when complete)
- Dev Agent Record section and ALL subsections:
  - Agent Model Used
  - Debug Log References
  - Completion Notes List
  - File List (MUST be kept current)
  - Change Log
- Status field (only when ready for review)

#### 4.2 Prohibited Sections

**DO NOT modify:**

- Story description
- Acceptance Criteria
- Dev Notes (unless adding critical information)
- Testing sections
- Any other sections not explicitly listed above

### 5. Blocking Conditions

**HALT development immediately if:**

#### 5.1 General Blockers

- Unapproved dependencies needed (confirm with user first)
- Ambiguous requirements after checking story and notes
- 3+ consecutive failures attempting same implementation
- Missing critical configuration
- Failing regression tests

#### 5.2 Junior-Specific Blockers

- No implementation plan exists
- Implementation plan incomplete
- Confidence < 80% on technical decision
- 2+ failures attempting same task
- Ambiguous requirement not covered in plan
- Unauthorized API endpoint contract changes not documented in implementation plan

### 6. Completion Criteria

#### 6.1 Ready for Review Checklist

- [ ] All tasks and subtasks marked [x]
- [ ] All acceptance criteria have tests
- [ ] Full test suite passes without errors OR test failures are documented with specific details
- [ ] Project validation commands pass (lint, type-check)
- [ ] File List is complete and accurate
- [ ] No blocking issues remain
- [ ] Test status is honestly disclosed in completion summary (no false claims about "comprehensive testing")

#### 6.2 Final Steps

1. Run the task `execute-checklist` for checklist `story-dod-checklist`
2. Ensure all Definition of Done items are checked
3. **Add accurate completion summary using templates from story-dod-checklist**:
   - If tests pass: Use "comprehensive testing" language
   - If tests fail/bypassed: Use honest disclosure language
4. Set story status to "Ready for Review"
5. For junior developers: Ensure all questions are documented in implementation plan
6. HALT - await review feedback

## Success Criteria

The story development is successful when:

- All acceptance criteria are demonstrably met
- Complete test coverage exists and passes
- Code follows all project standards and patterns
- File List accurately reflects all changes
- No regressions introduced
- Story is ready for comprehensive review

## Notes

- Senior developers should complete most stories in one session
- Junior developers may need multiple iterations with question resolution
- Always prioritize code quality over speed
- When in doubt, ask for clarification rather than assume
- UI consistency is paramount - never skip UI documentation checks for UI stories
