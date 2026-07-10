import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Container, ColumnLayout, Box, Table,
  Pagination, ProgressBar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Review {
  id: string;
  ticket_id: string;
  order_number: string | null;
  rating_global: number;
  rating_punctuality: number | null;
  rating_communication: number | null;
  comment: string | null;
  created_at: string;
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <Box>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}{' '}
      <Box display="inline" fontSize="body-s" color="text-body-secondary">
        {value.toFixed(1)}
      </Box>
    </Box>
  );
}

export default function DeliveryReviews() {
  const { activeOrg } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [avgGlobal, setAvgGlobal]   = useState(0);
  const [avgPunct, setAvgPunct]     = useState(0);
  const [avgComm, setAvgComm]       = useState(0);
  const [total, setTotal]           = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!activeOrg) return;
    async function load() {
      setLoading(true);

      const [listRes, kpiRes] = await Promise.all([
        supabase
          .from('delivery_reviews')
          .select(
            'id, ticket_id, rating_global, rating_punctuality, rating_communication, comment, created_at, delivery_tickets(orders(order_number))',
            { count: 'exact' }
          )
          .eq('delivery_org_id', activeOrg!.id)
          .order('created_at', { ascending: false })
          .range((currentPage - 1) * pageSize, currentPage * pageSize - 1),

        // Aggregate all reviews (independent from pagination)
        supabase
          .from('delivery_reviews')
          .select('rating_global, rating_punctuality, rating_communication')
          .eq('delivery_org_id', activeOrg!.id),
      ]);

      const raw = (listRes.data ?? []) as Array<{
        id: string;
        ticket_id: string;
        rating_global: number;
        rating_punctuality: number | null;
        rating_communication: number | null;
        comment: string | null;
        created_at: string;
        delivery_tickets: { orders: { order_number: string } | null } | null;
      }>;

      setReviews(raw.map((r) => ({
        id:                   r.id,
        ticket_id:            r.ticket_id,
        order_number:         r.delivery_tickets?.orders?.order_number ?? null,
        rating_global:        r.rating_global,
        rating_punctuality:   r.rating_punctuality,
        rating_communication: r.rating_communication,
        comment:              r.comment,
        created_at:           r.created_at,
      })));

      setTotalPages(Math.ceil((listRes.count ?? 0) / pageSize));
      setTotal(listRes.count ?? 0);

      if (kpiRes.data && kpiRes.data.length > 0) {
        const all = kpiRes.data as Array<{
          rating_global: number;
          rating_punctuality: number | null;
          rating_communication: number | null;
        }>;
        const avg = (arr: Array<number | null>) => {
          const valid = arr.filter((v) => v != null) as number[];
          return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
        };
        setAvgGlobal(avg(all.map((r) => r.rating_global)));
        setAvgPunct(avg(all.map((r) => r.rating_punctuality)));
        setAvgComm(avg(all.map((r) => r.rating_communication)));
      }

      setLoading(false);
    }
    load();
  }, [activeOrg?.id, currentPage]);

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Évaluations reçues</Header>

      {/* ── KPI ───────────────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Résumé des notes</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Note globale</Box>
            <Box fontSize="heading-xl" fontWeight="bold" color="text-status-success">
              {avgGlobal > 0 ? `${avgGlobal.toFixed(1)}/5` : '—'}
            </Box>
            <Box variant="small" color="text-body-secondary">{total} avis</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Ponctualité</Box>
            <Box fontSize="heading-xl" fontWeight="bold">
              {avgPunct > 0 ? `${avgPunct.toFixed(1)}/5` : '—'}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Communication</Box>
            <Box fontSize="heading-xl" fontWeight="bold">
              {avgComm > 0 ? `${avgComm.toFixed(1)}/5` : '—'}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Distribution des notes</Box>
            <SpaceBetween size="xxs">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => Math.round(r.rating_global) === star).length;
                const pct   = total > 0 ? (count / total) * 100 : 0;
                return (
                  <ProgressBar
                    key={star}
                    value={pct}
                    label={`${star}★`}
                    additionalInfo={`${count}`}
                  />
                );
              })}
            </SpaceBetween>
          </div>
        </ColumnLayout>
      </Container>

      {/* ── Liste des avis ───────────────────────────────────────────── */}
      <Table
        loading={loading}
        loadingText="Chargement des évaluations…"
        header={<Header variant="h2">Détail des avis</Header>}
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        items={reviews}
        trackBy="id"
        columnDefinitions={[
          {
            id: 'date',
            header: 'Date',
            cell: (r) => new Date(r.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric',
            }),
          },
          {
            id: 'order',
            header: 'Commande',
            cell: (r) => r.order_number ?? <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'global',
            header: 'Note globale',
            cell: (r) => <Stars value={r.rating_global} />,
          },
          {
            id: 'punctuality',
            header: 'Ponctualité',
            cell: (r) => r.rating_punctuality != null
              ? <Stars value={r.rating_punctuality} />
              : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'communication',
            header: 'Communication',
            cell: (r) => r.rating_communication != null
              ? <Stars value={r.rating_communication} />
              : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'comment',
            header: 'Commentaire',
            cell: (r) => r.comment
              ? <Box variant="p" color="text-body-secondary">{r.comment}</Box>
              : <Box color="text-body-secondary">—</Box>,
            minWidth: 200,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune évaluation</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Vous n'avez pas encore reçu d'évaluations.
            </Box>
          </Box>
        }
      />
    </SpaceBetween>
  );
}
