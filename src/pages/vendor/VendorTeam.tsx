import { useEffect, useState } from 'react';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  Badge,
  Box,
  Modal,
  FormField,
  Input,
  Select,
  Alert,
  StatusIndicator,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { OrgMember } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin_seller: 'Admin vendeur',
  catalog_manager: 'Gestionnaire catalogue',
  marketing_manager: 'Responsable marketing',
  sales_rep: 'Commercial',
  delivery_coordinator: 'Coordinateur livraison',
  member: 'Membre',
};

interface MemberWithProfile extends OrgMember {
  profiles?: { full_name: string | null; preferred_lang: string };
  auth_user?: { email: string };
}

export default function VendorTeam() {
  const { activeOrg, user } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string | null }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState('member');
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function fetchMembers() {
    if (!activeOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('organisation_members')
      .select('*, profiles(full_name, preferred_lang)')
      .eq('organisation_id', activeOrg.id)
      .eq('active', true);
    setMembers((data as MemberWithProfile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchMembers(); }, [activeOrg]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedUserId(null);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `%${searchQuery.trim()}%`)
      .limit(5);
    setSearchResults((data as { id: string; full_name: string | null }[]) ?? []);
    setSearching(false);
  }

  async function handleInvite() {
    if (!activeOrg || !selectedUserId) return;
    setInviting(true);
    setError('');
    setSuccess('');
    const { error: err } = await supabase.from('organisation_members').insert({
      organisation_id: activeOrg.id,
      user_id: selectedUserId,
      team_role: inviteRole,
      active: true,
    });
    if (err) {
      setError(err.code === '23505' ? 'Cet utilisateur est déjà membre de votre organisation.' : err.message);
    } else {
      const name = searchResults.find((r) => r.id === selectedUserId)?.full_name ?? selectedUserId;
      setSuccess(`${name} ajouté avec le rôle ${ROLE_LABELS[inviteRole]}.`);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUserId(null);
      setInviteRole('member');
      fetchMembers();
    }
    setInviting(false);
  }

  async function handleRemove(memberId: string) {
    await supabase
      .from('organisation_members')
      .update({ active: false })
      .eq('id', memberId);
    fetchMembers();
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    await supabase
      .from('organisation_members')
      .update({ team_role: newRole })
      .eq('id', memberId);
    fetchMembers();
  }

  return (
    <SpaceBetween size="l">
      <Table
        header={
          <Header
            variant="h1"
            counter={`(${members.length})`}
            actions={
              <Button variant="primary" onClick={() => setShowInvite(true)}>
                + Inviter un membre
              </Button>
            }
          >
            Gestion de l'équipe
          </Header>
        }
        loading={loading}
        loadingText="Chargement..."
        trackBy="id"
        items={members}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Membre',
            cell: (m: MemberWithProfile) => m.profiles?.full_name ?? m.user_id,
          },
          {
            id: 'role',
            header: 'Rôle',
            cell: (m: MemberWithProfile) => (
              <Badge color={m.team_role === 'owner' ? 'red' : m.team_role === 'admin_seller' ? 'blue' : 'grey'}>
                {ROLE_LABELS[m.team_role] ?? m.team_role}
              </Badge>
            ),
          },
          {
            id: 'joined',
            header: 'Membre depuis',
            cell: (m: MemberWithProfile) => new Date(m.joined_at).toLocaleDateString('fr-FR'),
          },
          {
            id: 'status',
            header: 'Statut',
            cell: () => (
              <StatusIndicator type="success">Actif</StatusIndicator>
            ),
          },
          {
            id: 'change_role',
            header: 'Modifier le rôle',
            cell: (m: MemberWithProfile) =>
              m.team_role !== 'owner' && m.user_id !== user?.id ? (
                <Select
                  selectedOption={{ value: m.team_role, label: ROLE_LABELS[m.team_role] ?? m.team_role }}
                  onChange={({ detail }) => handleRoleChange(m.id, detail.selectedOption.value ?? m.team_role)}
                  options={Object.entries(ROLE_LABELS)
                    .filter(([k]) => k !== 'owner')
                    .map(([value, label]) => ({ value, label }))}
                />
              ) : (
                <Box color="text-body-secondary">—</Box>
              ),
            minWidth: 200,
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (m: MemberWithProfile) =>
              m.team_role !== 'owner' && m.user_id !== user?.id ? (
                <Button
                  variant="inline-link"
                  onClick={() => handleRemove(m.id)}
                >
                  Retirer
                </Button>
              ) : null,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucun membre</b>
          </Box>
        }
      />

      <Modal
        visible={showInvite}
        onDismiss={() => { setShowInvite(false); setError(''); setSuccess(''); setSearchResults([]); setSelectedUserId(null); setSearchQuery(''); }}
        header="Ajouter un membre"
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowInvite(false)}>Annuler</Button>
              <Button variant="primary" loading={inviting} onClick={handleInvite} disabled={!selectedUserId}>
                Ajouter au compte
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <FormField
            label="Rechercher par nom complet"
            description="L'utilisateur doit déjà avoir un compte sur la plateforme."
          >
            <SpaceBetween direction="horizontal" size="xs">
              <Input
                value={searchQuery}
                onChange={({ detail }) => setSearchQuery(detail.value)}
                placeholder="Ex: Mohamed Alami"
              />
              <Button onClick={handleSearch} loading={searching} iconName="search">
                Rechercher
              </Button>
            </SpaceBetween>
          </FormField>

          {searchResults.length > 0 && (
            <FormField label="Résultats">
              <SpaceBetween size="xs">
                {searchResults.map((r) => (
                  <Box
                    key={r.id}
                    padding="s"
                    color={selectedUserId === r.id ? 'text-status-info' : 'inherit'}
                  >
                    <Button
                      variant={selectedUserId === r.id ? 'primary' : 'normal'}
                      onClick={() => setSelectedUserId(r.id)}
                    >
                      {r.full_name ?? r.id}
                    </Button>
                  </Box>
                ))}
              </SpaceBetween>
            </FormField>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <Box color="text-body-secondary">Aucun utilisateur trouvé pour « {searchQuery} ».</Box>
          )}

          <FormField label="Rôle à attribuer">
            <Select
              selectedOption={{ value: inviteRole, label: ROLE_LABELS[inviteRole] }}
              onChange={({ detail }) => setInviteRole(detail.selectedOption.value ?? 'member')}
              options={Object.entries(ROLE_LABELS)
                .filter(([k]) => k !== 'owner')
                .map(([value, label]) => ({ value, label }))}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
