import { useEffect, useState } from 'react';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  StatusIndicator,
  TextFilter,
  Box,
  Modal,
  FormField,
  Textarea,
  Input,
  Alert,
  ColumnLayout,
  Link,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { QUOTE_STATUS_LABELS, quoteStatusType } from '../../lib/vendorUtils';
import type { Quote, QuoteLine } from '../../types';

export default function VendorQuotes() {
  const { activeOrg } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [responding, setResponding] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [error, setError] = useState('');
  const [proposedPrices, setProposedPrices] = useState<Record<string, string>>({});

  async function fetchQuotes() {
    if (!activeOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select('*, quote_lines(*, products(name))')
      .eq('seller_org_id', activeOrg.id)
      .order('requested_at', { ascending: false });
    setQuotes((data as Quote[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchQuotes(); }, [activeOrg]);

  async function openQuote(quote: Quote) {
    setSelectedQuote(quote);
    const { data } = await supabase
      .from('quote_lines')
      .select('*, products(name, short_description)')
      .eq('quote_id', quote.id);
    const lines = (data as QuoteLine[]) ?? [];
    setQuoteLines(lines);
    const prices: Record<string, string> = {};
    lines.forEach((l) => { prices[l.id] = l.proposed_price?.toString() ?? ''; });
    setProposedPrices(prices);
    // Mark in_progress
    if (quote.status === 'new') {
      await supabase.from('quotes').update({ status: 'in_progress' }).eq('id', quote.id);
    }
  }

  async function handleRespond() {
    if (!selectedQuote) return;
    setResponding(true);
    setError('');
    try {
      // Update proposed prices
      await Promise.all(
        quoteLines.map((l) =>
          supabase
            .from('quote_lines')
            .update({ proposed_price: proposedPrices[l.id] ? parseFloat(proposedPrices[l.id]) : null })
            .eq('id', l.id)
        )
      );
      await supabase.from('quotes').update({
        status: 'responded',
        responded_at: new Date().toISOString(),
        notes: responseNote || null,
      }).eq('id', selectedQuote.id);
      setSelectedQuote(null);
      fetchQuotes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setResponding(false);
    }
  }

  const filtered = quotes.filter((q) =>
    !filterText || q.quote_number.toLowerCase().includes(filterText.toLowerCase())
  );


  return (
    <SpaceBetween size="l">
      <Table
        header={<Header variant="h1" counter={`(${filtered.length})`}>Demandes de devis</Header>}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="N° de devis..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        loading={loading}
        loadingText="Chargement..."
        trackBy="id"
        items={filtered}
        columnDefinitions={[
          {
            id: 'number',
            header: 'N° Devis',
            cell: (q: Quote) => <Link onFollow={() => openQuote(q)}>{q.quote_number}</Link>,
          },
          {
            id: 'date',
            header: 'Date demande',
            cell: (q: Quote) => new Date(q.requested_at).toLocaleDateString('fr-FR'),
          },
          {
            id: 'expires',
            header: 'Expire',
            cell: (q: Quote) => q.expires_at ? new Date(q.expires_at).toLocaleDateString('fr-FR') : '—',
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (q: Quote) => (
              <StatusIndicator type={quoteStatusType(q.status)}>
                {QUOTE_STATUS_LABELS[q.status] ?? q.status}
              </StatusIndicator>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (q: Quote) => (
              <Button variant="inline-link" onClick={() => openQuote(q)}>
                {['new', 'in_progress'].includes(q.status) ? 'Répondre' : 'Voir'}
              </Button>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune demande de devis</b>
            <Box variant="p" color="inherit">
              Les demandes de vos acheteurs apparaîtront ici.
            </Box>
          </Box>
        }
      />

      {selectedQuote && (
        <Modal
          visible
          onDismiss={() => setSelectedQuote(null)}
          header={`Devis ${selectedQuote.quote_number}`}
          size="large"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setSelectedQuote(null)}>Fermer</Button>
                {['new', 'in_progress'].includes(selectedQuote.status) && (
                  <Button variant="primary" loading={responding} onClick={handleRespond}>
                    Envoyer ma réponse
                  </Button>
                )}
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="l">
            {error && <Alert type="error">{error}</Alert>}

            <ColumnLayout columns={3} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Statut</Box>
                <StatusIndicator type={quoteStatusType(selectedQuote.status)}>
                  {QUOTE_STATUS_LABELS[selectedQuote.status]}
                </StatusIndicator>
              </div>
              <div>
                <Box variant="awsui-key-label">Incoterm souhaité</Box>
                <Box>{selectedQuote.incoterm ?? '—'}</Box>
              </div>
              {selectedQuote.notes && (
                <div>
                  <Box variant="awsui-key-label">Notes de l'acheteur</Box>
                  <Box>{selectedQuote.notes}</Box>
                </div>
              )}
            </ColumnLayout>

            {/* Quote lines */}
            <Box>
              <Box variant="awsui-key-label" padding={{ bottom: 's' }}>Produits demandés</Box>
              <SpaceBetween size="s">
                {quoteLines.map((line) => (
                  <Box key={line.id} padding="s" variant="code">
                    <ColumnLayout columns={4} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Produit</Box>
                        <Box>{(line as QuoteLine & { products?: { name: string } }).products?.name ?? line.product_id}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Quantité</Box>
                        <Box>{line.quantity}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Prix demandé</Box>
                        <Box>{line.requested_price ? `${line.requested_price} €` : 'Libre'}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Mon prix proposé</Box>
                        {['new', 'in_progress'].includes(selectedQuote.status) ? (
                          <Input
                            type="number"
                            value={proposedPrices[line.id] ?? ''}
                            onChange={({ detail }) =>
                              setProposedPrices({ ...proposedPrices, [line.id]: detail.value })
                            }
                            placeholder="Prix unitaire HT"
                          />
                        ) : (
                          <Box>{line.proposed_price ? `${line.proposed_price} €` : '—'}</Box>
                        )}
                      </div>
                    </ColumnLayout>
                  </Box>
                ))}
              </SpaceBetween>
            </Box>

            {['new', 'in_progress'].includes(selectedQuote.status) && (
              <FormField label="Note accompagnant ma réponse" stretch>
                <Textarea
                  value={responseNote}
                  onChange={({ detail }) => setResponseNote(detail.value)}
                  placeholder="Conditions, délais, remarques..."
                  rows={3}
                />
              </FormField>
            )}
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
