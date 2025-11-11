import type { ReactNode } from 'react';

import type { SectionStatus } from '../types/section-view';

const REVIEWABLE_STATUSES: SectionStatus[] = ['drafting', 'review', 'ready'];

export const shouldRenderApprovalPanel = (
  status: SectionStatus | null | undefined,
  isEditing: boolean
): boolean => {
  if (!status) {
    return false;
  }

  if (isEditing) {
    return true;
  }

  return REVIEWABLE_STATUSES.includes(status);
};

interface ApprovalPanelGateProps {
  isEditing: boolean;
  sectionStatus: SectionStatus | null | undefined;
  children: ReactNode;
}

export const ApprovalPanelGate = ({
  isEditing,
  sectionStatus,
  children,
}: ApprovalPanelGateProps) => {
  if (!shouldRenderApprovalPanel(sectionStatus, isEditing)) {
    return null;
  }

  return <>{children}</>;
};
