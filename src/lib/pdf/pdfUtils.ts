import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '../supabase';

// ── Download helper ───────────────────────────────────────────────────────────
async function downloadPDF(element: React.ReactElement, filename: string) {
  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

// ── Facture ───────────────────────────────────────────────────────────────────
export async function generateInvoicePDF(invoiceId: string) {
  const { FactureDoc } = await import('./FactureDoc');
  const { data: inv } = await supabase
    .from('invoices')
    .select(`
      invoice_number, issued_at, due_at, status,
      amount_ht, amount_tax, amount_ttc, amount_paid,
      orders(
        id, order_number, payment_terms, currency,
        buyer_org_id, seller_org_id,
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city, vat_number),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city, vat_number),
        order_lines(product_name_snap, quantity, unit_price_ht, line_total_ht, products(ean))
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (!inv) throw new Error('Facture introuvable');
  const order = (inv as any).orders;
  const currency: string = order?.currency ?? 'MAD';

  const lines = (order?.order_lines ?? []).map((l: any) => ({
    description: l.product_name_snap,
    ref: l.products?.ean ?? '',
    qty: l.quantity,
    unitPrice: Number(l.unit_price_ht),
    total: Number(l.line_total_ht),
    currency,
  }));

  const element = React.createElement(FactureDoc, {
    data: {
      invoice_number: (inv as any).invoice_number,
      order_number: order?.order_number ?? '—',
      issued_at: fmtDate((inv as any).issued_at),
      due_at: fmtDate((inv as any).due_at),
      status: (inv as any).status,
      amount_ht: Number((inv as any).amount_ht ?? order?.total_ht ?? 0),
      amount_tax: Number((inv as any).amount_tax ?? order?.total_taxes ?? 0),
      amount_ttc: Number((inv as any).amount_ttc ?? order?.total_ttc ?? 0),
      amount_paid: Number((inv as any).amount_paid ?? 0),
      currency,
      payment_terms: order?.payment_terms ?? undefined,
      seller: {
        name: (order?.seller as any)?.name ?? 'Vendeur',
        address: (order?.seller as any)?.address_line1,
        city: (order?.seller as any)?.city,
        ice: (order?.seller as any)?.vat_number,
      },
      buyer: {
        name: (order?.buyer as any)?.name ?? 'Acheteur',
        address: (order?.buyer as any)?.address_line1,
        city: (order?.buyer as any)?.city,
        ice: (order?.buyer as any)?.vat_number,
      },
      lines,
    },
  });

  await downloadPDF(element, `Facture_${(inv as any).invoice_number}.pdf`);
}

// ── Bon de commande ───────────────────────────────────────────────────────────
export async function generateBonCommandePDF(orderId: string) {
  const { BonCommandeDoc } = await import('./BonCommandeDoc');
  const { data: order } = await supabase
    .from('orders')
    .select(`
      order_number, created_at, delivery_preference, payment_terms,
      delivery_address, notes, currency, total_ht, total_taxes, total_ttc,
      buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city, vat_number),
      seller:organisations!orders_seller_org_id_fkey(name, address_line1, city, vat_number),
      order_lines(product_name_snap, quantity, unit_price_ht, line_total_ht, products(ean))
    `)
    .eq('id', orderId)
    .single();

  if (!order) throw new Error('Commande introuvable');
  const o = order as any;
  const currency: string = o.currency ?? 'MAD';

  const lines = (o.order_lines ?? []).map((l: any) => ({
    description: l.product_name_snap,
    ref: l.products?.ean ?? '',
    qty: l.quantity,
    unitPrice: Number(l.unit_price_ht),
    total: Number(l.line_total_ht),
    currency,
  }));

  const element = React.createElement(BonCommandeDoc, {
    data: {
      order_number: o.order_number,
      created_at: fmtDate(o.created_at),
      delivery_preference: o.delivery_preference ?? 'standard',
      payment_terms: o.payment_terms ?? undefined,
      delivery_address: o.delivery_address ?? {},
      notes: o.notes ?? undefined,
      currency,
      total_ht: Number(o.total_ht),
      total_taxes: Number(o.total_taxes),
      total_ttc: Number(o.total_ttc),
      seller: { name: o.seller?.name ?? 'Vendeur', address: o.seller?.address_line1, city: o.seller?.city, ice: o.seller?.vat_number },
      buyer:  { name: o.buyer?.name  ?? 'Acheteur', address: o.buyer?.address_line1,  city: o.buyer?.city,  ice: o.buyer?.vat_number },
      lines,
    },
  });

  await downloadPDF(element, `BC_${o.order_number}.pdf`);
}

// ── Devis ─────────────────────────────────────────────────────────────────────
export async function generateDevisPDF(quoteId: string) {
  const { DevisDoc } = await import('./DevisDoc');
  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      quote_number, requested_at, expires_at, status, incoterm, notes,
      buyer:organisations!quotes_buyer_org_id_fkey(name, address_line1, city, vat_number),
      seller:organisations!quotes_seller_org_id_fkey(name, address_line1, city, vat_number),
      quote_lines(product_description, quantity, proposed_price, requested_price, products(name, ean))
    `)
    .eq('id', quoteId)
    .single();

  if (!quote) throw new Error('Devis introuvable');
  const q = quote as any;
  const currency = 'MAD';

  const lines = (q.quote_lines ?? []).map((l: any) => {
    const unitPrice = Number(l.proposed_price ?? l.requested_price ?? 0);
    const qty = Number(l.quantity);
    return {
      description: l.product_description ?? l.products?.name ?? 'Article',
      ref: l.products?.ean ?? '',
      qty,
      unitPrice,
      total: unitPrice * qty,
      currency,
    };
  });

  const totalHt = lines.reduce((s: number, l: any) => s + l.total, 0);
  const totalTax = totalHt * 0.2;

  const element = React.createElement(DevisDoc, {
    data: {
      quote_number: q.quote_number,
      requested_at: fmtDate(q.requested_at),
      expires_at: q.expires_at ? fmtDate(q.expires_at) : undefined,
      status: q.status,
      incoterm: q.incoterm ?? undefined,
      notes: q.notes ?? undefined,
      currency,
      total_ht: totalHt,
      total_taxes: totalTax,
      total_ttc: totalHt + totalTax,
      seller: { name: q.seller?.name ?? 'Vendeur', address: q.seller?.address_line1, city: q.seller?.city, ice: q.seller?.vat_number },
      buyer:  { name: q.buyer?.name  ?? 'Acheteur', address: q.buyer?.address_line1,  city: q.buyer?.city,  ice: q.buyer?.vat_number },
      lines,
    },
  });

  await downloadPDF(element, `Devis_${q.quote_number}.pdf`);
}

// ── Ordre de livraison ─────────────────────────────────────────────────────────
export async function generateOrdreLivraisonPDF(ticketId: string) {
  const { OrdreLivraisonDoc } = await import('./OrdreLivraisonDoc');
  const { data: ticket } = await supabase
    .from('delivery_tickets')
    .select(`
      ticket_number, created_at, priority, status,
      parcel_details, pickup_address, delivery_address,
      orders(
        order_number, notes, currency,
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city),
        order_lines(product_name_snap, quantity, unit_price_ht, line_total_ht)
      )
    `)
    .eq('id', ticketId)
    .single();

  if (!ticket) throw new Error('Ticket introuvable');
  const t = ticket as any;
  const order = t.orders;
  const currency = order?.currency ?? 'MAD';

  const lines = (order?.order_lines ?? []).map((l: any) => ({
    description: l.product_name_snap,
    qty: l.quantity,
    unitPrice: Number(l.unit_price_ht),
    total: Number(l.line_total_ht),
    currency,
  }));

  const element = React.createElement(OrdreLivraisonDoc, {
    data: {
      ticket_number: t.ticket_number,
      order_number: order?.order_number ?? '—',
      created_at: fmtDate(t.created_at),
      priority: t.priority ?? 'normal',
      status: t.status,
      parcel_details: t.parcel_details ?? {},
      pickup_address: t.pickup_address ?? {},
      delivery_address: t.delivery_address ?? {},
      notes: order?.notes ?? undefined,
      currency,
      sender:    { name: order?.seller?.name ?? 'Expéditeur', address: order?.seller?.address_line1, city: order?.seller?.city },
      recipient: { name: order?.buyer?.name  ?? 'Destinataire', address: order?.buyer?.address_line1, city: order?.buyer?.city },
      lines,
    },
  });

  await downloadPDF(element, `BL_${t.ticket_number}.pdf`);
}

// ── Bon de livraison (depuis ticket_id) ───────────────────────────────────────
export async function generateBonLivraisonPDF(ticketId: string) {
  const { BonLivraisonDoc } = await import('./BonLivraisonDoc');
  const { data: ticket } = await supabase
    .from('delivery_tickets')
    .select(`
      ticket_number, created_at, priority,
      parcel_details, pickup_address, delivery_address,
      orders(
        order_number, notes,
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city),
        order_lines(product_name_snap, quantity, products(ean, temperature))
      )
    `)
    .eq('id', ticketId)
    .single();

  if (!ticket) throw new Error('Ticket de livraison introuvable');
  const t = ticket as any;
  const order = t.orders;

  const lines = (order?.order_lines ?? []).map((l: any) => ({
    description: l.product_name_snap,
    ref: l.products?.ean ?? '',
    qty: l.quantity,
    temperature: l.products?.temperature ?? undefined,
  }));

  const element = React.createElement(BonLivraisonDoc, {
    data: {
      bl_number:        `BL-${t.ticket_number}`,
      order_number:     order?.order_number ?? '—',
      created_at:       fmtDate(t.created_at),
      priority:         t.priority ?? 'normal',
      notes:            order?.notes ?? undefined,
      pickup_address:   t.pickup_address ?? {},
      delivery_address: t.delivery_address ?? {},
      sender:    { name: order?.seller?.name ?? 'Expéditeur', address: order?.seller?.address_line1, city: order?.seller?.city },
      recipient: { name: order?.buyer?.name  ?? 'Destinataire', address: order?.buyer?.address_line1,  city: order?.buyer?.city },
      lines,
    },
  });

  await downloadPDF(element, `BL-${t.ticket_number}.pdf`);
}

// ── Bon de livraison depuis order_id (recherche le ticket automatiquement) ────
export async function generateBonLivraisonFromOrderPDF(orderId: string) {
  const { data: ticket } = await supabase
    .from('delivery_tickets')
    .select('id')
    .eq('order_id', orderId)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ticket) throw new Error('Aucun ticket de livraison trouvé pour cette commande');
  await generateBonLivraisonPDF((ticket as any).id);
}

// ── Avoir (depuis invoice_id) ─────────────────────────────────────────────────
export async function generateAvoirPDF(invoiceId: string) {
  const { AvoirDoc } = await import('./AvoirDoc');
  const { data: inv } = await supabase
    .from('invoices')
    .select(`
      invoice_number, issued_at, amount_ht, amount_tax, amount_ttc, currency,
      orders(
        order_number, currency,
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city, vat_number),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city, vat_number),
        order_lines(product_name_snap, quantity, unit_price_ht, line_total_ht, products(ean))
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (!inv) throw new Error('Facture introuvable');
  const i = inv as any;
  const order = i.orders;
  const currency: string = order?.currency ?? i.currency ?? 'MAD';

  const lines = (order?.order_lines ?? []).map((l: any) => ({
    description: l.product_name_snap,
    ref: l.products?.ean ?? '',
    qty: l.quantity,
    unitPrice: Number(l.unit_price_ht),
    total: Number(l.line_total_ht),
    currency,
  }));

  const avoirNumber = `AV-${i.invoice_number}`;

  const element = React.createElement(AvoirDoc, {
    data: {
      avoir_number:    avoirNumber,
      invoice_number:  i.invoice_number,
      order_number:    order?.order_number ?? undefined,
      issued_at:       fmtDate(new Date().toISOString()),
      reason:          'Avoir sur facture — à valoir sur prochaine commande ou remboursement',
      currency,
      amount_ht:  Number(i.amount_ht ?? 0),
      amount_tax: Number(i.amount_tax ?? 0),
      amount_ttc: Number(i.amount_ttc ?? 0),
      seller: { name: order?.seller?.name ?? 'Vendeur',   address: order?.seller?.address_line1, city: order?.seller?.city, ice: order?.seller?.vat_number },
      buyer:  { name: order?.buyer?.name  ?? 'Acheteur',  address: order?.buyer?.address_line1,  city: order?.buyer?.city,  ice: order?.buyer?.vat_number },
      lines,
    },
  });

  await downloadPDF(element, `Avoir_${avoirNumber}.pdf`);
}

// ── Relevé de compte (seller_org_id → buyer_org_id) ───────────────────────────
export async function generateReleveComptePDF(sellerOrgId: string, buyerOrgId: string) {
  const { ReleveCompteDoc } = await import('./ReleveCompteDoc');

  const [ordersRes, sellerRes, buyerRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, currency, created_at, invoices(invoice_number, issued_at, amount_ttc, amount_paid)')
      .eq('buyer_org_id', buyerOrgId)
      .eq('seller_org_id', sellerOrgId)
      .order('created_at', { ascending: true }),
    supabase.from('organisations').select('name, address_line1, city, vat_number').eq('id', sellerOrgId).single(),
    supabase.from('organisations').select('name, address_line1, city, vat_number').eq('id', buyerOrgId).single(),
  ]);

  const orders  = (ordersRes.data ?? []) as any[];
  const seller  = (sellerRes.data ?? {}) as any;
  const buyer   = (buyerRes.data ?? {}) as any;
  const currency = orders.find((o) => o.currency)?.currency ?? 'MAD';

  const entries: { date: string; ref: string; type: 'facture' | 'avoir' | 'paiement'; description: string; debit: number; credit: number }[] = [];

  for (const order of orders) {
    for (const inv of (order.invoices ?? [])) {
      entries.push({
        date:        fmtDate(inv.issued_at),
        ref:         inv.invoice_number,
        type:        'facture',
        description: `Facture — commande ${order.order_number}`,
        debit:       Number(inv.amount_ttc ?? 0),
        credit:      0,
      });
      if (Number(inv.amount_paid) > 0) {
        entries.push({
          date:        fmtDate(inv.issued_at),
          ref:         `PAIE-${inv.invoice_number}`,
          type:        'paiement',
          description: `Règlement facture ${inv.invoice_number}`,
          debit:       0,
          credit:      Number(inv.amount_paid),
        });
      }
    }
  }

  const now = new Date();
  const periodeDebut = entries.length > 0 ? entries[0].date : fmtDate(now.toISOString());
  const periodeFin   = fmtDate(now.toISOString());
  const buyerSlug    = (buyer.name ?? buyerOrgId).replace(/\s+/g, '_').substring(0, 20);

  const element = React.createElement(ReleveCompteDoc, {
    data: {
      periode_debut:   periodeDebut,
      periode_fin:     periodeFin,
      generated_at:    fmtDate(now.toISOString()),
      currency,
      seller: { name: seller.name ?? 'Vendeur',  address: seller.address_line1, city: seller.city, ice: seller.vat_number },
      buyer:  { name: buyer.name  ?? 'Acheteur', address: buyer.address_line1,  city: buyer.city,  ice: buyer.vat_number },
      entries,
      solde_ouverture: 0,
    },
  });

  await downloadPDF(element, `Releve_${buyerSlug}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.pdf`);
}

// ── Bon de Retour Marchandise (depuis return_id) ──────────────────────────────
export async function generateBonRetourPDF(returnId: string) {
  const { BonRetourDoc } = await import('./BonRetourDoc');
  const { data: ret } = await supabase
    .from('order_returns')
    .select(`
      return_number, requested_at, reason, refund_type, notes,
      orders(
        order_number, currency,
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city, vat_number),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city, vat_number)
      ),
      return_lines(product_name_snap, product_id, quantity_requested, unit_price_ht, reason_line, products(ean))
    `)
    .eq('id', returnId)
    .single();

  if (!ret) throw new Error('Retour introuvable');
  const r = ret as any;
  const order = r.orders;
  const currency: string = order?.currency ?? 'MAD';

  const lines = (r.return_lines ?? []).map((l: any) => ({
    product_name: l.product_name_snap,
    ref:          l.products?.ean ?? '',
    qty_requested: l.quantity_requested,
    unit_price_ht: l.unit_price_ht != null ? Number(l.unit_price_ht) : undefined,
    reason_line:  l.reason_line ?? undefined,
  }));

  const element = React.createElement(BonRetourDoc, {
    data: {
      return_number: r.return_number,
      order_number:  order?.order_number ?? '—',
      requested_at:  fmtDate(r.requested_at),
      reason:        r.reason,
      refund_type:   r.refund_type,
      notes:         r.notes ?? undefined,
      currency,
      buyer:  { name: order?.buyer?.name  ?? 'Acheteur', address: order?.buyer?.address_line1,  city: order?.buyer?.city,  ice: order?.buyer?.vat_number },
      seller: { name: order?.seller?.name ?? 'Vendeur',  address: order?.seller?.address_line1, city: order?.seller?.city, ice: order?.seller?.vat_number },
      lines,
    },
  });

  await downloadPDF(element, `BRM_${r.return_number}.pdf`);
}

// ── PV de Réception Retour (depuis return_id) ─────────────────────────────────
export async function generatePVReceptionPDF(returnId: string) {
  const { PVReceptionRetourDoc } = await import('./PVReceptionRetourDoc');
  const { data: ret } = await supabase
    .from('order_returns')
    .select(`
      return_number, received_at, status, notes,
      orders(
        order_number, currency,
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city)
      ),
      return_lines(product_name_snap, products(ean), quantity_requested, quantity_received, condition, accepted, reason_line)
    `)
    .eq('id', returnId)
    .single();

  if (!ret) throw new Error('Retour introuvable');
  const r = ret as any;
  const order = r.orders;
  const currency: string = order?.currency ?? 'MAD';

  const lines = (r.return_lines ?? []).map((l: any) => ({
    product_name:  l.product_name_snap,
    ref:           l.products?.ean ?? '',
    qty_requested: l.quantity_requested,
    qty_received:  l.quantity_received ?? undefined,
    condition:     l.condition ?? undefined,
    accepted:      l.accepted ?? undefined,
    reason_line:   l.reason_line ?? undefined,
  }));

  const acceptedAll = lines.every((l: any) => l.accepted === true);
  const rejectedAll = lines.every((l: any) => l.accepted === false);
  const overall: 'accepted' | 'partial' | 'rejected' =
    acceptedAll ? 'accepted' : rejectedAll ? 'rejected' : 'partial';

  const element = React.createElement(PVReceptionRetourDoc, {
    data: {
      return_number:  r.return_number,
      order_number:   order?.order_number ?? '—',
      received_at:    r.received_at ? fmtDate(r.received_at) : fmtDate(new Date().toISOString()),
      overall_status: overall,
      notes:          r.notes ?? undefined,
      currency,
      buyer:  { name: order?.buyer?.name  ?? 'Acheteur', address: order?.buyer?.address_line1,  city: order?.buyer?.city },
      seller: { name: order?.seller?.name ?? 'Vendeur',  address: order?.seller?.address_line1, city: order?.seller?.city },
      lines,
    },
  });

  await downloadPDF(element, `PV_${r.return_number}.pdf`);
}

// ── Ordre de Mission (depuis ticket_id) ───────────────────────────────────────
export async function generateOrdreMissionPDF(ticketId: string) {
  const { OrdreMissionDoc } = await import('./OrdreMissionDoc');
  const { data: ticket } = await supabase
    .from('delivery_tickets')
    .select(`
      ticket_number, created_at, priority, parcel_details, pickup_address, delivery_address,
      orders(
        order_number,
        order_lines(product_name_snap),
        buyer:organisations!orders_buyer_org_id_fkey(name, address_line1, city),
        seller:organisations!orders_seller_org_id_fkey(name, address_line1, city)
      )
    `)
    .eq('id', ticketId)
    .single();

  if (!ticket) throw new Error('Ticket introuvable');
  const t = ticket as any;
  const order   = t.orders;
  const parcel  = (t.parcel_details ?? {}) as Record<string, string>;
  const pickup  = (t.pickup_address  ?? {}) as Record<string, string>;
  const delivA  = (t.delivery_address ?? {}) as Record<string, string>;

  const driverName = parcel.driver_name ?? parcel.name ?? 'Livreur';

  const element = React.createElement(OrdreMissionDoc, {
    data: {
      mission_number: `OM-${t.ticket_number}`,
      issued_at:      fmtDate(t.created_at),
      company: {
        name:    order?.seller?.name ?? 'Stock212',
        address: order?.seller?.address_line1 ?? undefined,
        city:    order?.seller?.city ?? undefined,
      },
      driver: {
        name:         driverName,
        phone:        parcel.phone        ?? undefined,
        vehicle:      parcel.vehicle      ?? undefined,
        carrier_type: parcel.carrier_type ?? undefined,
      },
      route: {
        pickup:   { address: [pickup.line1,  pickup.city].filter(Boolean).join(', ')  || 'Entrepôt vendeur', city: pickup.city },
        delivery: { address: [delivA.line1,  delivA.city, delivA.postal_code].filter(Boolean).join(', ') || '—', city: delivA.city },
      },
      orders: order ? [{
        order_number: order.order_number,
        buyer_name:   order.buyer?.name ?? 'Client',
        total_items:  (order.order_lines ?? []).length || undefined,
      }] : [],
      priority:     t.priority ?? 'normal',
      tracking_ref: parcel.tracking_ref ?? undefined,
    },
  });

  await downloadPDF(element, `OM_${t.ticket_number}.pdf`);
}

// ── Note de Frais (depuis ticket_id) ─────────────────────────────────────────
export async function generateNoteFraisPDF(ticketId: string) {
  const { NoteFraisDoc } = await import('./NoteFraisDoc');

  const [ticketRes, expensesRes] = await Promise.all([
    supabase
      .from('delivery_tickets')
      .select(`
        ticket_number, created_at, parcel_details,
        orders(
          seller:organisations!orders_seller_org_id_fkey(name, address_line1, city)
        )
      `)
      .eq('id', ticketId)
      .single(),
    supabase
      .from('mission_expenses')
      .select('*')
      .eq('delivery_ticket_id', ticketId)
      .order('expense_date'),
  ]);

  if (ticketRes.error) throw ticketRes.error;
  const t        = ticketRes.data as any;
  const expenses = (expensesRes.data ?? []) as any[];
  const parcel   = (t.parcel_details ?? {}) as Record<string, string>;
  const seller   = t.orders?.seller;

  const driverName = parcel.driver_name ?? parcel.name ?? 'Livreur';
  const dates      = expenses.map((e) => e.expense_date as string).sort();
  const periodStart = dates[0]                        ?? fmtDate(t.created_at);
  const periodEnd   = dates[dates.length - 1]         ?? periodStart;

  const element = React.createElement(NoteFraisDoc, {
    data: {
      report_number:  `NDF-${t.ticket_number}`,
      mission_number: `OM-${t.ticket_number}`,
      period_start:   periodStart,
      period_end:     periodEnd,
      currency:       'MAD',
      company: {
        name:    seller?.name    ?? 'Stock212',
        address: seller?.address_line1 ?? undefined,
        city:    seller?.city    ?? undefined,
      },
      driver: {
        name:  driverName,
        phone: parcel.phone ?? undefined,
      },
      expenses: expenses.map((e) => ({
        date:         e.expense_date,
        expense_type: e.expense_type,
        description:  e.description ?? undefined,
        amount_ht:    Number(e.amount_ht),
        tva_rate:     Number(e.tva_rate),
        receipt_ref:  e.receipt_ref ?? undefined,
      })),
    },
  });

  await downloadPDF(element, `NDF_${t.ticket_number}.pdf`);
}

// ── Bon de commande depuis order_id seul (usage côté acheteur) ────────────────
export { generateBonCommandePDF as generateOrderPDF };
