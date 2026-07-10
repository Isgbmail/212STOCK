import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, Table, Button, Box,
  SpaceBetween, StatusIndicator, Pagination,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import type { AdminMarketingNotification } from '../../types/marketing';

const PAGE_SIZE = 30;

const NOTIF_ICONS: Record<string, 'warning' | 'error' | 'info'> = {
  buyer_tier_upgrade: 'info',
  buyer_limit_reached: 'warning',
  seller_credits_low: 'warning',
  inventory_nearly_full: 'warning',
  promotion_budget_depleted: 'error',
  flash_sale_threshold_reached: 'info',
};

export default function AdminMarketingNotifications() {
  const [notifs, setNotifs] = useState<AdminMarketingNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [marking, setMarking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('admin_marketing_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setNotifs((data ?? []) as AdminMarketingNotification[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const markRead = async (id: string) => {
    setMarking(id);
    await supabase.from('admin_marketing_notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setMarking(null);
  };

  const markAllRead = async () => {
    await supabase.from('admin_marketing_notifications').update({ is_read: true }).eq('is_read', false);
    load();
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <ContentLayout header={
      <Header
        variant="h1"
        counter={unreadCount > 0 ? `(${unreadCount} non lues)` : undefined}
        actions={unreadCount > 0 ? <Button onClick={markAllRead}>Tout marquer comme lu</Button> : undefined}
      >
        Marketing — Notifications admin
      </Header>
    }>
      <Table
        loading={loading}
        items={notifs}
        columnDefinitions={[
          {
            id: 'status', header: '',
            cell: r => (
              <StatusIndicator type={r.is_read ? 'stopped' : (NOTIF_ICONS[r.type] ?? 'info')}>
                {r.is_read ? 'Lue' : 'Nouvelle'}
              </StatusIndicator>
            ),
          },
          { id: 'type', header: 'Type', cell: r => r.type.replace(/_/g, ' ') },
          { id: 'message', header: 'Message', cell: r => r.message },
          { id: 'entity', header: 'Entité', cell: r => r.entity_type ? `${r.entity_type}: ${r.entity_id?.slice(0, 8)}` : '—' },
          { id: 'date', header: 'Date', cell: r => new Date(r.created_at).toLocaleString('fr-FR') },
          {
            id: 'actions', header: '',
            cell: r => !r.is_read
              ? <Button variant="inline-link" loading={marking === r.id} onClick={() => markRead(r.id)}>Marquer lue</Button>
              : null,
          },
        ]}
        pagination={<Pagination currentPageIndex={page} pagesCount={Math.ceil(total / PAGE_SIZE)} onChange={e => setPage(e.detail.currentPageIndex)} />}
        header={<Header counter={`(${total})`} actions={<Button iconName="refresh" onClick={load}>Actualiser</Button>}>Notifications</Header>}
        empty={<Box textAlign="center">Aucune notification</Box>}
      />
    </ContentLayout>
  );
}
