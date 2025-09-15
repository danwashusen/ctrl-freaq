# /review-story-implementation Task

When this command is used, execute the following task:

<!-- Powered by BMAD™ Core -->

# review-story-implementation

Ultra think to perform comprehensive code review of story implementation with
detailed, educational feedback focused on improving junior developer skills and
ensuring code quality standards.

## Inputs

```yaml
required:
  - story_path: 'Path to story file being reviewed'
  - implementation_plan_path: 'Path to {story-filename}-implementation-plan.md'
optional:
  - focus_areas:
      'Specific areas to emphasize in review (e.g., security, performance,
      testing)'
```

## Prerequisites

- Story status must be "Ready for Review"
- Implementation plan file must exist
- File List in story must be complete and non-empty
- All tasks and subtasks should be marked as completed

## Review Process

### 1. Context Loading and Validation

**Load Required Context:**

- Read the story file completely to understand requirements and acceptance
  criteria
- Load the implementation plan to understand the intended approach
- Read all files listed in the story's File List section
- Load all architecture documents to have a clear understanding of the entire
  system

**Interface/UI Documentation Check (Technology-Agnostic):**

If the story involves ANY user interface or client-facing changes (web, mobile,
desktop):

- Read any consolidated UI specs (e.g., `docs/front-end-spec.md`) if present,
  without assuming web-only context
- Read UI/client-related files in `docs/architecture/` (look for: frontend, ui,
  client, web, mobile, ios, android, desktop, electron, view, component, design)
- Review implementation against established UI/client patterns and requirements
- Include UI/client consistency as a key review criterion
- Check for:
  - Proper component/view structure and reusability
  - Consistent styling/appearance approach for the platform
  - Appropriate state management
  - Responsiveness/adaptivity across form factors
  - Accessibility considerations for the target platform

**Validate Review Readiness:**

- Confirm story status is "Ready for Review"
- Verify implementation plan exists and is complete
- Check that File List contains actual modified/created files
- Ensure all tasks/subtasks are marked [x] as completed
- Scan for newly introduced dependencies and verify they are explicitly approved
  in the plan's Dependency Policy
- Verify file and test locations comply with
  `docs/architecture/unified-project-structure.md`; flag any nonconforming paths

**HALT if validation fails** - request developer address issues before review

### 2. Comprehensive Code Analysis

#### A. Implementation Alignment Review

- Compare actual implementation against implementation plan
- Verify all planned components were implemented
- Check if any deviations from plan were appropriate
- Document any gaps between plan and implementation

#### B. Code Quality Assessment

- Code structure and organization
- Naming conventions and clarity
- Function/method size and complexity
- Error handling patterns
- Code duplication identification
- Performance considerations
- Memory usage patterns

#### C. Architecture Compliance

- Adherence to established patterns in codebase
- Proper separation of concerns
- Dependency injection usage
- Interface design appropriateness
- Layer architecture compliance

#### D. Security Review

- Input validation and sanitization
- Authentication and authorization checks
- Data protection measures
- SQL injection prevention
- XSS protection
- CSRF protection where applicable

#### E. Testing Evaluation

- Test coverage adequacy
- Test quality and maintainability
- Edge case coverage
- Integration test appropriateness
- Mock usage effectiveness
- Test data management

#### F. Documentation Assessment

- Code comments quality and necessity
- README updates if needed
- API endpoint documentation completeness
- Inline documentation for complex logic

### 3. Educational Feedback Generation

**Feedback Categories:**

#### 🔴 MUST FIX (Blocking Issues)

- Security vulnerabilities
- Critical bugs or logic errors
- Performance bottlenecks
- Code that breaks existing functionality
- Violations of core architectural principles

#### 🟡 SHOULD IMPROVE (Quality Issues)

- Code clarity and maintainability issues
- Minor performance improvements
- Better error handling approaches
- Improved test coverage
- Code organization improvements

#### 🟢 CONSIDER FOR FUTURE (Learning Opportunities)

- Alternative approaches to consider
- Advanced patterns that could be applied
- Performance optimizations for scale
- Additional testing strategies
- Code refactoring opportunities

#### 💡 POSITIVE REINFORCEMENT

- Well-implemented features
- Good use of patterns
- Effective problem-solving approaches
- Quality improvements over previous work

### 4. Detailed Feedback Format

For each feedback item, provide:

**Problem Description:**

- Clear explanation of the issue or observation
- Why it matters (impact on maintainability, performance, security, etc.)

**Current Code Example:**

```typescript
// Current implementation that needs improvement
const userData = await getUserData(userId);
if (userData) {
  return userData.profile;
}
```

**Improved Code Example:**

```typescript
// Improved implementation with error handling
try {
  const userData = await getUserData(userId);
  if (!userData) {
    throw new NotFoundError(`User ${userId} not found`);
  }
  return userData.profile;
} catch (error) {
  logger.error('Failed to fetch user data', { userId, error });
  throw error;
}
```

**Learning Points:**

- Explanation of why the improvement is better
- General principles that apply beyond this specific case
- References to documentation or best practices

**Priority Level:**

- Must Fix / Should Improve / Consider for Future
- Estimated effort (Low/Medium/High)

### 5. Review Report Generation

Create comprehensive review report with the following sections:

#### 5.1 Executive Summary

- Overall assessment of implementation quality
- Key strengths observed
- Primary areas for improvement
- Recommendation for next steps

#### 5.2 Implementation Plan Compliance

- Adherence to planned approach
- Justified deviations
- Missing components
- Additional work beyond plan

#### 5.3 Code Quality Metrics

- Lines of code reviewed
- Number of files analyzed
- Issues found by category
- Test coverage assessment

#### 5.4 Detailed Findings

- Organized by file and category
- Each finding with examples and explanations
- Priority levels clearly marked
- Learning opportunities highlighted

#### 5.5 Positive Observations

- Well-implemented features
- Good problem-solving approaches
- Improvements from previous work
- Appropriate use of patterns

#### 5.6 Actionable Recommendations

- Specific steps to address Must Fix issues
- Suggestions for Should Improve items
- Learning resources for future development
- Recommended next steps
- Suggested updates to the implementation plan (Risk Register, Plan Amendments,
  Traceability corrections)

### 6. Story Update Process

**Add Dev Review Feedback Section to Story:**

```markdown
## Dev Review Feedback

### Review Date: [YYYY-MM-DD]

### Reviewed By: James (Senior Developer)

### Implementation Plan: [link to plan file]

### Summary Assessment

[2-3 sentence summary of overall implementation quality]

### Must Fix Issues (🔴)

1. **[Issue Title]** - File: `[filename:line]`
   - Problem: [description]
   - Impact: [why it matters]
   - Solution: [specific fix needed]
   - Priority: High

### Should Improve Items (🟡)

[List of quality improvements with examples]

### Future Considerations (🟢)

[Learning opportunities and advanced concepts]

### Positive Highlights (💡)

[Recognition of good work and improvements]

### Files Reviewed

- [List all files from File List with brief assessment]

### Recommended Next Steps

1. Address all Must Fix issues
2. Consider Should Improve items based on priority
3. Implement provided code examples
4. Run full test suite after changes
5. Request re-review when ready

### Learning Resources

- [Links to relevant documentation]
- [Suggested reading for improvement areas]
- [Code examples from the codebase to study]
```

### 7. Interactive Review Process

**Question and Clarification Protocol:**

- When implementation choices are unclear, ask specific questions
- Request explanation of complex logic or unusual approaches
- Clarify requirements if implementation doesn't match story expectations

**Collaborative Problem-Solving:**

- For complex issues, work through solutions together
- Provide multiple approaches when appropriate
- Explain trade-offs between different implementation strategies

### 8. Follow-up Tracking

**Review Completion Checklist:**

- [ ] All files in File List reviewed
- [ ] Implementation plan compliance checked
- [ ] Security review completed
- [ ] Performance assessment done
- [ ] Test coverage evaluated
- [ ] Documentation reviewed
- [ ] Feedback categorized and prioritized
- [ ] Story updated with review section
- [ ] Next steps clearly defined

**Status Recommendations:**

- "Changes Required" - if Must Fix issues exist
- "Minor Improvements Needed" - only Should Improve items
- "Approved with Suggestions" - mostly good with future considerations
- "Excellent Work" - high quality implementation

Block approval if:

- Traceability is broken for any AC
- Unapproved dependencies are introduced
- Significant deviations from the plan lack Plan Amendments and rationale
- File/test locations violate `docs/architecture/unified-project-structure.md`

## Key Principles

- **Educational Focus**: Every piece of feedback should help the developer learn
  and grow
- **Specific Examples**: Always provide concrete code examples, not just
  abstract criticism
- **Balanced Feedback**: Include positive observations alongside areas for
  improvement
- **Actionable Guidance**: Each suggestion should include clear steps for
  implementation
- **Context Awareness**: Consider the developer's experience level and learning
  trajectory
- **Standards Alignment**: Ensure feedback aligns with project coding standards
  and patterns
- **Constructive Tone**: Frame feedback as learning opportunities rather than
  failures

## Blocking Conditions

Stop the review and request clarification if:

- Implementation plan is missing or incomplete
- File List is empty or doesn't match actual changes
- Story requirements are unclear or contradictory
- Code changes appear to break existing functionality
- Security concerns require immediate attention
- Implementation deviates significantly from plan without explanation

## Completion

After review completion:

#### G. Traceability and Dependency Compliance

- Verify AC → test IDs → modules mapping is complete and accurate (Traceability
  Matrix)
- Flag any implemented code or tests that lack traceability to ACs
- Identify any unapproved dependencies introduced (blockers)
- Verify deviations from plan include Plan Amendments with rationale

#### H. Project Structure Compliance

- Validate that all source and test files follow
  `docs/architecture/unified-project-structure.md`
- Check file/folder naming conventions and placement of tests
- Flag generic default structures (e.g., `__tests__`) if not defined in the
  project structure

### 3.a Review Rubric (Technology-Agnostic)

- Architecture compliance and separation of concerns
- Plan compliance and completeness of traceability
- Dependency adherence (no unapproved additions)
- Error handling and failure-path coverage
- Observability (logs/metrics/traces) where applicable
- Security and performance considerations
- Accessibility and responsiveness/adaptivity (for UI/client stories)

1. Update story with comprehensive Dev Review Feedback section
2. Provide clear next steps and priorities
3. Offer to discuss complex issues in detail
4. Schedule follow-up review if needed
5. Recognize good work and improvement efforts
6. Suggest relevant learning resources for continued growth
