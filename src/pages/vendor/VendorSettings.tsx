import { useEffect, useRef, useState } from 'react';
import {
  Tabs, Header, Button, SpaceBetween, Box,
  FormField, Input, Textarea, Select, Toggle,
  ColumnLayout, Container, Multiselect, Alert,
  Table, Modal, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Session { id: string; device: string; ip: string; location: string; date: string; current: boolean }
interface TeamMember { id: string; name: string; email: string; role: string; last_active: string }

// ── Static data ───────────────────────────────────────────────────────────────
const REGIONS_MA = ['Casablanca', 'Rabat', 'Tanger', 'Fès', 'Marrakech', 'Agadir', 'Oujda', 'Meknès', 'Kenitra', 'Tétouan'];
const DELIVERY_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const VENDOR_TYPES = [
  { label: 'Fabricant', value: 'fabricant' }, { label: 'Producteur', value: 'producteur' },
  { label: 'Distributeur', value: 'distributeur' }, { label: 'Importateur', value: 'importateur' },
  { label: 'Grossiste', value: 'grossiste' }, { label: 'Revendeur', value: 'revendeur' },
  { label: 'Coopérative', value: 'cooperative' }, { label: 'Négociant', value: 'negociant' },
  { label: 'Torréfacteur', value: 'torrefacteur' }, { label: 'Agent', value: 'agent' },
  { label: 'Conserverie', value: 'conserverie' },
];
const RAYONS = ['Laitiers', 'Épicerie', 'Boissons', 'Hygiène', 'Entretien', 'Frais', 'Surgelés', 'Épicerie fine'];
const CERTIFS_GROSSISTE = ['HACCP', 'ONSSA', 'ISO 22000', 'ECOCERT'];
const SUBSCRIPTION_PLANS = [
  { name: 'Starter', price: 990, products: 50 },
  { name: 'Pro', price: 2490, products: 200 },
  { name: 'Enterprise', price: 5990, products: 'Illimité' },
];
const INVOICE_HISTORY = [
  { id: 'ab1', number: 'ABO-2024-004', plan: 'Gold Annuel', amount: 29880, date: '2024-12-01', status: 'paid' },
  { id: 'ab2', number: 'ABO-2024-003', plan: 'Gold Annuel', amount: 29880, date: '2024-11-01', status: 'paid' },
  { id: 'ab3', number: 'ABO-2024-002', plan: 'Gold Annuel', amount: 29880, date: '2024-10-01', status: 'paid' },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VendorSettings() {
  const { activeOrg } = useAuth();

  const [saving, setSaving] = useState(false);
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string }[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [changingPwd, setChangingPwd] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  function flash(type: 'success' | 'error', content: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashItems([{ type, content }]);
    flashTimer.current = setTimeout(() => setFlashItems([]), 4000);
  }

  // ── Profil entreprise ────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    vendor_type: 'grossiste', name: 'Empresa Distribution SARL',
    ice: '001234567890123', rc: 'RC 98765 / Casablanca', if_num: 'IF 45678901',
    cnss: '7654321', address: '12, Rue Al Massira Al Khadra, Casablanca',
    city: 'Casablanca', postal: '20000', region: 'Grand Casablanca',
    contact: 'Mohamed Alami', phone: '+212 522 001 122',
    email: 'contact@empresa.ma', website: 'www.empresa.ma', bio: '',
  });

  // ── Livraison ────────────────────────────────────────────────────────────
  const [delivery, setDelivery] = useState({
    standard_days: '2', cutoff_hour: '16', franco: '2000', moq: '500',
    direct: true, express: false, click_collect: false, returns_accepted: true, returns_days: '7',
  });
  const [deliveryDays, setDeliveryDays] = useState<string[]>(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']);
  const [deliveryZones, setDeliveryZones] = useState<string[]>(['Casablanca', 'Rabat', 'Tanger']);

  // ── Grossiste ────────────────────────────────────────────────────────────
  const [grossiste, setGrossiste] = useState({
    capacity_m3: '1200', processing_days: '2', own_fleet: true,
  });
  const [selectedRayons, setSelectedRayons] = useState<string[]>(['Laitiers', 'Épicerie', 'Boissons']);
  const [selectedCertifs, setSelectedCertifs] = useState<string[]>(['HACCP', 'ONSSA']);
  const [selectedTemps, setSelectedTemps] = useState<string[]>(['ambient', 'refrigerated']);

  // ── Vitrine ──────────────────────────────────────────────────────────────
  const [vitrine, setVitrine] = useState({
    storename: 'Empresa Distrib', slug: 'empresa-distrib',
    tagline: 'Votre grossiste de confiance au Maroc',
    moq: '500', franco: '2000', lead_days: '2', cutoff: '16',
  });

  // ── Notifications ────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    new_order: true, order_timeout: true, low_stock: true,
    payment_received: true, cod_reconcile: false, new_review: false, system: true,
  });
  const [notifChannel, setNotifChannel] = useState('realtime');

  // ── Virement ─────────────────────────────────────────────────────────────
  const [bank, setBank] = useState({
    bank_name: 'Attijariwafa Bank', account_holder: 'Empresa Distribution SARL',
    rib: 'MA005127000211234567890100', iban: 'MA64011519000001205000534921',
    swift: 'BCMAMAMC',
  });
  const [wiringDay, setWiringDay] = useState('10');
  const [wiringMin, setWiringMin] = useState('500');

  // ── Sécurité ─────────────────────────────────────────────────────────────
  const [twofa, setTwofa] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<Session | null>(null);

  // ── Abonnement ───────────────────────────────────────────────────────────
  const currentPlan = { name: 'Gold Annuel (Pro)', next: '2025-01-01', products_used: 87, products_max: 200 };

  function pf(field: string, val: string) { setProfile((p) => ({ ...p, [field]: val })); }
  function df(field: string, val: string | boolean) { setDelivery((d) => ({ ...d, [field]: val })); }
  function vf(field: string, val: string) { setVitrine((v) => ({ ...v, [field]: val })); }
  function bf(field: string, val: string) { setBank((b) => ({ ...b, [field]: val })); }

  // ── Chargement initial depuis Supabase ───────────────────────────────────
  useEffect(() => {
    if (!activeOrg) return;
    async function load() {
      const [orgRes, spRes, membersRes] = await Promise.all([
        supabase.from('organisations').select('*').eq('id', activeOrg!.id).single(),
        supabase.from('seller_profiles').select('*').eq('organisation_id', activeOrg!.id).maybeSingle(),
        supabase
          .from('organisation_members')
          .select('id, team_role, joined_at, profiles(full_name, email)')
          .eq('organisation_id', activeOrg!.id)
          .eq('active', true),
      ]);
      if (membersRes.data) {
        setTeamMembers(
          (membersRes.data as Array<{ id: string; team_role: string; joined_at: string; profiles?: { full_name?: string | null; email?: string | null } | null }>)
            .map((m) => ({
              id:          m.id,
              name:        m.profiles?.full_name ?? 'Utilisateur',
              email:       m.profiles?.email     ?? '',
              role:        m.team_role,
              last_active: m.joined_at,
            }))
        );
      }
      if (orgRes.data) {
        const o = orgRes.data;
        setProfile((p) => ({
          ...p,
          name:    o.name           ?? p.name,
          ice:     o.vat_number     ?? p.ice,
          address: o.address_line1  ?? p.address,
          city:    o.city           ?? p.city,
          postal:  o.postal_code    ?? p.postal,
          region:  o.region         ?? p.region,
          phone:   o.phone          ?? p.phone,
          email:   o.email          ?? p.email,
          website: o.website        ?? p.website,
        }));
      }
      if (spRes.data) {
        const sp = spRes.data;
        setBank((b) => ({
          ...b,
          iban:           sp.bank_iban         ?? b.iban,
          swift:          sp.bank_bic          ?? b.swift,
          rib:            sp.bank_rib          ?? b.rib,
          bank_name:      sp.bank_name         ?? b.bank_name,
          account_holder: sp.bank_account_name ?? b.account_holder,
        }));
        // Delivery settings
        if (sp.default_delivery_days || sp.default_franco_eur) {
          setDelivery((d) => ({
            ...d,
            standard_days: sp.default_delivery_days ? String(sp.default_delivery_days) : d.standard_days,
            franco:        sp.default_franco_eur    ? String(sp.default_franco_eur)    : d.franco,
            moq:           sp.default_moq           ? String(sp.default_moq)           : d.moq,
            cutoff_hour:   sp.cutoff_hour           ? String(sp.cutoff_hour)           : d.cutoff_hour,
          }));
        }
        if (sp.delivery_zones?.length)  setDeliveryZones(sp.delivery_zones);
        if (sp.delivery_days?.length)   setDeliveryDays(sp.delivery_days);
        // Grossiste settings
        if (sp.product_categories?.length) setSelectedRayons(sp.product_categories);
        if (sp.certifications?.length)     setSelectedCertifs(sp.certifications);
        if (sp.temperature_storage?.length) setSelectedTemps(sp.temperature_storage);
        if (sp.warehouse_capacity_m3 || sp.processing_days) {
          setGrossiste((g) => ({
            ...g,
            capacity_m3:     sp.warehouse_capacity_m3 ? String(sp.warehouse_capacity_m3) : g.capacity_m3,
            processing_days: sp.processing_days       ? String(sp.processing_days)       : g.processing_days,
            own_fleet:       sp.has_own_fleet         ?? g.own_fleet,
          }));
        }
        // Vitrine settings
        if (sp.store_name || sp.slug) {
          setVitrine((v) => ({
            ...v,
            storename: sp.store_name ?? v.storename,
            slug:      sp.slug       ?? v.slug,
            tagline:   sp.tagline    ?? v.tagline,
          }));
        }
        // Notification prefs
        if (sp.notification_prefs) {
          const np = sp.notification_prefs as Record<string, boolean | string>;
          const { channel, ...bools } = np;
          if (typeof channel === 'string') setNotifChannel(channel);
          if (Object.keys(bools).length) setNotifs((n) => ({ ...n, ...(bools as Record<string, boolean>) }));
        }
      }
    }
    load();
  }, [activeOrg]);

  // ── Save profil entreprise ────────────────────────────────────────────────
  async function saveProfile() {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase.from('organisations').update({
      name:         profile.name,
      vat_number:   profile.ice,
      address_line1: profile.address,
      city:         profile.city,
      postal_code:  profile.postal,
      region:       profile.region,
    }).eq('id', activeOrg.id);
    setSaving(false);
    if (error) flash('error', error.message);
    else flash('success', 'Profil entreprise enregistré.');
  }

  // ── Save coordonnées bancaires ───────────────────────────────────────────
  async function saveBank() {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase.from('seller_profiles').upsert({
      organisation_id: activeOrg.id,
      bank_iban: bank.iban, bank_bic: bank.swift, bank_rib: bank.rib,
      bank_name: bank.bank_name, bank_account_name: bank.account_holder,
    }, { onConflict: 'organisation_id' });
    setSaving(false);
    if (error) flash('error', error.message);
    else flash('success', 'Coordonnées bancaires enregistrées.');
  }

  // ── Save livraison ────────────────────────────────────────────────────────
  async function saveDelivery() {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase.from('seller_profiles').upsert({
      organisation_id: activeOrg.id,
      default_delivery_days: parseInt(delivery.standard_days),
      default_franco_eur:    parseFloat(delivery.franco),
      default_moq:           parseInt(delivery.moq),
      cutoff_hour:           parseInt(delivery.cutoff_hour),
      delivery_days:         deliveryDays,
      delivery_zones:        deliveryZones,
      has_direct_delivery:   delivery.direct,
      has_express:           delivery.express,
      has_click_collect:     delivery.click_collect,
      accepts_returns:       delivery.returns_accepted,
      return_window_days:    parseInt(delivery.returns_days),
    }, { onConflict: 'organisation_id' });
    setSaving(false);
    if (error) flash('error', error.message);
    else flash('success', 'Conditions de livraison enregistrées.');
  }

  // ── Save infos grossiste ──────────────────────────────────────────────────
  async function saveGrossiste() {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase.from('seller_profiles').upsert({
      organisation_id:       activeOrg.id,
      product_categories:    selectedRayons,
      warehouse_capacity_m3: parseFloat(grossiste.capacity_m3),
      processing_days:       parseInt(grossiste.processing_days),
      has_own_fleet:         grossiste.own_fleet,
      temperature_storage:   selectedTemps,
      certifications:        selectedCertifs,
    }, { onConflict: 'organisation_id' });
    setSaving(false);
    if (error) flash('error', error.message);
    else flash('success', 'Infos grossiste enregistrées.');
  }

  // ── Save vitrine ──────────────────────────────────────────────────────────
  async function saveVitrine() {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase.from('seller_profiles').upsert({
      organisation_id:       activeOrg.id,
      store_name:            vitrine.storename,
      slug:                  vitrine.slug,
      tagline:               vitrine.tagline,
      default_moq:           parseInt(vitrine.moq),
      default_franco_eur:    parseFloat(vitrine.franco),
      default_delivery_days: parseInt(vitrine.lead_days),
      cutoff_hour:           parseInt(vitrine.cutoff),
    }, { onConflict: 'organisation_id' });
    setSaving(false);
    if (error) flash('error', error.message);
    else flash('success', 'Paramètres vitrine enregistrés.');
  }

  // ── Save notifications ────────────────────────────────────────────────────
  async function saveNotifs() {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase.from('seller_profiles').upsert({
      organisation_id: activeOrg.id,
      notification_prefs: { ...notifs, channel: notifChannel },
    }, { onConflict: 'organisation_id' });
    setSaving(false);
    if (error) flash('error', error.message);
    else flash('success', 'Préférences de notification enregistrées.');
  }

  // ── Changement de mot de passe ────────────────────────────────────────────
  async function changePassword() {
    if (pwdForm.next !== pwdForm.confirm) {
      flash('error', 'Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    if (pwdForm.next.length < 8) {
      flash('error', 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwdForm.next });
    setChangingPwd(false);
    if (error) flash('error', error.message);
    else {
      flash('success', 'Mot de passe modifié avec succès.');
      setPwdForm({ current: '', next: '', confirm: '' });
    }
  }

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Paramètres</Header>

      {flashItems.length > 0 && (
        <Flashbar items={flashItems.map((f, i) => ({ ...f, id: String(i), dismissible: true, onDismiss: () => setFlashItems([]) }))} />
      )}

      <Tabs
        tabs={[
          // ── 1. Profil entreprise ──────────────────────────────────────
          {
            id: 'profile',
            label: 'Profil entreprise',
            content: (
              <Container header={<Header variant="h2" actions={<Button variant="primary" loading={saving} onClick={saveProfile}>Enregistrer</Button>}>Profil légal</Header>}>
                <SpaceBetween size="m">
                  <FormField label="Type de vendeur">
                    <Select
                      selectedOption={VENDOR_TYPES.find((t) => t.value === profile.vendor_type) ?? VENDOR_TYPES[0]}
                      options={VENDOR_TYPES}
                      onChange={({ detail }) => pf('vendor_type', detail.selectedOption.value ?? '')}
                    />
                  </FormField>
                  <ColumnLayout columns={2}>
                    <FormField label="Raison sociale *"><Input value={profile.name} onChange={({ detail }) => pf('name', detail.value)} /></FormField>
                    <FormField label="ICE *"><Input value={profile.ice} onChange={({ detail }) => pf('ice', detail.value)} /></FormField>
                    <FormField label="Registre de commerce"><Input value={profile.rc} onChange={({ detail }) => pf('rc', detail.value)} /></FormField>
                    <FormField label="Identifiant fiscal"><Input value={profile.if_num} onChange={({ detail }) => pf('if_num', detail.value)} /></FormField>
                    <FormField label="CNSS"><Input value={profile.cnss} onChange={({ detail }) => pf('cnss', detail.value)} /></FormField>
                    <FormField label="Ville"><Input value={profile.city} onChange={({ detail }) => pf('city', detail.value)} /></FormField>
                    <FormField label="Responsable"><Input value={profile.contact} onChange={({ detail }) => pf('contact', detail.value)} /></FormField>
                    <FormField label="Téléphone"><Input value={profile.phone} onChange={({ detail }) => pf('phone', detail.value)} /></FormField>
                    <FormField label="Email"><Input type="email" value={profile.email} onChange={({ detail }) => pf('email', detail.value)} /></FormField>
                    <FormField label="Site web"><Input value={profile.website} onChange={({ detail }) => pf('website', detail.value)} /></FormField>
                  </ColumnLayout>
                  <FormField label="Adresse siège"><Input value={profile.address} onChange={({ detail }) => pf('address', detail.value)} /></FormField>
                  <FormField label="Présentation (300 caractères max)">
                    <Textarea value={profile.bio} onChange={({ detail }) => pf('bio', detail.value)} rows={3} />
                  </FormField>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 2. Livraison ─────────────────────────────────────────────
          {
            id: 'delivery',
            label: 'Livraison',
            content: (
              <Container header={<Header variant="h2" actions={<Button variant="primary" loading={saving} onClick={saveDelivery}>Enregistrer</Button>}>Conditions de livraison</Header>}>
                <SpaceBetween size="m">
                  <ColumnLayout columns={2}>
                    <FormField label="Délai standard (jours)"><Input type="number" value={delivery.standard_days} onChange={({ detail }) => df('standard_days', detail.value)} /></FormField>
                    <FormField label="Heure limite commande (H)"><Input type="number" value={delivery.cutoff_hour} onChange={({ detail }) => df('cutoff_hour', detail.value)} /></FormField>
                    <FormField label="Franco de port (MAD)"><Input type="number" value={delivery.franco} onChange={({ detail }) => df('franco', detail.value)} /></FormField>
                    <FormField label="Commande minimale (MAD)"><Input type="number" value={delivery.moq} onChange={({ detail }) => df('moq', detail.value)} /></FormField>
                  </ColumnLayout>

                  <FormField label="Jours de livraison">
                    <SpaceBetween direction="horizontal" size="xs">
                      {DELIVERY_DAYS.map((day) => (
                        <Button
                          key={day}
                          variant={deliveryDays.includes(day) ? 'primary' : 'normal'}
                          onClick={() => setDeliveryDays((prev) =>
                            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                          )}
                        >
                          {day.substring(0, 3)}
                        </Button>
                      ))}
                    </SpaceBetween>
                  </FormField>

                  <FormField label="Zones couvertes">
                    <Multiselect
                      selectedOptions={deliveryZones.map((z) => ({ label: z, value: z }))}
                      options={REGIONS_MA.map((r) => ({ label: r, value: r }))}
                      onChange={({ detail }) => setDeliveryZones(detail.selectedOptions.map((o) => o.value ?? ''))}
                      placeholder="Sélectionner les villes"
                    />
                  </FormField>

                  <ColumnLayout columns={2}>
                    <FormField label="Livraison directe"><Toggle checked={delivery.direct} onChange={({ detail }) => df('direct', detail.checked)}>Flotte propre</Toggle></FormField>
                    <FormField label="Express"><Toggle checked={delivery.express} onChange={({ detail }) => df('express', detail.checked)}>Livraison J+1</Toggle></FormField>
                    <FormField label="Click & Collect"><Toggle checked={delivery.click_collect} onChange={({ detail }) => df('click_collect', detail.checked)}>Retrait en entrepôt</Toggle></FormField>
                    <FormField label="Retours acceptés"><Toggle checked={delivery.returns_accepted} onChange={({ detail }) => df('returns_accepted', detail.checked)}>Activés</Toggle></FormField>
                  </ColumnLayout>
                  {delivery.returns_accepted && (
                    <FormField label="Délai retour (jours)"><Input type="number" value={delivery.returns_days} onChange={({ detail }) => df('returns_days', detail.value)} /></FormField>
                  )}
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 3. Infos grossiste ───────────────────────────────────────
          {
            id: 'grossiste',
            label: 'Infos grossiste',
            content: (
              <Container header={<Header variant="h2" actions={<Button variant="primary" loading={saving} onClick={saveGrossiste}>Enregistrer</Button>}>Capacité & Certifications</Header>}>
                <SpaceBetween size="m">
                  <FormField label="Rayons distribués">
                    <Multiselect
                      selectedOptions={selectedRayons.map((r) => ({ label: r, value: r }))}
                      options={RAYONS.map((r) => ({ label: r, value: r }))}
                      onChange={({ detail }) => setSelectedRayons(detail.selectedOptions.map((o) => o.value ?? ''))}
                    />
                  </FormField>
                  <ColumnLayout columns={2}>
                    <FormField label="Capacité entrepôt (m³)"><Input type="number" value={grossiste.capacity_m3} onChange={({ detail }) => setGrossiste((g) => ({ ...g, capacity_m3: detail.value }))} /></FormField>
                    <FormField label="Délai de traitement (jours)"><Input type="number" value={grossiste.processing_days} onChange={({ detail }) => setGrossiste((g) => ({ ...g, processing_days: detail.value }))} /></FormField>
                  </ColumnLayout>
                  <FormField label="Températures gérées">
                    <SpaceBetween direction="horizontal" size="xs">
                      {[{ v: 'ambient', l: 'Ambiant' }, { v: 'refrigerated', l: 'Réfrigéré' }, { v: 'frozen', l: 'Congelé' }].map(({ v, l }) => (
                        <Button key={v} variant={selectedTemps.includes(v) ? 'primary' : 'normal'}
                          onClick={() => setSelectedTemps((prev) => prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v])}>
                          {l}
                        </Button>
                      ))}
                    </SpaceBetween>
                  </FormField>
                  <FormField label="Certifications">
                    <SpaceBetween direction="horizontal" size="xs">
                      {CERTIFS_GROSSISTE.map((c) => (
                        <Button key={c} variant={selectedCertifs.includes(c) ? 'primary' : 'normal'}
                          onClick={() => setSelectedCertifs((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}>
                          {c}
                        </Button>
                      ))}
                    </SpaceBetween>
                  </FormField>
                  <FormField label="Flotte propre"><Toggle checked={grossiste.own_fleet} onChange={({ detail }) => setGrossiste((g) => ({ ...g, own_fleet: detail.checked }))}>Livraison directe disponible</Toggle></FormField>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 4. Ma vitrine ────────────────────────────────────────────
          {
            id: 'vitrine',
            label: 'Ma vitrine',
            content: (
              <Container header={<Header variant="h2" actions={<Button variant="primary" loading={saving} onClick={saveVitrine}>Enregistrer</Button>}>Paramètres vitrine</Header>}>
                <SpaceBetween size="m">
                  <ColumnLayout columns={2}>
                    <FormField label="Nom de la vitrine"><Input value={vitrine.storename} onChange={({ detail }) => vf('storename', detail.value)} /></FormField>
                    <FormField label="URL slug" description={`stock212.com/store/${vitrine.slug}`}><Input value={vitrine.slug} onChange={({ detail }) => vf('slug', detail.value)} /></FormField>
                  </ColumnLayout>
                  <FormField label="Accroche"><Input value={vitrine.tagline} onChange={({ detail }) => vf('tagline', detail.value)} /></FormField>
                  <ColumnLayout columns={2}>
                    <FormField label="Commande min. (MAD)"><Input type="number" value={vitrine.moq} onChange={({ detail }) => vf('moq', detail.value)} /></FormField>
                    <FormField label="Livraison gratuite dès (MAD)"><Input type="number" value={vitrine.franco} onChange={({ detail }) => vf('franco', detail.value)} /></FormField>
                    <FormField label="Délai traitement (jours)"><Input type="number" value={vitrine.lead_days} onChange={({ detail }) => vf('lead_days', detail.value)} /></FormField>
                    <FormField label="Heure limite (H)"><Input type="number" value={vitrine.cutoff} onChange={({ detail }) => vf('cutoff', detail.value)} /></FormField>
                  </ColumnLayout>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 5. Notifications ─────────────────────────────────────────
          {
            id: 'notifications',
            label: 'Notifications',
            content: (
              <Container header={<Header variant="h2" actions={<Button variant="primary" loading={saving} onClick={saveNotifs}>Enregistrer</Button>}>Alertes configurables</Header>}>
                <SpaceBetween size="m">
                  {[
                    { key: 'new_order',       label: 'Nouvelle commande reçue' },
                    { key: 'order_timeout',   label: 'Timeout validation commande (2h)' },
                    { key: 'low_stock',       label: 'Stock faible (≤ 96 unités)' },
                    { key: 'payment_received',label: 'Paiement reçu' },
                    { key: 'cod_reconcile',   label: 'COD à réconcilier' },
                    { key: 'new_review',      label: 'Nouvel avis acheteur' },
                    { key: 'system',          label: 'Alertes système' },
                  ].map(({ key, label }) => (
                    <Toggle
                      key={key}
                      checked={(notifs as Record<string, boolean>)[key]}
                      onChange={({ detail }) => setNotifs((n) => ({ ...n, [key]: detail.checked }))}
                    >
                      {label}
                    </Toggle>
                  ))}
                  <FormField label="Canal de réception">
                    <Select
                      selectedOption={
                        notifChannel === 'realtime' ? { label: 'Temps réel', value: 'realtime' } :
                        notifChannel === 'daily'    ? { label: 'Résumé quotidien', value: 'daily' } :
                        notifChannel === 'weekly'   ? { label: 'Résumé hebdomadaire', value: 'weekly' } :
                                                       { label: 'Jamais', value: 'never' }
                      }
                      options={[
                        { label: 'Temps réel (WhatsApp + Email)', value: 'realtime' },
                        { label: 'Résumé quotidien (Email)', value: 'daily' },
                        { label: 'Résumé hebdomadaire (Email)', value: 'weekly' },
                        { label: 'Jamais', value: 'never' },
                      ]}
                      onChange={({ detail }) => setNotifChannel(detail.selectedOption.value ?? 'realtime')}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 6. Virement & Wallet ─────────────────────────────────────
          {
            id: 'virement',
            label: 'Virement & Wallet',
            content: (
              <Container header={<Header variant="h2" actions={<Button variant="primary" loading={saving} onClick={saveBank}>Enregistrer</Button>}>Coordonnées bancaires</Header>}>
                <SpaceBetween size="m">
                  <ColumnLayout columns={2}>
                    <FormField label="Banque"><Input value={bank.bank_name} onChange={({ detail }) => bf('bank_name', detail.value)} /></FormField>
                    <FormField label="Titulaire du compte"><Input value={bank.account_holder} onChange={({ detail }) => bf('account_holder', detail.value)} /></FormField>
                    <FormField label="RIB"><Input value={bank.rib} onChange={({ detail }) => bf('rib', detail.value)} /></FormField>
                    <FormField label="IBAN"><Input value={bank.iban} onChange={({ detail }) => bf('iban', detail.value)} /></FormField>
                    <FormField label="SWIFT / BIC"><Input value={bank.swift} onChange={({ detail }) => bf('swift', detail.value)} /></FormField>
                  </ColumnLayout>
                  <ColumnLayout columns={2}>
                    <FormField label="Jour du virement (du mois)">
                      <Select
                        selectedOption={{ label: `Le ${wiringDay} du mois`, value: wiringDay }}
                        options={['1', '5', '10', '15', '20', '25'].map((d) => ({ label: `Le ${d} du mois`, value: d }))}
                        onChange={({ detail }) => setWiringDay(detail.selectedOption.value ?? '10')}
                      />
                    </FormField>
                    <FormField label="Seuil minimum (MAD)">
                      <Input type="number" value={wiringMin} onChange={({ detail }) => setWiringMin(detail.value)} />
                    </FormField>
                  </ColumnLayout>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 7. Sécurité ──────────────────────────────────────────────
          {
            id: 'security',
            label: 'Sécurité',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Mot de passe</Header>}>
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2}>
                      <FormField label="Mot de passe actuel">
                        <Input type="password" value={pwdForm.current} onChange={({ detail }) => setPwdForm((p) => ({ ...p, current: detail.value }))} />
                      </FormField>
                      <FormField label="Nouveau mot de passe">
                        <Input type="password" value={pwdForm.next} onChange={({ detail }) => setPwdForm((p) => ({ ...p, next: detail.value }))} />
                      </FormField>
                      <FormField
                        label="Confirmer le nouveau mot de passe"
                        errorText={pwdForm.confirm && pwdForm.next !== pwdForm.confirm ? 'Les mots de passe ne correspondent pas.' : undefined}
                      >
                        <Input type="password" value={pwdForm.confirm} onChange={({ detail }) => setPwdForm((p) => ({ ...p, confirm: detail.value }))} />
                      </FormField>
                    </ColumnLayout>
                    <Button
                      variant="primary"
                      loading={changingPwd}
                      disabled={!pwdForm.next || pwdForm.next !== pwdForm.confirm}
                      onClick={changePassword}
                    >
                      Changer le mot de passe
                    </Button>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Double authentification (2FA)</Header>}>
                  <SpaceBetween size="s">
                    <Toggle checked={twofa} onChange={({ detail }) => setTwofa(detail.checked)}>
                      {twofa ? '2FA activée (via application TOTP)' : '2FA désactivée'}
                    </Toggle>
                    {twofa && (
                      <Alert type="success">
                        La double authentification est active. Votre compte est protégé.
                      </Alert>
                    )}
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Sessions actives</Header>}>
                  <SpaceBetween size="s">
                    <Alert type="info">
                      Pour révoquer une session spécifique, utilisez le bouton ci-dessous — toutes vos sessions
                      actives (autres appareils) seront déconnectées.
                    </Alert>
                    <Button
                      variant="normal"
                      onClick={async () => {
                        await supabase.auth.signOut({ scope: 'others' });
                        flash('success', 'Toutes les autres sessions ont été révoquées.');
                      }}
                    >
                      Déconnecter tous les autres appareils
                    </Button>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 8. Mon équipe ────────────────────────────────────────────
          {
            id: 'team',
            label: 'Mon équipe',
            content: (
              <Container header={<Header variant="h2">Membres de l'équipe</Header>}>
                <Table
                  columnDefinitions={[
                    { id: 'name',    header: 'Nom',              cell: (m: TeamMember) => m.name },
                    { id: 'email',   header: 'Email',            cell: (m: TeamMember) => m.email },
                    { id: 'role',    header: 'Rôle',             cell: (m: TeamMember) => m.role },
                    { id: 'active',  header: 'Rejoint le',       cell: (m: TeamMember) => new Date(m.last_active).toLocaleDateString('fr-FR') },
                    { id: 'actions', header: '',                  cell: (m: TeamMember) => (
                      m.role !== 'owner' ? (
                        <Button
                          variant="link"
                          loading={removingMember === m.id}
                          onClick={async () => {
                            setRemovingMember(m.id);
                            await supabase
                              .from('organisation_members')
                              .update({ active: false })
                              .eq('id', m.id);
                            setTeamMembers((prev) => prev.filter((x) => x.id !== m.id));
                            setRemovingMember(null);
                          }}
                        >
                          Retirer
                        </Button>
                      ) : null
                    )},
                  ]}
                  items={teamMembers}
                  empty={<Box textAlign="center" color="inherit">Aucun membre chargé.</Box>}
                />
              </Container>
            ),
          },

          // ── 9. Abonnement ────────────────────────────────────────────
          {
            id: 'subscription',
            label: 'Abonnement',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Plan actif</Header>}>
                  <ColumnLayout columns={3} variant="text-grid">
                    <Box>
                      <Box variant="awsui-key-label">Plan actif</Box>
                      <Box variant="h2">{currentPlan.name}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">Renouvellement</Box>
                      <Box variant="h2">{new Date(currentPlan.next).toLocaleDateString('fr-FR')}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">Produits actifs</Box>
                      <Box variant="h2">{currentPlan.products_used} / {currentPlan.products_max}</Box>
                    </Box>
                  </ColumnLayout>
                  <Box margin={{ top: 'm' }}>
                    <Button variant="primary">Gérer mon abonnement</Button>
                  </Box>
                </Container>

                <Container header={<Header variant="h2">Comparer les plans</Header>}>
                  <ColumnLayout columns={3}>
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div key={plan.name} style={{ border: '1px solid var(--color-border-divider-default)', borderRadius: '4px', padding: '16px' }}>
                        <SpaceBetween size="s">
                          <Box variant="h3">{plan.name}</Box>
                          <Box variant="h1">{plan.price} MAD<Box variant="small">/mois</Box></Box>
                          <Box>{plan.products} produits</Box>
                          <Button variant={plan.name === 'Pro' ? 'primary' : 'normal'}>
                            {plan.name === 'Pro' ? 'Plan actuel' : 'Choisir'}
                          </Button>
                        </SpaceBetween>
                      </div>
                    ))}
                  </ColumnLayout>
                </Container>

                <Container header={<Header variant="h2">Historique des factures</Header>}>
                  <Table
                    columnDefinitions={[
                      { id: 'number', header: 'N° Facture', cell: (i) => i.number },
                      { id: 'plan',   header: 'Plan',       cell: (i) => i.plan },
                      { id: 'amount', header: 'Montant',    cell: (i) => `${i.amount.toLocaleString('fr-MA')} MAD` },
                      { id: 'date',   header: 'Date',       cell: (i) => new Date(i.date).toLocaleDateString('fr-FR') },
                      { id: 'status', header: 'Statut',     cell: () => <Box color="text-status-success">Payée</Box> },
                      { id: 'dl',     header: '',           cell: () => <Button variant="link" iconName="download">PDF</Button> },
                    ]}
                    items={INVOICE_HISTORY}
                  />
                </Container>
              </SpaceBetween>
            ),
          },
        ]}
      />

      {/* Revoke session modal */}
      {showRevokeModal && (
        <Modal
          visible
          header="Révoquer la session"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowRevokeModal(null)}>Annuler</Button>
                <Button variant="primary" onClick={() => setShowRevokeModal(null)}>Révoquer</Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setShowRevokeModal(null)}
        >
          <Box>Révoquer la session <strong>{showRevokeModal.device}</strong> ({showRevokeModal.ip} — {showRevokeModal.location}) ?</Box>
        </Modal>
      )}
    </SpaceBetween>
  );
}
