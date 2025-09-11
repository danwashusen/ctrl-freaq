# CRTL FreaQ UI/UX Specification

## Introduction
This document defines the user experience goals, information architecture, user flows, and visual design specifications for CRTL FreaQ's user interface. It serves as the foundation for visual design and frontend development, ensuring a cohesive and user-centered experience.

## Overall UX Goals & Principles

### Target User Personas
- Power User: Senior/Staff+ engineers driving architecture and implementation; needs speed, control, and precision with minimal ceremony.
- Tech Lead: Responsible for alignment and quality; needs traceability, quality gates, and authoritative sources.
- Occasional Contributor: Contributes to docs or small changes; needs clear guidance and low cognitive load.

### Usability Goals
- Efficiency of use: Power users complete frequent actions with minimal clicks and keyboard-friendly flows.
- Clear validation and approvals: Destructive/structural changes require preview and confirmation; diffs are clear.
- Learnability: New contributors can author or update a section within 5 minutes.
- Error prevention: Guardrails for schema violations; inline guidance prevents invalid states.
- Memorability: Occasional users can return and be productive without relearning.

### Design Principles
- Clarity over cleverness — Prioritize unambiguous language, labels, and actions.
- Progressive disclosure — Show only what’s needed per section/state; reveal advanced options on demand.
- Consistent patterns — Uniform stepper, status chips (draft/ready), and approval/diff UI throughout.
- Immediate feedback — Each action returns a clear result (saved, proposed, error) with rationale.
- Accessible by default — Keyboard-first flows, visible focus, adequate contrast, and ARIA-friendly components.

### Form Factor Priority
- Desktop-first: Optimize layouts and interactions primarily for desktop and large displays.
- High-end tablets: Support a two-column experience with minimal compromises.
- Low-end tablets and phones: Provide functional, simplified fallbacks; perfect parity is not required.
- Design decisions, spacing, and density are anchored to desktop; smaller viewports gracefully degrade.

## Change Log
| Date       | Version | Description                          | Author |
|------------|---------|--------------------------------------|--------|
| 2025-09-09 | 0.1     | Added UX Goals & Principles section  | UX     |

## Information Architecture (IA)

### Site Map / Screen Inventory

```mermaid
graph TD
    A[Home] --> B[Dashboard]
    B --> C[Document Creation Flow]
    B --> D[Documents]
    B --> E[Knowledge]
    B --> F[MCP Explorer]
    B --> G[Settings]

    C --> C1[New Architecture]
    C --> C2[Open Architecture]
    C2 --> C3[Authoring Wizard]
    C3 --> C4[Resolve Assumptions]
    C3 --> C5[Section Chat (Read/Propose)]
    C5 --> C6[Diff & Approval]
    C6 --> C7[Export & Versioning]

    D --> D1[List of Docs]
    D1 --> D2[Doc Detail]
    D2 --> D3[Sections]
    D2 --> D4[Changelog]
    D2 --> D5[QA Chat]

    E --> E1[Standards]
    E --> E2[Patterns]
    E --> E3[Decisions]

    F --> F1[Query Console]
    F1 --> F2[Response + Citations]

    G --> G1[Profile]
    G --> G2[API Keys]
    G --> G3[Preferences]
```

### Navigation Structure

**Primary Navigation:** Top nav with Dashboard, Architecture, Documents, Knowledge, MCP, Settings.

**Secondary Navigation:** Contextual tabs within a section (e.g., in Doc Detail: Sections | Changelog | QA Chat).

**Breadcrumb Strategy:** Dashboard > Area > Item > Subsection; always show current section state (Draft/Ready).

## User Flows

### Architecture Authoring Wizard

**User Goal:** Create or update an AI-optimized Architecture document with guardrails and explicit approvals.

**Entry Points:** New Architecture; Open Architecture → Authoring Wizard.

**Success Criteria:** All required sections reach Ready; diffs reviewed; export/version updated.

#### Flow Diagram

```mermaid
graph TD
  A[Start] --> B{New or Existing?}
  B -- New --> C[Create Draft]
  B -- Existing --> D[Open Draft]
  C --> E[Resolve Assumptions]
  D --> E[Resolve Assumptions]
  E --> F[Section Chat (Explain/Outline/Suggest)]
  F --> G[Proposed Edits]
  G --> H[Diff Preview]
  H -- Approve --> I[Apply Changes + Changelog]
  H -- Decline --> F
  I --> J[Validation & Status Update]
  J -- Blockers --> F
  J -- Ready --> K{More Sections?}
  K -- Yes --> E
  K -- No --> L[Export & Versioning]
  L --> M[Done]
```

#### Edge Cases & Error Handling
- Validation failures block “Ready”; show inline guidance and quick-fix hints.
- Conflicting edits detected; show conflict warning with last-save timestamp.
- Export is idempotent; if no diff, show “No changes to export”.

#### Notes
- Diff previews show insertions/deletions and rationale summaries from proposals.
- Traceability matrix updates on approve; citations captured for applied changes.

#### Flow Step References
Define linkable anchors for key steps referenced by components and other sections.

- <a id="flow-create-draft"></a>Create/Open Draft — Initial draft creation or loading an existing draft.
- <a id="flow-resolve-assumptions"></a>Resolve Assumptions — Review, clarify, or confirm assumptions.
- <a id="flow-section-chat"></a>Section Chat — Explain, outline, and propose edits with citations.
- <a id="flow-proposed-edits"></a>Proposed Edits — Collect model proposals for review.
- <a id="flow-diff-preview"></a>Diff Preview — Inspect changes prior to approval.
- <a id="flow-apply-changes"></a>Apply Changes + Changelog — Approve/decline and persist updates with rationale.
- <a id="flow-validation-status"></a>Validation & Status Update — Run validations and update section status.
- <a id="flow-export-versioning"></a>Export & Versioning — Export artifact and bump version if applicable.

## Wireframes & Mockups

**Primary Design Files:** <add Figma project/frames>

### Key Screen Layouts

#### Authoring Wizard
**Purpose:** Guide users through creating/updating an Architecture doc with assumption resolution, section chat, and gated approvals.

**Key Elements:**
- Stepper with section statuses (Draft/Ready/Blocked)
- Section content editor with schema-aware fields
- "Resolve Assumptions" panel (status icons — Lucide: CheckCircle, HelpCircle, XCircle; per-assumption Q&A)
- Section Chat (Explain/Outline/Suggest) with citations
- Proposal Diff Viewer with Approve/Decline actions
- Validation messages and quick fixes
- Changelog snippet on apply

**Interaction Notes:** Keyboard-first navigation (Tab/Shift+Tab/Enter), Cmd/Ctrl+K command palette for actions; approvals require explicit confirmation.

**Design File Reference:** <add specific Figma frame link>

## Component Library / Design System

**Design System Approach:** Start with Skeleton UI + Tailwind on SvelteKit; apply Skeleton theme "concord" (use `data-theme="concord"` at the app root); extend with product‑specific components as needed.

Tooling Versions
- SvelteKit: 2.37.x
- Svelte: 5.3x
- Tailwind CSS: 4.1.x
- Lucide: 0.543.0
- @skeletonlabs/skeleton: 3.2.0
- @skeletonlabs/skeleton-svelte: 1.5.1

### Core Components

#### Stepper
**Purpose:** Indicate section progress and status (Draft/Ready/Blocked)

**Variants:** Horizontal, vertical; compact vs. detailed

**States:** default, active, completed, blocked

**Usage Guidelines:** Keep labels concise; avoid more than 7 steps on one screen

**Used In:** [Authoring Wizard](#authoring-wizard) across steps; prominently during [Resolve Assumptions](#flow-resolve-assumptions), [Section Chat](#flow-section-chat), [Diff Preview](#flow-diff-preview), and [Validation & Status Update](#flow-validation-status).

#### Status Chip
**Purpose:** Communicate per‑section status succinctly

**Variants:** draft, ready, blocked

**States:** default, hover, focus, disabled

**Usage Guidelines:** Pair with tooltip for criteria; use color+icon with sufficient contrast

**Used In:** Stepper labels and section headers during [Validation & Status Update](#flow-validation-status); breadcrumbs and lists in [Create/Open Draft](#flow-create-draft) and [Export & Versioning](#flow-export-versioning) summaries.

#### Assumption Tag
**Purpose:** Show assumption status inline using Lucide icons

**Variants:** confirmed, unclear, unanswered

**States:** default, hover, focus

**Icon Mapping:**
- confirmed → CheckCircle
- unclear → HelpCircle
- unanswered → XCircle

**Usage Guidelines:** Use consistent Lucide iconography; provide click target to open Q&A; include aria-labels for screen readers; ensure contrast meets a11y standards.

**Used In:** Assumptions panel in [Resolve Assumptions](#flow-resolve-assumptions) and inline references within [Section Chat](#flow-section-chat).

#### Chat Panel
**Purpose:** Section‑scoped chat for explain/outline/suggest and proposals

**Variants:** read‑only, propose‑edit

**States:** idle, streaming, error

**Usage Guidelines:** Always show scope context; surface citations with anchors

**Used In:** [Section Chat](#flow-section-chat) to generate [Proposed Edits](#flow-proposed-edits); also referenced from blockers in [Validation & Status Update](#flow-validation-status).

#### Diff Viewer
**Purpose:** Present proposed edits with insertions/deletions

**Variants:** side‑by‑side, inline

**States:** pending review, approved, declined

**Usage Guidelines:** Highlight rationale; require explicit Approve/Decline

**Used In:** [Diff Preview](#flow-diff-preview) before [Apply Changes + Changelog](#flow-apply-changes).

#### Validation Alert
**Purpose:** Summarize blockers and guidance

**Variants:** error, warning, info, success

**States:** dismissible, persistent

**Usage Guidelines:** Link to offending fields; keep messages actionable

**Used In:** [Validation & Status Update](#flow-validation-status); shown when blockers detected in the loop back to [Section Chat](#flow-section-chat).

#### Command Palette
**Purpose:** Quick access to actions (approve, propose, export)

**Variants:** global, section‑scoped

**States:** open, filtered, no‑results

**Usage Guidelines:** Keyboard‑first; show shortcuts

**Used In:** Global and section‑scoped actions throughout the [Authoring Wizard](#authoring-wizard), including triggers for [Proposed Edits](#flow-proposed-edits), [Approve/Decline](#flow-apply-changes), and [Export & Versioning](#flow-export-versioning).

## Skeleton Component Catalog (LLM‑Ready)

Purpose: Provide a concise, structured catalog of Skeleton UI components (Svelte + Tailwind) to help an LLM choose the right component, variants, and accessibility considerations. Prefer the Skeleton "concord" theme tokens and Lucide icons.

Legend for fields
- Category: Navigation | Forms | Data Display | Feedback | Overlays | Utility
- Variants: Key style/behavior modes exposed by the component
- Use when: Triggers for selection
- Avoid when: Anti‑patterns or better alternatives
- A11y: Accessibility notes and requirements
- Compose with: Related components commonly used together

Components

- Name: Button
  - Category: Forms
  - Purpose: Primary interactive action element.
  - Variants: solid | outline | ghost; sizes sm|md|lg; intent primary|secondary|success|warning|error; with icon-only.
  - Use when: Triggering actions (submit, open modal, run gates).
  - Avoid when: Simple navigation (prefer Link) or toggles (Switch).
  - A11y: Provide discernible text; ensure focus ring visible; icon‑only requires aria‑label.
  - Compose with: ButtonGroup, Tooltip, Icon (Lucide).
  - Used In: [Section Chat](#flow-section-chat) (Send/Regenerate), [Diff Preview](#flow-diff-preview) (Approve/Decline), [Apply Changes](#flow-apply-changes) (Confirm), [Export & Versioning](#flow-export-versioning) (Export trigger).

- Name: ButtonGroup
  - Category: Forms
  - Purpose: Group related actions.
  - Variants: segmented | toolbar; orientation horizontal|vertical.
  - Use when: Mutually exclusive view modes (segmented) or clustered actions.
  - Avoid when: Requires selection state persistence (use Tabs or Segmented Control pattern).
  - A11y: Use aria‑label for group; roving tabindex for keyboard.
  - Compose with: Button, Tooltip.
  - Used In: Action clusters in [Diff Preview](#flow-diff-preview) and [Export & Versioning](#flow-export-versioning) toolbars.

- Name: Input
  - Category: Forms
  - Purpose: Single‑line text entry.
  - Variants: text | email | password | number | search; sizes; with leading/trailing icons.
  - Use when: Freeform text or small values.
  - Avoid when: Enumerations (Select) or long text (Textarea).
  - A11y: Label + aria‑describedby for help/error; clear error messaging.
  - Compose with: FormField wrapper, ValidationAlert.
  - Used In: Content editor fields in [Create/Open Draft](#flow-create-draft) and filtering in lists prior to [Export & Versioning](#flow-export-versioning).

- Name: Textarea
  - Category: Forms
  - Purpose: Multi‑line text input.
  - Variants: resizable | auto‑grow.
  - Use when: Notes, rationale, long descriptions.
  - Avoid when: One‑line data; use Input.
  - A11y: Label + describedby; maintain readable line length.
  - Compose with: Character counter, ValidationAlert.
  - Used In: Prompt entry in [Section Chat](#flow-section-chat) and rationale input during [Apply Changes + Changelog](#flow-apply-changes).

- Name: Select
  - Category: Forms
  - Purpose: Choose one from a list.
  - Variants: native | custom; with icons/avatars; size sm|md|lg.
  - Use when: Known bounded options.
  - Avoid when: Large/filtered sets (consider Combobox pattern).
  - A11y: Ensure proper labeling; keyboard navigation; announce selection changes.
  - Compose with: Helper text, Tooltip.
  - Used In: Scope/model selection in [Section Chat](#flow-section-chat); export format selection in [Export & Versioning](#flow-export-versioning).

- Name: Checkbox
  - Category: Forms
  - Purpose: Toggle independent boolean(s).
  - Variants: single | group; with description.
  - Use when: Multiple selections allowed; settings.
  - Avoid when: Single on/off (prefer Switch).
  - A11y: Click target includes label; indicate indeterminate state when applicable.
  - Compose with: Fieldset/Legend, Helper text.
  - Used In: Option toggles in [Resolve Assumptions](#flow-resolve-assumptions) and export options in [Export & Versioning](#flow-export-versioning).

- Name: Radio
  - Category: Forms
  - Purpose: Single selection among options.
  - Variants: stacked | inline; with descriptions.
  - Use when: Mutually exclusive choices with clear labels.
  - Avoid when: Many options or search (use Select/Combobox pattern).
  - A11y: Group with fieldset + legend; arrow‑key navigation.
  - Compose with: Cards for visual radios (optional).
  - Used In: Choosing proposal strategies in [Section Chat](#flow-section-chat) (Explain/Outline/Suggest modes when not using Tabs).

- Name: Switch
  - Category: Forms
  - Purpose: Instant on/off state.
  - Variants: sizes; with left/right labels.
  - Use when: Immediate settings (e.g., Reduced Motion).
  - Avoid when: Requires confirmation; use Button + Dialog.
  - A11y: Reflect state with aria‑checked; visible focus.
  - Compose with: Helper text.
  - Used In: Preferences toggles (e.g., reduced motion) available globally during the [Authoring Wizard](#authoring-wizard).

- Name: Range / Slider
  - Category: Forms
  - Purpose: Select numeric values within a range.
  - Variants: single‑thumb; step; min/max labels.
  - Use when: Tunable numerical preference.
  - Avoid when: Precise entry (use Input number).
  - A11y: Keyboard increments; announce value; sufficient hit area.
  - Compose with: Value display, Tooltip.
  - Used In: Tuning thresholds for validations in [Validation & Status Update](#flow-validation-status) when exposed.

- Name: Card
  - Category: Data Display
  - Purpose: Group related content and actions.
  - Variants: outlined | elevated; header/footer; media.
  - Use when: Dash tiles, document summaries.
  - Avoid when: Dense tabular data (use Table).
  - A11y: Semantic headings; readable contrast; avoid purely decorative content.
  - Compose with: Button, Chip, Avatar.
  - Used In: Presenting [Proposed Edits](#flow-proposed-edits) and changelog entries after [Apply Changes](#flow-apply-changes).

- Name: Table
  - Category: Data Display
  - Purpose: Display structured data.
  - Variants: striped | compact; sticky header; sortable; pagination.
  - Use when: Comparing rows/columns; lists of docs/knowledge.
  - Avoid when: On small screens with many columns (consider Cards or responsive table patterns).
  - A11y: Proper <table>/<th>/<td>; scope on headers; caption; keyboard focus for controls.
  - Compose with: Pagination, Toolbar.
  - Used In: Document lists in [Create/Open Draft](#flow-create-draft) and detailed changelog/history after [Apply Changes](#flow-apply-changes).

- Name: Chip / Badge
  - Category: Data Display
  - Purpose: Small status/metadata label.
  - Variants: filled | outline; color intents; with icon.
  - Use when: Status, tags, counts.
  - Avoid when: Actionable toggles (use Button) or filters (use Checkbox/Segmented).
  - A11y: Sufficient contrast; if interactive, treat as button with role/action.
  - Compose with: Tooltip.
  - Used In: Status indicators alongside Stepper during [Validation & Status Update](#flow-validation-status) and proposal tags in [Proposed Edits](#flow-proposed-edits).

- Name: Avatar
  - Category: Data Display
  - Purpose: User/entity representation.
  - Variants: sizes; fallback initials; with presence dot.
  - Use when: User menu, lists.
  - Avoid when: Anonymous contexts; prefer generic icon.
  - A11y: alt text for images; aria‑label when used as a button.
  - Compose with: Dropdown for account menu.
  - Used In: Message authorship in [Section Chat](#flow-section-chat) and user menus accessible throughout the [Authoring Wizard](#authoring-wizard).

- Name: Divider
  - Category: Utility
  - Purpose: Visual separation between regions.
  - Variants: horizontal | vertical; inset.
  - Use when: Grouping within Cards/Drawers.
  - Avoid when: Excessive separators; use whitespace.
  - A11y: Decorative; ensure not read as content.
  - Compose with: Lists, Menus.
  - Used In: Separating editor/chat/diff regions in [Section Chat](#flow-section-chat) and [Diff Preview](#flow-diff-preview).

- Name: Tabs
  - Category: Navigation
  - Purpose: Switch between views within a page.
  - Variants: underline | pill; with icons; vertical.
  - Use when: Related content fits one surface with clear categories (e.g., Explain | Outline | Propose).
  - Avoid when: Steps with ordering/dependencies (use Stepper pattern).
  - A11y: roving tabindex; aria‑controls; arrow keys; active indicator.
  - Compose with: Panels mapped by id.
  - Used In: Mode switching within [Section Chat](#flow-section-chat) (Explain | Outline | Propose) and responsive adaptation of panels across the [Authoring Wizard](#authoring-wizard).

- Name: Breadcrumbs
  - Category: Navigation
  - Purpose: Show hierarchical location and provide quick navigation.
  - Variants: with truncation; icon separators.
  - Use when: Deep nested routes (Dashboard > Area > Item > Subsection).
  - Avoid when: Flat IA; redundant with tabs.
  - A11y: Use nav with aria‑label="breadcrumb"; list semantics.
  - Compose with: TopNav.
  - Used In: Context display in [Create/Open Draft](#flow-create-draft) through [Export & Versioning](#flow-export-versioning) to maintain orientation.

- Name: Dropdown / Menu
  - Category: Navigation
  - Purpose: Contextual action or selection menu.
  - Variants: menu button; right/left alignment; with sections/dividers.
  - Use when: Secondary actions; account menus.
  - Avoid when: Primary actions; show as Buttons instead.
  - A11y: Button with aria‑expanded/controls; focus trap inside; escape to close.
  - Compose with: Avatar, Button, List items.
  - Used In: Overflow actions in [Diff Preview](#flow-diff-preview) and export options in [Export & Versioning](#flow-export-versioning).

- Name: Drawer
  - Category: Overlays
  - Purpose: Slide‑in panel for secondary tasks.
  - Variants: left | right | bottom; modal vs non‑modal.
  - Use when: Triage, filters, quick details without leaving workflow.
  - Avoid when: Destructive/confidential actions (prefer Dialog).
  - A11y: Trap focus; aria‑modal; close on escape; maintain return focus.
  - Compose with: Forms, Lists.
  - Used In: Mobile layout to house [Resolve Assumptions](#flow-resolve-assumptions) or [Section Chat](#flow-section-chat) panels within the [Authoring Wizard](#authoring-wizard).

- Name: Dialog / Modal
  - Category: Overlays
  - Purpose: Critical confirmations or focused tasks.
  - Variants: alert | confirm | form; sizes.
  - Use when: Approvals (diff apply), destructive actions.
  - Avoid when: Inline editing is sufficient.
  - A11y: aria‑modal, labelledby/describedby; focus management; escape/overlay click behavior.
  - Compose with: Buttons, Forms.
  - Used In: Confirmation during [Apply Changes + Changelog](#flow-apply-changes) and destructive/export confirmations in [Export & Versioning](#flow-export-versioning).

- Name: Tooltip
  - Category: Feedback
  - Purpose: Contextual hints on hover/focus.
  - Variants: positions; with arrows; delay.
  - Use when: Explain icons or compact controls.
  - Avoid when: Critical information; must be accessible without hover.
  - A11y: Trigger must be focusable; content announced on focus.
  - Compose with: Icon buttons, Chips.
  - Used In: Explain icons/actions throughout [Diff Preview](#flow-diff-preview), [Validation & Status Update](#flow-validation-status), and [Export & Versioning](#flow-export-versioning).

- Name: Toast / Notification
  - Category: Feedback
  - Purpose: Transient messages.
  - Variants: success | info | warning | error; auto‑dismiss; action button.
  - Use when: Save success, export complete, proposal applied.
  - Avoid when: Critical blocking (use Dialog) or long content.
  - A11y: aria‑live="polite"; avoid stealing focus; ensure dismissibility.
  - Compose with: Action callbacks.
  - Used In: Success/error feedback after [Apply Changes](#flow-apply-changes), completion of [Export & Versioning](#flow-export-versioning), and proposal generation in [Proposed Edits](#flow-proposed-edits).

- Name: Progress
  - Category: Feedback
  - Purpose: Indicate ongoing operations.
  - Variants: linear | indeterminate; sizes.
  - Use when: Export, running gates, chat streaming (or use skeleton loaders).
  - Avoid when: Instant operations.
  - A11y: aria‑valuenow/min/max; text description.
  - Compose with: Buttons, Panels.
  - Used In: Streaming indicators in [Section Chat](#flow-section-chat), applying changes in [Apply Changes](#flow-apply-changes), and during [Export & Versioning](#flow-export-versioning).

- Name: Skeleton Loader
  - Category: Feedback
  - Purpose: Placeholder shimmer for loading content.
  - Variants: line | block | avatar | card.
  - Use when: Anticipating layout but data pending.
  - Avoid when: Very fast loads; reduces perceived jank only if delay exists.
  - A11y: Mark as aria‑hidden; avoid reading placeholders.
  - Compose with: Cards, Lists.
  - Used In: Loading states for [Section Chat](#flow-section-chat) and [Diff Preview](#flow-diff-preview) panels while data hydrates.

- Name: Pagination
  - Category: Navigation
  - Purpose: Navigate large lists or tables.
  - Variants: numbered | previous/next; compact.
  - Use when: Tables or knowledge lists exceed single view.
  - Avoid when: Infinite scroll preferred.
  - A11y: aria‑current on active page; sufficient focus targets.
  - Compose with: Table, List.
  - Used In: Large document lists during [Create/Open Draft](#flow-create-draft) and changelog history after [Apply Changes](#flow-apply-changes).

- Name: Kbd (Keyboard Hint)
  - Category: Utility
  - Purpose: Display keyboard shortcuts.
  - Variants: inline | block.
  - Use when: Command Palette, power‑user hints.
  - Avoid when: Non‑interactive decorative usage.
  - A11y: Ensure tooltip or help also explains action for non‑keyboard users.
  - Compose with: CommandPalette, Toolbars.
  - Used In: Shortcut hints for actions in [Section Chat](#flow-section-chat), [Diff Preview](#flow-diff-preview), and [Export & Versioning](#flow-export-versioning) across the [Authoring Wizard](#authoring-wizard).

- Name: Accordion / Collapse
  - Category: Utility
  - Purpose: Toggle visibility of dense content.
  - Variants: single | multiple; bordered.
  - Use when: FAQs, long side panels, assumptions detail.
  - Avoid when: Navigation across views (use Tabs).
  - A11y: header is a button; aria‑controls; arrow keys support.
  - Compose with: Lists, Forms.
  - Used In: Detailing assumption Q&A in [Resolve Assumptions](#flow-resolve-assumptions) and grouping rationale in [Diff Preview](#flow-diff-preview).

- Name: Toolbar
  - Category: Utility
  - Purpose: Cluster actions and filters at the top of a view.
  - Variants: dense | spacious; with divider.
  - Use when: Table/List pages; authoring actions.
  - Avoid when: Single primary action; use a Button.
  - A11y: role="toolbar" + aria‑label; tab order predictable.
  - Compose with: ButtonGroup, Input (search), Select (filters).
  - Used In: Top action rows in [Diff Preview](#flow-diff-preview), [Validation & Status Update](#flow-validation-status), and [Export & Versioning](#flow-export-versioning).

Notes
- Stepper pattern: Not a dedicated Skeleton core component; compose using Tabs/Chips/Progress and layout primitives as specified earlier.
- Icons: Use Lucide exclusively; see Iconography section for mappings (e.g., CheckCircle/HelpCircle/XCircle for assumption states).

## Lucide Icon Catalog (LLM‑Ready)

Purpose: Provide a concise, task‑oriented catalog of Lucide icons to ensure consistent, accessible iconography across CRTL FreaQ. This catalog uses Lucide’s canonical kebab‑case names (as listed on lucide.dev) and maps them to our flows and states.

Usage Conventions
- Library: `lucide-svelte` (SvelteKit). Import PascalCase components or use dynamic icon by name.
- Sizes: 16/20/24 px; default stroke width 2.0; align to 24px grid where possible.
- A11y: Decorative icons use `aria-hidden="true"`; icon‑only buttons require `aria-label` describing the action.
- Color: Use Skeleton "concord" tokens; avoid hardcoded hex. Example: success `var(--color-success-600)`.

Status & Feedback
- success: `check-circle`
- error: `x-circle`
- info: `info`
- warning: `alert-triangle`
- pending: `clock`
- in-progress/working: `loader`
- paused: `pause-circle`
- started/play: `play-circle`

Primary Actions
- add/create: `plus`
- remove: `minus`
- edit: `edit-3`
- save: `save`
- delete: `trash-2`
- copy: `copy`
- move: `move`
- refresh/retry: `refresh-ccw`
- undo: `rotate-ccw`
- redo: `rotate-cw`
- download/export: `download`
- upload/import: `upload`
- share: `share`
- link: `link`
- external link: `external-link`
- settings/preferences: `sliders` or `settings`
- AI/magic: `wand-2`

Navigation & Structure
- home: `home`
- previous/next: `arrow-left`, `arrow-right`
- up/down: `arrow-up`, `arrow-down`
- collapse/expand: `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down`
- jump: `chevrons-left`, `chevrons-right`
- menu/overflow: `menu`, `more-vertical`, `more-horizontal`

Communication & Chat
- chat/message: `message-square`
- conversation: `message-circle`
- mention/email: `at-sign`, `mail`
- bot/assistant: `bot`

Content / Editor
- bold/italic/underline/strike: `bold`, `italic`, `underline`, `strikethrough`
- lists: `list`, `list-ordered`
- code: `code`, `code-2`
- quote: `quote`
- image: `image`
- table: `table`

Files & Documents
- file types: `file`, `file-text`, `file-code`
- file actions: `file-plus`, `file-x`
- folders: `folder`, `folder-open`
- tagging: `tag`, `tags`

Git / Diff / Change
- branch: `git-branch`
- commit: `git-commit`
- merge: `git-merge`
- compare: `git-compare`
- pull request: `git-pull-request`

Validation & Privacy
- secure: `lock`
- unlocked: `unlock`
- allowed: `shield-check`
- risk/alert: `shield-alert`
- block: `ban`
- view/hide: `eye`, `eye-off`

Time & History
- calendar: `calendar`
- time: `clock`
- timer: `timer`
- history: `history`

Users & Identity
- user: `user`
- users: `users`
- add/remove: `user-plus`, `user-minus`

Miscellaneous
- favorite/star: `star`
- like: `heart`
- pin/unpin: `pin`, `pin-off`
- search: `search`
- filter: `filter`
- sparkle: `sparkles`

Mappings to CRTL FreaQ Flows
- Assumptions: confirmed → `check-circle`, unclear → `help-circle`, unanswered → `x-circle` (used in [Resolve Assumptions](#flow-resolve-assumptions)).
- Proposals: propose/edit → `wand-2` (action), chat → `message-square` (in [Section Chat](#flow-section-chat)).
- Diff Review: approve → `check-circle`, decline → `x-circle`, rationale/info → `info` (in [Diff Preview](#flow-diff-preview)).
- Apply Changes: applying → `loader`, success → `check-circle`, error → `x-circle` (in [Apply Changes + Changelog](#flow-apply-changes)).
- Validation: error → `alert-triangle`, warning → `alert-triangle`, info → `info`, success → `check-circle` (in [Validation & Status Update](#flow-validation-status)).
- Export/Versioning: export → `download`, share → `share`, tag/version → `tag` (in [Export & Versioning](#flow-export-versioning)).

Implementation Notes
- Import examples (Svelte): `import { CheckCircle, Wand2, Download } from 'lucide-svelte';`
- Dynamic component by name: map kebab‑case to components for LLM usage; keep a typed registry to avoid typos.
- Do not mix icon sets; maintain consistent stroke and alignment.

## Branding & Style Guide

### Visual Identity
**Brand Guidelines:** <add link or location if available>

### Theme: Skeleton "concord"

Adopt the Skeleton theme "concord". Apply these CSS variables by setting `data-theme="concord"` on the root element. Do not mix additional theme tokens unless explicitly approved.

```css
[data-theme='concord'] {
	--text-scaling: 1.067;
	--base-font-color: var(--color-surface-950);
	--base-font-color-dark: var(--color-surface-50);
	--base-font-family: system-ui, sans-serif;
	--base-font-size: inherit;
	--base-line-height: inherit;
	--base-font-weight: normal;
	--base-font-style: normal;
	--base-letter-spacing: 0em;
	--heading-font-color: inherit;
	--heading-font-color-dark: inherit;
	--heading-font-family: Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif;
	--heading-font-weight: bold;
	--heading-font-style: normal;
	--heading-letter-spacing: 0.025em;
	--anchor-font-color: var(--color-tertiary-600);
	--anchor-font-color-dark: var(--color-tertiary-500);
	--anchor-font-family: inherit;
	--anchor-font-size: inherit;
	--anchor-line-height: inherit;
	--anchor-font-weight: inherit;
	--anchor-font-style: inherit;
	--anchor-letter-spacing: inherit;
	--anchor-text-decoration: none;
	--anchor-text-decoration-hover: underline;
	--anchor-text-decoration-active: none;
	--anchor-text-decoration-focus: none;
	--spacing: 0.25rem;
	--radius-base: 0.375rem;
	--radius-container: 0.75rem;
	--default-border-width: 1px;
	--default-divide-width: 1px;
	--default-ring-width: 1px;
	--body-background-color: oklch(1 0 0 / 1);
	--body-background-color-dark: var(--color-surface-900);
	--color-primary-50: oklch(93.95% 0.03 275.18deg);
	--color-primary-100: oklch(86.5% 0.06 279.15deg);
	--color-primary-200: oklch(79.21% 0.1 278.8deg);
	--color-primary-300: oklch(71.75% 0.14 277.75deg);
	--color-primary-400: oklch(64.67% 0.17 276.05deg);
	--color-primary-500: oklch(57.82% 0.21 273.83deg);
	--color-primary-600: oklch(54.35% 0.21 273.38deg);
	--color-primary-700: oklch(50.88% 0.21 272.81deg);
	--color-primary-800: oklch(47.4% 0.21 272.5deg);
	--color-primary-900: oklch(43.97% 0.21 271.59deg);
	--color-primary-950: oklch(40.59% 0.21 270.47deg);
	--color-primary-contrast-dark: var(--color-primary-950);
	--color-primary-contrast-light: var(--color-primary-50);
	--color-primary-contrast-50: var(--color-primary-contrast-dark);
	--color-primary-contrast-100: var(--color-primary-contrast-dark);
	--color-primary-contrast-200: var(--color-primary-contrast-dark);
	--color-primary-contrast-300: var(--color-primary-contrast-dark);
	--color-primary-contrast-400: var(--color-primary-contrast-dark);
	--color-primary-contrast-500: var(--color-primary-contrast-light);
	--color-primary-contrast-600: var(--color-primary-contrast-light);
	--color-primary-contrast-700: var(--color-primary-contrast-light);
	--color-primary-contrast-800: var(--color-primary-contrast-light);
	--color-primary-contrast-900: var(--color-primary-contrast-light);
	--color-primary-contrast-950: var(--color-primary-contrast-light);
	--color-secondary-50: oklch(90.16% 0.09 326.33deg);
	--color-secondary-100: oklch(84.48% 0.12 333.85deg);
	--color-secondary-200: oklch(78.99% 0.14 339.7deg);
	--color-secondary-300: oklch(74.01% 0.17 344.23deg);
	--color-secondary-400: oklch(69.33% 0.2 348.34deg);
	--color-secondary-500: oklch(65.32% 0.22 351.98deg);
	--color-secondary-600: oklch(59.53% 0.2 351.92deg);
	--color-secondary-700: oklch(53.6% 0.17 351.21deg);
	--color-secondary-800: oklch(47.56% 0.14 351.06deg);
	--color-secondary-900: oklch(41.41% 0.11 349.93deg);
	--color-secondary-950: oklch(35.13% 0.08 349.66deg);
	--color-secondary-contrast-dark: oklch(0% 0 none);
	--color-secondary-contrast-light: oklch(100% 0 none);
	--color-secondary-contrast-50: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-100: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-200: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-300: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-400: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-500: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-600: var(--color-secondary-contrast-dark);
	--color-secondary-contrast-700: var(--color-secondary-contrast-light);
	--color-secondary-contrast-800: var(--color-secondary-contrast-light);
	--color-secondary-contrast-900: var(--color-secondary-contrast-light);
	--color-secondary-contrast-950: var(--color-secondary-contrast-light);
	--color-tertiary-50: oklch(91.18% 0.04 241.37deg);
	--color-tertiary-100: oklch(86.71% 0.06 242.76deg);
	--color-tertiary-200: oklch(82.12% 0.09 244.81deg);
	--color-tertiary-300: oklch(77.83% 0.11 245.07deg);
	--color-tertiary-400: oklch(73.51% 0.13 246.76deg);
	--color-tertiary-500: oklch(69.63% 0.15 248.03deg);
	--color-tertiary-600: oklch(64.72% 0.14 248.98deg);
	--color-tertiary-700: oklch(59.49% 0.14 250.59deg);
	--color-tertiary-800: oklch(54.48% 0.13 252.33deg);
	--color-tertiary-900: oklch(49.02% 0.13 254.3deg);
	--color-tertiary-950: oklch(43.67% 0.12 255.89deg);
	--color-tertiary-contrast-dark: oklch(0% 0 none);
	--color-tertiary-contrast-light: var(--color-tertiary-50);
	--color-tertiary-contrast-50: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-100: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-200: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-300: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-400: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-500: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-600: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-700: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-800: var(--color-tertiary-contrast-dark);
	--color-tertiary-contrast-900: var(--color-tertiary-contrast-light);
	--color-tertiary-contrast-950: var(--color-tertiary-contrast-light);
	--color-success-50: oklch(97.86% 0.03 165.27deg);
	--color-success-100: oklch(94.75% 0.07 158.14deg);
	--color-success-200: oklch(92.04% 0.1 155.45deg);
	--color-success-300: oklch(89.46% 0.14 153.85deg);
	--color-success-400: oklch(87.35% 0.17 152.06deg);
	--color-success-500: oklch(85.35% 0.2 150.31deg);
	--color-success-600: oklch(78.3% 0.19 149.17deg);
	--color-success-700: oklch(71.13% 0.19 147.68deg);
	--color-success-800: oklch(63.55% 0.18 146.43deg);
	--color-success-900: oklch(56.11% 0.17 144.85deg);
	--color-success-950: oklch(48.5% 0.16 143.68deg);
	--color-success-contrast-dark: oklch(0% 0 none);
	--color-success-contrast-light: var(--color-success-50);
	--color-success-contrast-50: var(--color-success-contrast-dark);
	--color-success-contrast-100: var(--color-success-contrast-dark);
	--color-success-contrast-200: var(--color-success-contrast-dark);
	--color-success-contrast-300: var(--color-success-contrast-dark);
	--color-success-contrast-400: var(--color-success-contrast-dark);
	--color-success-contrast-500: var(--color-success-contrast-dark);
	--color-success-contrast-600: var(--color-success-contrast-dark);
	--color-success-contrast-700: var(--color-success-contrast-dark);
	--color-success-contrast-800: var(--color-success-contrast-dark);
	--color-success-contrast-900: var(--color-success-contrast-dark);
	--color-success-contrast-950: var(--color-success-contrast-light);
	--color-warning-50: oklch(97.1% 0.06 99.18deg);
	--color-warning-100: oklch(96.05% 0.08 99.78deg);
	--color-warning-200: oklch(95.06% 0.11 100.04deg);
	--color-warning-300: oklch(93.84% 0.13 100.18deg);
	--color-warning-400: oklch(92.97% 0.14 100.18deg);
	--color-warning-500: oklch(92.15% 0.16 100.08deg);
	--color-warning-600: oklch(85.58% 0.15 99.65deg);
	--color-warning-700: oklch(78.91% 0.15 99.06deg);
	--color-warning-800: oklch(72.1% 0.14 98.32deg);
	--color-warning-900: oklch(65.16% 0.13 97.22deg);
	--color-warning-950: oklch(58.05% 0.12 95.69deg);
	--color-warning-contrast-dark: oklch(0% 0 none);
	--color-warning-contrast-light: var(--color-warning-50);
	--color-warning-contrast-50: var(--color-warning-contrast-dark);
	--color-warning-contrast-100: var(--color-warning-contrast-dark);
	--color-warning-contrast-200: var(--color-warning-contrast-dark);
	--color-warning-contrast-300: var(--color-warning-contrast-dark);
	--color-warning-contrast-400: var(--color-warning-contrast-dark);
	--color-warning-contrast-500: var(--color-warning-contrast-dark);
	--color-warning-contrast-600: var(--color-warning-contrast-dark);
	--color-warning-contrast-700: var(--color-warning-contrast-dark);
	--color-warning-contrast-800: var(--color-warning-contrast-dark);
	--color-warning-contrast-900: var(--color-warning-contrast-dark);
	--color-warning-contrast-950: var(--color-warning-contrast-dark);
	--color-error-50: oklch(90.63% 0.05 32.16deg);
	--color-error-100: oklch(84.19% 0.08 24.55deg);
	--color-error-200: oklch(77.94% 0.11 21.98deg);
	--color-error-300: oklch(72.4% 0.15 22.43deg);
	--color-error-400: oklch(67.24% 0.18 22.95deg);
	--color-error-500: oklch(63.16% 0.21 24.5deg);
	--color-error-600: oklch(58.83% 0.2 24.7deg);
	--color-error-700: oklch(54.51% 0.19 25.46deg);
	--color-error-800: oklch(49.87% 0.18 25.74deg);
	--color-error-900: oklch(45.39% 0.16 26.68deg);
	--color-error-950: oklch(40.77% 0.15 27.15deg);
	--color-error-contrast-dark: oklch(0% 0 none);
	--color-error-contrast-light: var(--color-error-50);
	--color-error-contrast-50: var(--color-error-contrast-dark);
	--color-error-contrast-100: var(--color-error-contrast-dark);
	--color-error-contrast-200: var(--color-error-contrast-dark);
	--color-error-contrast-300: var(--color-error-contrast-dark);
	--color-error-contrast-400: var(--color-error-contrast-dark);
	--color-error-contrast-500: var(--color-error-contrast-dark);
	--color-error-contrast-600: var(--color-error-contrast-dark);
	--color-error-contrast-700: var(--color-error-contrast-light);
	--color-error-contrast-800: var(--color-error-contrast-light);
	--color-error-contrast-900: var(--color-error-contrast-light);
	--color-error-contrast-950: var(--color-error-contrast-light);
	--color-surface-50: oklch(97.02% 0 none);
	--color-surface-100: oklch(87.95% 0 287.19deg);
	--color-surface-200: oklch(78.67% 0 286.54deg);
	--color-surface-300: oklch(69.28% 0 271.46deg);
	--color-surface-400: oklch(59.39% 0.01 277.15deg);
	--color-surface-500: oklch(49.02% 0.01 278.52deg);
	--color-surface-600: oklch(44.35% 0.01 278.47deg);
	--color-surface-700: oklch(39.51% 0.01 277deg);
	--color-surface-800: oklch(34.3% 0.01 285.88deg);
	--color-surface-900: oklch(29.11% 0.01 285.87deg);
	--color-surface-950: oklch(23.72% 0.01 285.68deg);
	--color-surface-contrast-dark: var(--color-surface-950);
	--color-surface-contrast-light: var(--color-surface-50);
	--color-surface-contrast-50: var(--color-surface-contrast-dark);
	--color-surface-contrast-100: var(--color-surface-contrast-dark);
	--color-surface-contrast-200: var(--color-surface-contrast-dark);
	--color-surface-contrast-300: var(--color-surface-contrast-dark);
	--color-surface-contrast-400: var(--color-surface-contrast-dark);
	--color-surface-contrast-500: var(--color-surface-contrast-light);
	--color-surface-contrast-600: var(--color-surface-contrast-light);
	--color-surface-contrast-700: var(--color-surface-contrast-light);
	--color-surface-contrast-800: var(--color-surface-contrast-light);
	--color-surface-contrast-900: var(--color-surface-contrast-light);
	--color-surface-contrast-950: var(--color-surface-contrast-light);
}
```

#### Implementation Notes

- Set `data-theme="concord"` on the app root (e.g., SvelteKit `+layout.svelte` outermost element) so all Skeleton tokens apply.
- Do not mix other Skeleton themes or ad-hoc tokens; use only the `concord` variables to keep visuals consistent.
- Prefer semantic theme tokens (e.g., `var(--color-primary-600)`) over hardcoded hex values.

### Color Palette (via theme tokens)

Use theme tokens from "concord". Map semantic roles to tokens as follows:

| Semantic | Token | Example Usage |
|---|---|---|
| Primary | `var(--color-primary-600)` | Primary buttons, highlights |
| Secondary | `var(--color-secondary-700)` | Secondary emphasis, headings |
| Accent | `var(--color-tertiary-600)` | Accents, links |
| Success | `var(--color-success-600)` | Success states |
| Warning | `var(--color-warning-700)` | Warnings |
| Error | `var(--color-error-600)` | Errors, destructive actions |
| Surface/Base | `var(--color-surface-*)` | Backgrounds, panels, text contrast |

### Typography

**Font Families:**
- Base: system-ui, sans-serif (theme default)
- Headings: Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif (theme default)
- Monospace: JetBrains Mono (or system monospace if unavailable)

**Type Scale**

| Element | Size | Weight | Line Height |
|---|---|---|---|
| H1 | 30–36px | 700 | 1.2 |
| H2 | 24–30px | 600 | 1.3 |
| H3 | 20–24px | 600 | 1.35 |
| Body | 14–16px | 400 | 1.6 |
| Small | 12–14px | 500 | 1.5 |

### Iconography
**Icon Library:** Lucide (standardized; do not mix icon sets)

**Usage Guidelines:** Consistent stroke weight; pair with labels for critical actions; prefer outlined variants; use the specified Lucide equivalents for status icons.

### Spacing & Layout
**Grid System:** 12‑column responsive; container max‑widths aligned to Tailwind defaults

**Spacing Scale:** 4‑point scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80)

## Accessibility Requirements

### Compliance Target
**Standard:** WCAG 2.2 AA

### Key Requirements

**Visual:**
- Color contrast ratios: 4.5:1 body, 3:1 large text; status chips and buttons meet or exceed.
- Focus indicators: Highly visible outlines; never removed; meets WCAG 2.4.7.
- Text sizing: Zoom to 200% without loss of functionality; rem‑based scale.

**Interaction:**
- Keyboard navigation: Full coverage, logical tab order, skip links, no keyboard traps.
- Screen reader support: ARIA roles/labels for interactive components; announce validation and status changes.
- Touch targets: 44×44px minimum on mobile; generous spacing.

**Content:**
- Alternative text: Descriptive alt for non‑decorative media; mark decorative as presentational.
- Heading structure: Semantic H1–H6 hierarchy; one H1 per view.
- Form labels: Explicit labels, associated help/error text with ARIA‑describedby.

### Testing Strategy
- Automated: Axe checks; linting for common a11y issues; contrast linting.
- Manual: Keyboard‑only passes; screen reader spot checks (VoiceOver/NVDA); zoom/responsive checks.
- CI: Accessibility smoke checks in PR validation; failures block merges for critical issues.

## Responsiveness Strategy

Default approach: Desktop-first with graceful degradation to tablet and phone.

### Breakpoints

| Breakpoint | Min Width | Max Width | Target Devices |
|---|---|---|---|
| Mobile | 0 | 639px | Phones |
| Tablet | 640px | 1023px | Small tablets / landscape phones |
| Desktop | 1024px | 1439px | Laptops / standard desktops |
| Wide | 1440px | - | Large displays |

### Adaptation Patterns

**Layout Changes:** Desktop default is two to three panes (Stepper | main | side panel). On tablet, prefer two columns (main | side) using Tabs to switch panels when space is limited. On mobile, stack sections and convert split panes into tabs.

**Navigation Changes:** Full top navigation with breadcrumbs on desktop. Collapse to icon bar or a drawer on mobile; keep breadcrumbs visible.

**Content Priority:** Show stepper and active section first; defer non‑critical panels below fold.

**Interaction Changes:** Larger targets; reduced hover‑only affordances; keyboard parity maintained.

## Animation & Micro-interactions

### Motion Principles
- Subtle, purposeful, reversible; never block input; respect reduced motion preferences.

### Key Animations
- Loading Indicator: Skeleton shimmer or progress bar; 400–800ms; ease‑out.
- Diff Apply: Brief highlight of inserted/removed lines; 200–300ms; ease‑in‑out.
- Status Change: Chip transitions between states with fade/scale; 150–200ms.
- Notifications: Slide‑in/out toasts with accessible focus handling; 200–250ms.

## Performance Considerations

### Performance Goals
- Page Load: ≤ 2s TTFMP on broadband.
- Interaction Response: P95 < 3s for client actions.
- Animation: 60 FPS target on modern devices.

### Design Strategies
- Prefer lightweight DOM and defer non‑critical panels; lazy‑load chat/diff panes.
- Stream long model outputs; avoid blocking UI during proposals and exports.
- Use responsive images/icons; limit shadows/filters that hurt compositing.
- Virtualize long lists (documents, knowledge items) and paginate where sensible.
- Cache recent sections locally; debounce validations; batch minor updates.

## Next Steps

### Immediate Actions
1. Review this spec with stakeholders and capture feedback.
2. Create/update visual designs in the chosen design tool (Figma links above).
3. Prepare handoff to the Design Architect/front‑end team for implementation planning.
4. Track open questions/decisions and update the Change Log accordingly.

### Design Handoff Checklist
- All user flows documented
- Component inventory complete
- Accessibility requirements defined
- Responsive strategy clear
- Brand guidelines incorporated
- Performance goals established

## Checklist Results
If a UI/UX checklist exists, run it against this document and summarize results here. Pending.
