import { useEffect, useState, useCallback } from 'react';
import {
  Tabs, Table, Header, Button, SpaceBetween, Box,
  FormField, Select, Textarea, Modal,
  Badge, StatusIndicator, Alert, Flashbar,
  ColumnLayout, Container, KeyValuePairs, Toggle,
  ExpandableSection,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { AdminTeamMember, AdminRole } from '../../types';
import {
  PERMISSION_GROUPS, ROLE_DEFAULT_PERMS, ALL_PERMISSION_KEYS,
  effectivePermissions, computeOverrides,
} from '../../lib/adminPermissions';

// ── Role meta ─────────────────────────────────────────────────────────────────
const ROLE_META: Record<AdminRole, {
  label: string;
  badge: 'red' | 'blue' | 'green' | 'grey' | 'severity-medium';
  desc: string;
}> = {
  superadmin:    { label: 'Super Admin',          badge: 'red',             desc: 'Accès illimité — gestion complète de la plateforme et de l\'équipe.' },
  moderator:     { label: 'Modérateur',           badge: 'blue',            desc: 'Orgs, produits, commandes, litiges, catégories. Pas de finances ni paramètres.' },
  finance_admin: { label: 'Finance',              badge: 'green',           desc: 'Finances, CA, exports. Accès limité aux commandes et audit.' },
  support:       { label: 'Support',              badge: 'severity-medium', desc: 'Commandes, litiges, organisations (lecture). Aide aux utilisateurs.' },
  data_viewer:   { label: 'Analyste / Lecture',   badge: 'grey',            desc: 'Lecture seule sur toutes les données. Pas d\'action possible.' },
};

const ROLE_OPTIONS = (Object.keys(ROLE_META) as AdminRole[]).map((r) => ({
  label: ROLE_META[r].label,
  value: r,
}));

// ── PermissionEditor — visual per-member permission matrix ───────────────────
interface PermissionEditorProps {
  role: AdminRole;
  overrides: Record<string, boolean>;
  onChange: (overrides: Record<string, boolean>) => void;
  readOnly?: boolean;
}

function PermissionEditor({ role, overrides, onChange, readOnly }: PermissionEditorProps) {
  const roleDefaults = new Set(ROLE_DEFAULT_PERMS[role] ?? []);
  const effective = effectivePermissions(role, overrides);

  function toggle(key: string) {
    if (readOnly) return;
    const currentlyGranted = effective.has(key);
    const inDefault = roleDefaults.has(key);
    const newGranted = !currentlyGranted;
    // If new state matches role default → remove override (keep inherited)
    const newOverrides = { ...overrides };
    if (newGranted === inDefault) {
      delete newOverrides[key];
    } else {
      newOverrides[key] = newGranted;
    }
    onChange(newOverrides);
  }

  const grantedCount = effective.size;
  const customCount  = Object.keys(overrides).length;

  return (
    <SpaceBetween size="s">
      <Box color="text-body-secondary" fontSize="body-s">
        {grantedCount} / {ALL_PERMISSION_KEYS.length} permissions accordées
        {customCount > 0 && ` · ${customCount} override${customCount > 1 ? 's' : ''} personnalisé${customCount > 1 ? 's' : ''}`}
      </Box>

      {PERMISSION_GROUPS.map((group) => (
        <ExpandableSection
          key={group.id}
          headerText={
            `${group.label} — ${group.permissions.filter((p) => effective.has(p.key)).length} / ${group.permissions.length}`
          }
          defaultExpanded={role === 'superadmin' ? false : group.permissions.some((p) => overrides[p.key] !== undefined)}
        >
          <SpaceBetween size="xs">
            {group.permissions.map((perm) => {
              const granted    = effective.has(perm.key);
              const inDefault  = roleDefaults.has(perm.key);
              const isOverride = overrides[perm.key] !== undefined;

              const stateLabel = isOverride
                ? (overrides[perm.key] ? 'ajouté manuellement' : 'retiré manuellement')
                : (inDefault ? 'hérité du rôle' : 'non accordé');

              return (
                <div
                  key={perm.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: isOverride
                      ? (overrides[perm.key] ? '#f0fdf4' : '#fff1f1')
                      : 'transparent',
                    border: isOverride ? `1px solid ${overrides[perm.key] ? '#bbf7d0' : '#fecaca'}` : '1px solid transparent',
                  }}
                >
                  <div style={{ marginTop: '2px' }}>
                    <Toggle
                      checked={granted}
                      onChange={() => toggle(perm.key)}
                      disabled={readOnly || role === 'superadmin'}
                    >
                      {''}
                    </Toggle>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Box fontWeight={isOverride ? 'bold' : 'normal'} fontSize="body-s">
                      {perm.label}
                    </Box>
                    <Box color="text-body-secondary" fontSize="body-s">{perm.desc}</Box>
                    <Box fontSize="body-s" margin={{ top: 'xxs' }}>
                      <Badge
                        color={
                          isOverride
                            ? (overrides[perm.key] ? 'green' : 'red')
                            : inDefault ? 'grey' : 'grey'
                        }
                      >
                        {stateLabel}
                      </Badge>
                      {!readOnly && isOverride && (
                        <Button
                          variant="inline-link"
                          onClick={() => {
                            const n = { ...overrides };
                            delete n[perm.key];
                            onChange(n);
                          }}
                        >
                          Réinitialiser
                        </Button>
                      )}
                    </Box>
                  </div>
                </div>
              );
            })}
          </SpaceBetween>
        </ExpandableSection>
      ))}

      {role === 'superadmin' && (
        <Alert type="info">
          Le Super Admin dispose de toutes les permissions sans restriction. Les overrides ne s'appliquent pas.
        </Alert>
      )}
    </SpaceBetween>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminTeam() {
  const { user } = useAuth();
  const [members,     setMembers]     = useState<AdminTeamMember[]>([]);
  const [myRole,      setMyRole]      = useState<AdminRole | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  // Add member
  const [addOpen,     setAddOpen]     = useState(false);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [newUserId,   setNewUserId]   = useState('');
  const [newRole,     setNewRole]     = useState<AdminRole>('support');
  const [newNotes,    setNewNotes]    = useState('');
  const [newOverrides, setNewOverrides] = useState<Record<string, boolean>>({});
  const [searching,   setSearching]   = useState(false);

  // Edit member
  const [editTarget,   setEditTarget]   = useState<AdminTeamMember | null>(null);
  const [editRole,     setEditRole]     = useState<AdminRole>('support');
  const [editNotes,    setEditNotes]    = useState('');
  const [editOverrides, setEditOverrides] = useState<Record<string, boolean>>({});

  // Revoke
  const [revokeTarget, setRevokeTarget] = useState<AdminTeamMember | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────
  const loadTeam = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('admin_team')
      .select('*, profiles!user_id(full_name, email)')
      .order('granted_at', { ascending: false });

    if (err) { setError(err.message); setLoading(false); return; }

    const team = (data as (AdminTeamMember & { permissions?: Record<string, boolean> })[]) ?? [];
    setMembers(team as AdminTeamMember[]);
    const me = team.find((m) => m.user_id === user?.id && m.active);
    setMyRole(me?.role ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  async function loadAllProfiles() {
    setSearching(true);
    const { data } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
    setAllProfiles((data as { id: string; full_name: string | null; email: string | null }[]) ?? []);
    setSearching(false);
  }

  // ── Add member ──────────────────────────────────────────────────────────
  async function handleAddMember() {
    if (!newUserId) { setError('Sélectionnez un utilisateur.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await supabase.from('profiles').update({ is_admin: true }).eq('id', newUserId);
      const { error: err } = await supabase.from('admin_team').upsert({
        user_id:     newUserId,
        role:        newRole,
        granted_by:  user?.id,
        notes:       newNotes || null,
        active:      true,
        permissions: computeOverrides(newRole, Object.fromEntries(
          ALL_PERMISSION_KEYS.map((k) => [k, newOverrides[k] ?? effectivePermissions(newRole, {}).has(k)])
        )),
      }, { onConflict: 'user_id' });
      if (err) throw err;
      setSuccess('Membre ajouté avec succès.');
      setAddOpen(false); setNewUserId(''); setNewNotes(''); setNewRole('support'); setNewOverrides({});
      loadTeam();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'ajout.');
    } finally { setSaving(false); }
  }

  // ── Save edit ───────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const { error: err } = await supabase
        .from('admin_team')
        .update({
          role:        editRole,
          notes:       editNotes || null,
          permissions: editOverrides,
        })
        .eq('id', editTarget.id);
      if (err) throw err;
      setSuccess(`Permissions de ${editTarget.profiles?.full_name ?? 'membre'} mises à jour.`);
      setEditTarget(null);
      loadTeam();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally { setSaving(false); }
  }

  // ── Revoke ──────────────────────────────────────────────────────────────
  async function handleRevoke() {
    if (!revokeTarget) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await supabase.from('admin_team').update({ active: false }).eq('id', revokeTarget.id);
      await supabase.from('profiles').update({ is_admin: false }).eq('id', revokeTarget.user_id);
      setSuccess(`Accès révoqué — ${revokeTarget.profiles?.full_name ?? 'membre'}.`);
      setRevokeTarget(null);
      loadTeam();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la révocation.');
    } finally { setSaving(false); }
  }

  function openEdit(m: AdminTeamMember) {
    setEditTarget(m);
    setEditRole(m.role);
    setEditNotes(m.notes ?? '');
    // Cast to access permissions (not in base type — comes from DB extra column)
    setEditOverrides((m as any).permissions ?? {});
  }

  const isSuperAdmin = myRole === 'superadmin';

  // Count granted perms for a member
  function grantedCount(m: AdminTeamMember) {
    const eff = effectivePermissions(m.role, (m as any).permissions ?? {});
    return eff.size;
  }

  const profilesNotAlreadyAdmin = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id && m.active),
  );

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="Définissez précisément qui peut faire quoi sur la plateforme Stock212."
        actions={
          isSuperAdmin ? (
            <Button variant="primary" onClick={() => { loadAllProfiles(); setAddOpen(true); }}>
              + Ajouter un membre
            </Button>
          ) : undefined
        }
      >
        Équipe d'administration & Permissions
      </Header>

      {error   && <Flashbar items={[{ type: 'error',   content: error,   dismissible: true, onDismiss: () => setError('')   }]} />}
      {success && <Flashbar items={[{ type: 'success', content: success, dismissible: true, onDismiss: () => setSuccess('') }]} />}

      {!isSuperAdmin && !loading && myRole && (
        <Alert type="info" header={`Votre rôle : ${ROLE_META[myRole].label}`}>
          {ROLE_META[myRole].desc} — Seul le Super Admin peut modifier les membres et les permissions.
        </Alert>
      )}

      <Tabs
        tabs={[

          // ── Tab 1 : Membres ─────────────────────────────────────────
          {
            id: 'members',
            label: `Membres (${members.filter((m) => m.active).length})`,
            content: (
              <SpaceBetween size="l">
                <Table
                  header={<Header variant="h2" counter={`(${members.filter((m) => m.active).length} actifs)`}>Équipe active</Header>}
                  loading={loading}
                  loadingText="Chargement…"
                  trackBy="id"
                  items={members.filter((m) => m.active)}
                  columnDefinitions={[
                    {
                      id: 'member',
                      header: 'Membre',
                      cell: (m) => (
                        <SpaceBetween size="xxs">
                          <Box fontWeight="bold">{m.profiles?.full_name ?? '—'}</Box>
                          <Box color="text-body-secondary" fontSize="body-s">{m.profiles?.email ?? m.user_id.slice(0, 8) + '…'}</Box>
                        </SpaceBetween>
                      ),
                    },
                    {
                      id: 'role',
                      header: 'Rôle',
                      cell: (m) => <Badge color={ROLE_META[m.role].badge}>{ROLE_META[m.role].label}</Badge>,
                    },
                    {
                      id: 'permissions',
                      header: 'Permissions',
                      cell: (m) => {
                        const granted = grantedCount(m);
                        const hasOverrides = Object.keys((m as any).permissions ?? {}).length > 0;
                        return (
                          <SpaceBetween size="xxs" direction="horizontal">
                            <Box fontSize="body-s">{granted} / {ALL_PERMISSION_KEYS.length}</Box>
                            {hasOverrides && <Badge color="blue">Personnalisées</Badge>}
                          </SpaceBetween>
                        );
                      },
                    },
                    {
                      id: 'notes',
                      header: 'Notes',
                      cell: (m) => <Box color="text-body-secondary" fontSize="body-s">{m.notes ?? '—'}</Box>,
                    },
                    {
                      id: 'since',
                      header: 'Depuis',
                      cell: (m) => new Date(m.granted_at).toLocaleDateString('fr-FR'),
                    },
                    {
                      id: 'actions',
                      header: '',
                      cell: (m) => {
                        if (m.user_id === user?.id) return <Box color="text-body-secondary" fontSize="body-s">Vous</Box>;
                        if (!isSuperAdmin) return null;
                        return (
                          <SpaceBetween direction="horizontal" size="xs">
                            <Button variant="inline-link" onClick={() => openEdit(m)}>Modifier</Button>
                            <Button variant="inline-link" onClick={() => setRevokeTarget(m)}>Révoquer</Button>
                          </SpaceBetween>
                        );
                      },
                    },
                  ]}
                  empty={
                    <Box textAlign="center" padding="xl">
                      <b>Aucun membre</b>
                      <Box color="text-body-secondary">Ajoutez un superadmin via SQL Editor Supabase.</Box>
                    </Box>
                  }
                />

                {members.some((m) => !m.active) && (
                  <Table
                    header={<Header variant="h2" counter={`(${members.filter((m) => !m.active).length})`}>Accès révoqués</Header>}
                    trackBy="id"
                    items={members.filter((m) => !m.active)}
                    columnDefinitions={[
                      { id: 'member', header: 'Membre', cell: (m) => <Box color="text-body-secondary">{m.profiles?.full_name ?? m.user_id}</Box> },
                      { id: 'role',   header: 'Ancien rôle', cell: (m) => ROLE_META[m.role]?.label ?? m.role },
                      { id: 'status', header: 'Statut', cell: () => <StatusIndicator type="stopped">Révoqué</StatusIndicator> },
                      ...(isSuperAdmin ? [{
                        id: 'restore',
                        header: '',
                        cell: (m: AdminTeamMember) => (
                          <Button variant="inline-link" onClick={async () => {
                            await supabase.from('admin_team').update({ active: true }).eq('id', m.id);
                            await supabase.from('profiles').update({ is_admin: true }).eq('id', m.user_id);
                            loadTeam();
                          }}>Restaurer</Button>
                        ),
                      }] : []),
                    ]}
                    empty={<Box />}
                  />
                )}
              </SpaceBetween>
            ),
          },

          // ── Tab 2 : Rôles & Templates ───────────────────────────────
          {
            id: 'roles',
            label: 'Rôles & Modèles de permissions',
            content: (
              <SpaceBetween size="l">
                <Alert type="info">
                  Ces modèles définissent les permissions par défaut de chaque rôle.
                  Le Super Admin peut ensuite ajouter des overrides par membre dans l'onglet "Membres".
                </Alert>
                <ColumnLayout columns={2}>
                  {(Object.keys(ROLE_META) as AdminRole[]).map((role) => {
                    const defaults = new Set(ROLE_DEFAULT_PERMS[role]);
                    const grantedGroups = PERMISSION_GROUPS.map((g) => ({
                      ...g,
                      granted: g.permissions.filter((p) => defaults.has(p.key)),
                      denied:  g.permissions.filter((p) => !defaults.has(p.key)),
                    }));

                    return (
                      <Container
                        key={role}
                        header={
                          <Header
                            variant="h3"
                            description={ROLE_META[role].desc}
                          >
                            <Badge color={ROLE_META[role].badge}>{ROLE_META[role].label}</Badge>
                            {' '}— {defaults.size} / {ALL_PERMISSION_KEYS.length} permissions
                          </Header>
                        }
                      >
                        <SpaceBetween size="xs">
                          {grantedGroups.map((g) => (
                            g.granted.length > 0 && (
                              <div key={g.id}>
                                <Box fontWeight="bold" fontSize="body-s" color="text-label">{g.label}</Box>
                                <SpaceBetween size="xxs" direction="vertical">
                                  {g.granted.map((p) => (
                                    <Box key={p.key} fontSize="body-s">
                                      <span style={{ color: '#15803d' }}>✓</span> {p.label}
                                    </Box>
                                  ))}
                                  {g.denied.map((p) => (
                                    <Box key={p.key} fontSize="body-s" color="text-body-secondary">
                                      <span style={{ color: '#dc2626' }}>✗</span> {p.label}
                                    </Box>
                                  ))}
                                </SpaceBetween>
                              </div>
                            )
                          ))}
                        </SpaceBetween>
                      </Container>
                    );
                  })}
                </ColumnLayout>
              </SpaceBetween>
            ),
          },

          // ── Tab 3 : Matrice comparaison ─────────────────────────────
          {
            id: 'matrix',
            label: 'Matrice complète',
            content: (
              <SpaceBetween size="s">
                <Alert type="info" dismissible>
                  Vue comparée de toutes les permissions par rôle.
                  Les cases vertes = accordée par défaut. Rouge = refusée.
                </Alert>
                {PERMISSION_GROUPS.map((group) => (
                  <Container key={group.id} header={<Header variant="h3">{group.label}</Header>}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e2e8f0', minWidth: '240px' }}>Permission</th>
                            {(Object.keys(ROLE_META) as AdminRole[]).map((r) => (
                              <th key={r} style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '110px' }}>
                                <Badge color={ROLE_META[r].badge}>{ROLE_META[r].label}</Badge>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.permissions.map((perm, i) => (
                            <tr key={perm.key} style={{ background: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                              <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>
                                <Box fontWeight="bold" fontSize="body-s">{perm.label}</Box>
                                <Box color="text-body-secondary" fontSize="body-s">{perm.desc}</Box>
                              </td>
                              {(Object.keys(ROLE_META) as AdminRole[]).map((role) => {
                                const granted = ROLE_DEFAULT_PERMS[role].includes(perm.key);
                                return (
                                  <td key={role} style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      width: '24px', height: '24px',
                                      borderRadius: '50%',
                                      background: granted ? '#dcfce7' : '#fee2e2',
                                      color: granted ? '#15803d' : '#dc2626',
                                      lineHeight: '24px',
                                      fontWeight: 'bold',
                                      fontSize: '14px',
                                    }}>
                                      {granted ? '✓' : '✗'}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Container>
                ))}
              </SpaceBetween>
            ),
          },
        ]}
      />

      {/* ── Add Member Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={addOpen}
        onDismiss={() => setAddOpen(false)}
        size="large"
        header="Ajouter un membre à l'équipe d'administration"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setAddOpen(false)}>Annuler</Button>
              <Button variant="primary" onClick={handleAddMember} loading={saving} disabled={!newUserId}>
                Ajouter
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning">L'utilisateur aura accès immédiat au panneau d'administration.</Alert>

          <FormField label="Utilisateur *">
            <Select
              statusType={searching ? 'loading' : 'finished'}
              loadingText="Chargement des utilisateurs…"
              selectedOption={
                newUserId
                  ? (() => {
                      const p = allProfiles.find((x) => x.id === newUserId);
                      return p ? { label: `${p.full_name ?? '?'} — ${p.email ?? ''}`, value: p.id } : null;
                    })()
                  : null
              }
              options={profilesNotAlreadyAdmin.map((p) => ({
                label: `${p.full_name ?? '(Sans nom)'} — ${p.email ?? p.id.slice(0, 8)}`,
                value: p.id,
              }))}
              onChange={({ detail }) => setNewUserId(detail.selectedOption.value ?? '')}
              placeholder="Rechercher un utilisateur…"
              filteringType="auto"
            />
          </FormField>

          <FormField label="Rôle *">
            <Select
              selectedOption={{ label: ROLE_META[newRole].label, value: newRole }}
              options={ROLE_OPTIONS}
              onChange={({ detail }) => {
                setNewRole((detail.selectedOption.value ?? 'support') as AdminRole);
                setNewOverrides({});
              }}
            />
          </FormField>

          <FormField label="Notes (optionnel)">
            <Textarea value={newNotes} onChange={({ detail }) => setNewNotes(detail.value)} rows={2}
              placeholder="Raison de l'accès, durée prévue, responsable…" />
          </FormField>

          <ExpandableSection headerText="Personnaliser les permissions (optionnel)">
            <PermissionEditor
              role={newRole}
              overrides={newOverrides}
              onChange={setNewOverrides}
            />
          </ExpandableSection>
        </SpaceBetween>
      </Modal>

      {/* ── Edit Member Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={!!editTarget}
        onDismiss={() => setEditTarget(null)}
        size="large"
        header={`Modifier les permissions — ${editTarget?.profiles?.full_name ?? 'Membre'}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditTarget(null)}>Annuler</Button>
              <Button variant="primary" onClick={handleSaveEdit} loading={saving}>Enregistrer</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <KeyValuePairs
            columns={3}
            items={[
              { label: 'Utilisateur', value: editTarget?.profiles?.full_name ?? '—' },
              { label: 'Email',       value: editTarget?.profiles?.email ?? '—'     },
              { label: 'Membre depuis', value: editTarget ? new Date(editTarget.granted_at).toLocaleDateString('fr-FR') : '—' },
            ]}
          />

          <ColumnLayout columns={2}>
            <FormField label="Rôle">
              <Select
                selectedOption={{ label: ROLE_META[editRole].label, value: editRole }}
                options={ROLE_OPTIONS}
                onChange={({ detail }) => {
                  setEditRole((detail.selectedOption.value ?? 'support') as AdminRole);
                  setEditOverrides({});
                }}
              />
            </FormField>
            <FormField label="Notes">
              <Textarea value={editNotes} onChange={({ detail }) => setEditNotes(detail.value)} rows={2} />
            </FormField>
          </ColumnLayout>

          <Alert type="info">{ROLE_META[editRole].desc}</Alert>

          <Box>
            <Box fontWeight="bold" margin={{ bottom: 's' }}>Permissions de ce membre</Box>
            <PermissionEditor
              role={editRole}
              overrides={editOverrides}
              onChange={setEditOverrides}
            />
          </Box>

          {Object.keys(editOverrides).length > 0 && (
            <Button
              variant="link"
              onClick={() => setEditOverrides({})}
            >
              Réinitialiser toutes les permissions au rôle par défaut
            </Button>
          )}
        </SpaceBetween>
      </Modal>

      {/* ── Revoke Confirm Modal ───────────────────────────────────────────── */}
      <Modal
        visible={!!revokeTarget}
        onDismiss={() => setRevokeTarget(null)}
        header="Confirmer la révocation"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setRevokeTarget(null)}>Annuler</Button>
              <Button variant="primary" onClick={handleRevoke} loading={saving}>Révoquer l'accès</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          L'accès de <strong>{revokeTarget?.profiles?.full_name ?? 'ce membre'}</strong> sera immédiatement
          révoqué. L'historique et les permissions seront conservés pour l'audit.
        </Alert>
      </Modal>
    </SpaceBetween>
  );
}
