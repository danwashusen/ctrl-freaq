export interface RequirementMetadata {
  requirementId: string;
  sectionId: string;
  title: string;
  preview: string;
  tags?: string[];
}

const REQUIREMENT_CATALOG: RequirementMetadata[] = [
  {
    requirementId: 'req-governance-escalation',
    sectionId: 'sec-overview',
    title: 'Escalation policy documented',
    preview: 'Document escalation paths for outages with executive contacts.',
    tags: ['governance', 'operations'],
  },
  {
    requirementId: 'req-authentication-policy',
    sectionId: 'sec-security',
    title: 'Authentication policy recorded',
    preview: 'Summarize authentication providers, MFA enforcement, and fallback procedures.',
    tags: ['security'],
  },
  {
    requirementId: 'req-traceability-coverage',
    sectionId: 'sec-compliance',
    title: 'Traceability coverage assigned',
    preview: 'Link each requirement to the sections that provide evidence of coverage.',
    tags: ['compliance', 'traceability'],
  },
  {
    requirementId: 'req-coverage-gap',
    sectionId: 'sec-overview',
    title: 'Coverage gap resolution',
    preview: 'Address outstanding coverage gaps before enabling publish actions.',
    tags: ['compliance', 'quality'],
  },
];

export function getRequirementMetadata(requirementId: string): RequirementMetadata | null {
  return (
    REQUIREMENT_CATALOG.find(requirement => requirement.requirementId === requirementId) ?? null
  );
}

export function getRequirementsForSection(sectionId: string): RequirementMetadata[] {
  return REQUIREMENT_CATALOG.filter(requirement => requirement.sectionId === sectionId);
}

export function listRequirementMetadata(): RequirementMetadata[] {
  return [...REQUIREMENT_CATALOG];
}
