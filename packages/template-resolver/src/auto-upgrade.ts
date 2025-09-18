export interface DocumentTemplateBinding {
  templateId: string;
  version: string;
  schemaHash: string;
}

export type TemplateVersionLifecycleStatus = 'draft' | 'active' | 'deprecated';

export interface TemplateVersionSummary {
  templateId: string;
  version: string;
  schemaHash: string;
  status: TemplateVersionLifecycleStatus;
}

export interface EvaluateTemplateUpgradeOptions {
  binding: DocumentTemplateBinding;
  availableVersions: TemplateVersionSummary[];
  activeVersion?: TemplateVersionSummary | null;
}

export type TemplateUpgradeDecision =
  | {
      action: 'noop';
      reason: 'up_to_date' | 'no_active_version';
      currentVersion: TemplateVersionSummary;
    }
  | {
      action: 'upgrade';
      reason: 'out_of_date' | 'schema_mismatch';
      currentVersion: TemplateVersionSummary;
      targetVersion: TemplateVersionSummary;
    }
  | {
      action: 'blocked';
      reason: 'removed_version';
      requestedVersion: DocumentTemplateBinding;
    };

export function evaluateTemplateUpgrade(
  options: EvaluateTemplateUpgradeOptions
): TemplateUpgradeDecision {
  const { binding, availableVersions, activeVersion } = options;
  const currentVersion = availableVersions.find(
    version => version.templateId === binding.templateId && version.version === binding.version
  );

  if (!currentVersion) {
    return {
      action: 'blocked',
      reason: 'removed_version',
      requestedVersion: binding,
    };
  }

  if (!activeVersion) {
    return {
      action: 'noop',
      reason: 'no_active_version',
      currentVersion,
    };
  }

  if (activeVersion.templateId !== binding.templateId) {
    return {
      action: 'upgrade',
      reason: 'out_of_date',
      currentVersion,
      targetVersion: activeVersion,
    };
  }

  if (activeVersion.version !== binding.version) {
    return {
      action: 'upgrade',
      reason: 'out_of_date',
      currentVersion,
      targetVersion: activeVersion,
    };
  }

  if (binding.schemaHash !== activeVersion.schemaHash) {
    return {
      action: 'upgrade',
      reason: 'schema_mismatch',
      currentVersion,
      targetVersion: activeVersion,
    };
  }

  return {
    action: 'noop',
    reason: 'up_to_date',
    currentVersion,
  };
}
