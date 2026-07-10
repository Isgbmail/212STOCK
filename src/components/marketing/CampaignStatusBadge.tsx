import { StatusIndicator } from '@cloudscape-design/components';
import type { CampaignStatus } from '../../types/marketing';

const MAP: Record<CampaignStatus, { type: 'success' | 'warning' | 'error' | 'info' | 'stopped' | 'pending'; label: string }> = {
  active:    { type: 'success',  label: 'Active' },
  pending:   { type: 'pending',  label: 'En attente' },
  paused:    { type: 'warning',  label: 'En pause' },
  completed: { type: 'stopped',  label: 'Terminée' },
  cancelled: { type: 'error',    label: 'Annulée' },
  rejected:  { type: 'error',    label: 'Rejetée' },
};

export default function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { type, label } = MAP[status] ?? { type: 'info', label: status };
  return <StatusIndicator type={type}>{label}</StatusIndicator>;
}
