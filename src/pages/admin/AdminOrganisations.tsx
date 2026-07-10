import { useEffect, useState } from 'react';
import {
  Search, X, ChevronDown, Users, MapPin,
  Calendar, Building2, CheckCircle, XCircle,
  Clock, Edit2, RefreshCw, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Organisation } from '../../types';

/* ── types ────────────────────────────────────────────────── */
interface OrgMember {
  user_id: string;
  team_role: string;
  active: boolean;
  profiles?: { full_name: string; email: string } | null;
}

interface EditForm {
  name: string;
  sub_type: string;
  siret: string;
  vat_number: string;
  country: string;
  address_line1: string;
  city: string;
  postal_code: string;
  region: string;
}

/* ── helpers ──────────────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  buyer: 'Acheteur', seller: 'Vendeur', delivery: 'Livreur',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Actif', pending: 'En attente', rejected: 'Rejeté', suspended: 'Suspendu',
};
const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire', admin_seller: 'Admin vendeur',
  catalog_manager: 'Gestionnaire catalogue', marketing_manager: 'Marketing',
  accountant: 'Comptable', viewer: 'Lecteur',
};

function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    buyer:    { bg: '#dbeafe', color: '#1e40af' },
    seller:   { bg: '#ede9fe', color: '#4a1d96' },
    delivery: { bg: '#dcfce7', color: '#14532d' },
  };
  const c = cfg[type] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold" style={{ background: c.bg, color: c.color }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#dcfce7', color: '#14532d' },
    pending:   { bg: '#fef3c7', color: '#92400e' },
    rejected:  { bg: '#fee2e2', color: '#7f1d1d' },
    suspended: { bg: '#fee2e2', color: '#7f1d1d' },
  };
  const c = cfg[status] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold" style={{ background: c.bg, color: c.color }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SelectFilter({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 text-sm text-gray-700 rounded-lg px-3 py-2 pr-7 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

/* ── modal ────────────────────────────────────────────────── */
function Modal({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  );
}

function Btn({
  children, onClick, variant = 'default', disabled, loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'warning' | 'default';
  disabled?: boolean;
  loading?: boolean;
}) {
  const styles: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger:  'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
    default: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {loading && <RefreshCw size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ── main component ───────────────────────────────────────── */
export default function AdminOrganisations() {
  const [orgs, setOrgs]           = useState<Organisation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]   = useState<Organisation | null>(null);
  const [members, setMembers]     = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'members'>('info');

  // Edit state
  const [editOrg, setEditOrg]   = useState<Organisation | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', sub_type: '', siret: '', vat_number: '',
    country: '', address_line1: '', city: '', postal_code: '', region: '',
  });
  const [saving, setSaving] = useState(false);

  async function fetchOrgs() {
    setLoading(true);
    let q = supabase.from('organisations').select('*').order('created_at', { ascending: false });
    if (typeFilter)   q = q.eq('org_type', typeFilter);
    if (statusFilter) q = q.eq('validation_status', statusFilter);
    const { data } = await q;
    setOrgs((data as Organisation[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchOrgs(); }, [typeFilter, statusFilter]);

  async function openDetail(org: Organisation) {
    setSelected(org);
    setActiveTab('info');
    setLoadingMembers(true);
    const { data } = await supabase
      .from('organisation_members')
      .select('user_id, team_role, active, profiles(full_name, email)')
      .eq('organisation_id', org.id);
    setMembers((data as OrgMember[]) ?? []);
    setLoadingMembers(false);
  }

  async function setStatus(org: Organisation, newStatus: 'active' | 'rejected' | 'pending' | 'suspended') {
    setProcessing(true);
    setError('');
    const { error: err } = await supabase
      .from('organisations')
      .update({ validation_status: newStatus })
      .eq('id', org.id);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(`"${org.name}" → ${STATUS_LABELS[newStatus] ?? newStatus}`);
      setSelected(null);
      fetchOrgs();
      setTimeout(() => setSuccess(''), 3000);
    }
    setProcessing(false);
  }

  function openEdit(org: Organisation) {
    setEditOrg(org);
    setEditForm({
      name: org.name, sub_type: org.sub_type ?? '', siret: org.siret ?? '',
      vat_number: org.vat_number ?? '', country: org.country,
      address_line1: org.address_line1 ?? '', city: org.city ?? '',
      postal_code: org.postal_code ?? '', region: org.region ?? '',
    });
  }

  async function saveEdit() {
    if (!editOrg) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('organisations').update({
      name: editForm.name, sub_type: editForm.sub_type || null,
      siret: editForm.siret || null, vat_number: editForm.vat_number || null,
      country: editForm.country, address_line1: editForm.address_line1 || null,
      city: editForm.city || null, postal_code: editForm.postal_code || null,
      region: editForm.region || null,
    }).eq('id', editOrg.id);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(`"${editForm.name}" modifiée.`);
      setEditOrg(null);
      fetchOrgs();
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  const filtered = orgs.filter(o =>
    !filterText || o.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '…' : `${filtered.length} organisation${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchOrgs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* ── Flash messages ──────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <XCircle size={15} />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          <CheckCircle size={15} />
          {success}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Rechercher par nom…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {filterText && (
            <button onClick={() => setFilterText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <SelectFilter
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: '', label: 'Tous types' },
            { value: 'buyer', label: 'Acheteurs' },
            { value: 'seller', label: 'Vendeurs' },
            { value: 'delivery', label: 'Livreurs' },
          ]}
        />
        <SelectFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'Tous statuts' },
            { value: 'active', label: 'Actifs' },
            { value: 'pending', label: 'En attente' },
            { value: 'rejected', label: 'Rejetés' },
            { value: 'suspended', label: 'Suspendus' },
          ]}
        />

        {/* stat pills */}
        {!loading && (
          <div className="flex gap-2 ml-auto text-xs">
            {['buyer','seller','delivery'].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                className="px-2.5 py-1 rounded-full border font-medium transition-colors"
                style={{
                  background: typeFilter === t ? '#0d1f38' : 'white',
                  color:      typeFilter === t ? 'white'    : '#64748b',
                  borderColor: typeFilter === t ? '#0d1f38'  : '#e2e8f0',
                }}
              >
                {TYPE_LABELS[t]} · {orgs.filter(o => o.org_type === t).length}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50/60">
              <th className="text-left font-medium px-5 py-3">Organisation</th>
              <th className="text-left font-medium py-3">Type</th>
              <th className="text-left font-medium py-3">Statut</th>
              <th className="text-left font-medium py-3 hidden md:table-cell">
                <span className="flex items-center gap-1"><MapPin size={11} /> Ville</span>
              </th>
              <th className="text-right font-medium px-5 py-3">
                <span className="flex items-center gap-1 justify-end"><Calendar size={11} /> Inscription</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[5,3,3,3,3].map((w, j) => (
                    <td key={j} className={`${j === 0 ? 'px-5' : ''} ${j === 4 ? 'px-5' : ''} py-3 ${j === 3 ? 'hidden md:table-cell' : ''}`}>
                      <div className={`h-4 w-${w * 8} bg-gray-100 rounded animate-pulse ${j === 4 ? 'ml-auto' : ''}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                  <Building2 size={28} className="mx-auto mb-2 text-gray-300" />
                  Aucune organisation trouvée
                </td>
              </tr>
            ) : (
              filtered.map(org => (
                <tr
                  key={org.id}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(org)}
                >
                  <td className="px-5 py-3 font-medium text-gray-900">{org.name}</td>
                  <td className="py-3"><TypeBadge type={org.org_type} /></td>
                  <td className="py-3"><StatusBadge status={org.validation_status} /></td>
                  <td className="py-3 text-gray-500 hidden md:table-cell">{org.city ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">
                    {new Date(org.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Detail modal ───────────────────────────────────── */}
      {selected && (
        <Modal
          title={selected.name}
          onClose={() => setSelected(null)}
          footer={
            <>
              {selected.validation_status !== 'active' && (
                <Btn variant="success" onClick={() => setStatus(selected, 'active')} loading={processing} disabled={processing}>
                  <CheckCircle size={13} /> Activer
                </Btn>
              )}
              {selected.validation_status === 'active' && (
                <Btn variant="warning" onClick={() => setStatus(selected, 'suspended')} loading={processing} disabled={processing}>
                  Suspendre
                </Btn>
              )}
              {selected.validation_status !== 'rejected' && (
                <Btn variant="danger" onClick={() => setStatus(selected, 'rejected')} loading={processing} disabled={processing}>
                  <XCircle size={13} /> Rejeter
                </Btn>
              )}
              <Btn onClick={() => { setSelected(null); openEdit(selected); }}>
                <Edit2 size={13} /> Modifier
              </Btn>
              <Btn onClick={() => setSelected(null)}>Fermer</Btn>
            </>
          }
        >
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-100 mb-5">
            {(['info', 'members'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'info' ? 'Informations' : `Membres (${members.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Raison sociale',   value: selected.name },
                { label: 'Type',             value: <TypeBadge type={selected.org_type} /> },
                { label: 'Statut',           value: <StatusBadge status={selected.validation_status} /> },
                { label: 'Sous-type',        value: selected.sub_type ?? '—' },
                { label: 'Pays',             value: selected.country ?? '—' },
                { label: 'Ville',            value: selected.city ?? '—' },
                { label: 'Région',           value: selected.region ?? '—' },
                { label: 'Code postal',      value: selected.postal_code ?? '—' },
                { label: 'Adresse',          value: selected.address_line1 ?? '—' },
                { label: 'ICE / SIRET',      value: selected.siret ?? '—' },
                { label: 'N° TVA',           value: selected.vat_number ?? '—' },
                { label: 'Inscription',      value: new Date(selected.created_at).toLocaleDateString('fr-FR') },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
                  <div className="text-gray-800 font-medium">{value}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              {loadingMembers ? (
                <div className="space-y-3">
                  {[1,2].map(i => (
                    <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400 text-sm">
                  <Users size={24} className="mb-2 text-gray-300" />
                  Aucun membre
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map(m => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User size={14} className="text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {m.profiles?.full_name ?? 'Utilisateur inconnu'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{m.profiles?.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
                          {ROLE_LABELS[m.team_role] ?? m.team_role}
                        </span>
                        {!m.active && (
                          <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Inactif</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Edit modal ─────────────────────────────────────── */}
      {editOrg && (
        <Modal
          title={`Modifier — ${editOrg.name}`}
          onClose={() => setEditOrg(null)}
          footer={
            <>
              <Btn onClick={() => setEditOrg(null)}>Annuler</Btn>
              <Btn variant="primary" onClick={saveEdit} loading={saving} disabled={saving}>
                Enregistrer
              </Btn>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Raison sociale">
                <Input value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
              </Field>
            </div>
            <Field label="Sous-type">
              <Input value={editForm.sub_type} onChange={v => setEditForm(f => ({ ...f, sub_type: v }))} placeholder="ex. restaurant, supermarché…" />
            </Field>
            <Field label="Pays">
              <Input value={editForm.country} onChange={v => setEditForm(f => ({ ...f, country: v }))} placeholder="MA" />
            </Field>
            <Field label="ICE / SIRET">
              <Input value={editForm.siret} onChange={v => setEditForm(f => ({ ...f, siret: v }))} />
            </Field>
            <Field label="N° TVA">
              <Input value={editForm.vat_number} onChange={v => setEditForm(f => ({ ...f, vat_number: v }))} />
            </Field>
            <div className="col-span-2">
              <Field label="Adresse">
                <Input value={editForm.address_line1} onChange={v => setEditForm(f => ({ ...f, address_line1: v }))} />
              </Field>
            </div>
            <Field label="Ville">
              <Input value={editForm.city} onChange={v => setEditForm(f => ({ ...f, city: v }))} />
            </Field>
            <Field label="Code postal">
              <Input value={editForm.postal_code} onChange={v => setEditForm(f => ({ ...f, postal_code: v }))} />
            </Field>
            <div className="col-span-2">
              <Field label="Région">
                <Input value={editForm.region} onChange={v => setEditForm(f => ({ ...f, region: v }))} />
              </Field>
            </div>
          </div>
          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
