import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, Badge,
  Input, Textarea, SimpleGrid, Divider, useToast, Avatar, Spinner,
} from '@chakra-ui/react';
import {
  ArrowLeft, Building2, MapPin, Users, Edit3, Plus, Trash2,
  CheckCircle, Shield, UserCheck, Eye, Save, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558', amber: '#c97d1a',
  amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b', border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#15803d', greenLight: '#dcfce7', greenBorder: '#86efac',
  red: '#be1c1c', redLight: '#fff1f1',
};

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRole = 'owner' | 'orders' | 'read';
interface OrgMemberRow {
  id: string; userId: string; name: string; email: string;
  role: UserRole; joined_at: string;
}
interface DeliveryAddress {
  id: string; label: string; street: string;
  city: string; region: string; phone: string; is_default: boolean;
}

const REGIONS = ['Grand Casablanca', 'Rabat-Salé-Kénitra', 'Marrakech-Safi', 'Fès-Meknès', 'Tanger-Tétouan-Al Hoceima', 'Souss-Massa', "L'Oriental", 'Béni Mellal-Khénifra', 'Drâa-Tafilalet', 'Guelmim-Oued Noun', 'Laâyoune-Sakia El Hamra', 'Dakhla-Oued Ed-Dahab'];

const ROLE_MAP: Record<UserRole, { label: string; desc: string; bg: string; color: string; border: string; icon: React.ReactNode }> = {
  owner:  { label: 'Propriétaire', desc: 'Accès complet + gestion compte', bg: C.amberLight, color: C.amber, border: C.amberBorder, icon: <Shield size={11} /> },
  orders: { label: 'Commandes',    desc: 'Passer + suivre des commandes',  bg: C.greenLight, color: C.green, border: C.greenBorder, icon: <UserCheck size={11} /> },
  read:   { label: 'Lecture',      desc: 'Consultation seulement',          bg: C.bgAlt,      color: C.muted, border: C.border,     icon: <Eye size={11} /> },
};

// ── Helpers UI ────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <Flex align="center" justify="space-between" mb={4}>
      <HStack spacing={2}>
        <Box w={8} h={8} rounded="lg" display="flex" alignItems="center" justifyContent="center"
          style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}>
          {icon}
        </Box>
        <Text fontWeight="800" fontSize="md" style={{ color: C.navy }}>{title}</Text>
      </HStack>
      {action}
    </Flex>
  );
}

function Field({ label, value, editing, name, onChange, type = 'text' }: {
  label: string; value: string; editing: boolean; name: string;
  onChange: (n: string, v: string) => void; type?: string;
}) {
  return (
    <Box>
      <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.5px"
        style={{ color: C.muted }} mb={1}>{label}</Text>
      {editing ? (
        <Input size="sm" value={value} rounded="lg" fontWeight="600"
          style={{ borderColor: C.border, color: C.navy }} type={type}
          onChange={(e) => onChange(name, e.target.value)} />
      ) : (
        <Text fontWeight="600" fontSize="sm" style={{ color: value ? C.slate : C.muted }}
          fontStyle={value ? 'normal' : 'italic'}>
          {value || 'Non renseigné'}
        </Text>
      )}
    </Box>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MonComptePage() {
  const { user, activeOrg } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loadingData, setLoadingData] = useState(true);

  // Profil légal
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({
    name: '', ice: '', rc: '', patente: '', cnss: '',
    address: '', phone: '', email: user?.email ?? '',
  });
  const [profileOrig, setProfileOrig] = useState({ ...profile });

  // Adresses
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: '', street: '', city: '', region: REGIONS[0], phone: '' });

  // Membres
  const [members, setMembers] = useState<OrgMemberRow[]>([]);

  // ── Chargement initial ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeOrg) return;

    async function load() {
      setLoadingData(true);

      const [orgRes, addrRes, membersRes] = await Promise.all([
        supabase
          .from('organisations')
          .select('name, ice, rc, patente, cnss, phone, address_line1, city, postal_code')
          .eq('id', activeOrg!.id)
          .single(),
        supabase
          .from('buyer_delivery_addresses')
          .select('id, label, street, city, region, phone, is_default')
          .eq('organisation_id', activeOrg!.id)
          .order('is_default', { ascending: false })
          .order('created_at'),
        supabase
          .from('organisation_members')
          .select('id, user_id, team_role, joined_at, profiles(full_name)')
          .eq('organisation_id', activeOrg!.id)
          .eq('active', true),
      ]);

      if (orgRes.data) {
        const o = orgRes.data as Record<string, string | null>;
        const p = {
          name:    o.name    ?? '',
          ice:     o.ice     ?? '',
          rc:      o.rc      ?? '',
          patente: o.patente ?? '',
          cnss:    o.cnss    ?? '',
          phone:   o.phone   ?? '',
          email:   user?.email ?? '',
          address: [o.address_line1, o.city, o.postal_code].filter(Boolean).join(', '),
        };
        setProfile(p);
        setProfileOrig(p);
      }

      setAddresses((addrRes.data as DeliveryAddress[]) ?? []);

      if (membersRes.data) {
        setMembers(
          (membersRes.data as Array<{ id: string; user_id: string; team_role: string; joined_at: string; profiles?: { full_name?: string } | null }>)
            .map((m) => ({
              id:       m.id,
              userId:   m.user_id,
              name:     m.profiles?.full_name ?? 'Utilisateur',
              email:    '',
              role:     (['owner', 'orders', 'read'].includes(m.team_role) ? m.team_role : 'read') as UserRole,
              joined_at: m.joined_at,
            }))
        );
      }

      setLoadingData(false);
    }

    load();
  }, [activeOrg?.id]);

  // ── Sauvegarde profil légal ────────────────────────────────────────────────
  async function saveProfile() {
    if (!activeOrg) return;
    setSavingProfile(true);
    const parts = profile.address.split(',').map((s) => s.trim());
    const { error } = await supabase
      .from('organisations')
      .update({
        name:         profile.name,
        ice:          profile.ice   || null,
        rc:           profile.rc    || null,
        patente:      profile.patente || null,
        cnss:         profile.cnss  || null,
        phone:        profile.phone || null,
        address_line1: parts[0] ?? null,
        city:          parts[1] ?? null,
        postal_code:   parts[2] ?? null,
      })
      .eq('id', activeOrg.id);

    if (error) {
      toast({ title: 'Erreur de sauvegarde', description: error.message, status: 'error', duration: 4000, position: 'top-right' });
    } else {
      setProfileOrig({ ...profile });
      setEditingProfile(false);
      toast({ title: 'Profil mis à jour', status: 'success', duration: 2000, position: 'top-right' });
    }
    setSavingProfile(false);
  }

  function cancelEdit() {
    setProfile({ ...profileOrig });
    setEditingProfile(false);
  }

  // ── Adresses ────────────────────────────────────────────────────────────────
  async function addAddress() {
    if (!activeOrg || !newAddr.label || !newAddr.street) {
      toast({ title: 'Libellé et rue obligatoires', status: 'warning', duration: 2500, position: 'top-right' });
      return;
    }
    setSavingAddr(true);
    const isFirst = addresses.length === 0;
    const { data, error } = await supabase
      .from('buyer_delivery_addresses')
      .insert({
        organisation_id: activeOrg.id,
        label:      newAddr.label,
        street:     newAddr.street,
        city:       newAddr.city,
        region:     newAddr.region,
        phone:      newAddr.phone,
        is_default: isFirst,
      })
      .select('id, label, street, city, region, phone, is_default')
      .single();

    if (error) {
      toast({ title: 'Erreur', description: error.message, status: 'error', duration: 4000, position: 'top-right' });
    } else {
      setAddresses((prev) => [...prev, data as DeliveryAddress]);
      setNewAddr({ label: '', street: '', city: '', region: REGIONS[0], phone: '' });
      setShowAddAddress(false);
      toast({ title: 'Adresse ajoutée', status: 'success', duration: 2000, position: 'top-right' });
    }
    setSavingAddr(false);
  }

  async function removeAddress(id: string) {
    await supabase.from('buyer_delivery_addresses').delete().eq('id', id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  async function setDefault(id: string) {
    if (!activeOrg) return;
    // Unset all, then set chosen
    await supabase
      .from('buyer_delivery_addresses')
      .update({ is_default: false })
      .eq('organisation_id', activeOrg.id);
    await supabase
      .from('buyer_delivery_addresses')
      .update({ is_default: true })
      .eq('id', id);
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <Flex minH="40vh" align="center" justify="center">
        <Spinner size="lg" color="navy" />
      </Flex>
    );
  }

  return (
    <VStack spacing={6} align="stretch">

      {/* ── EN-TÊTE ──────────────────────────────────────────────── */}
      <Box>
        <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
          style={{ color: C.muted }} mb={1} onClick={() => navigate('/buyer')}>
          Tableau de bord
        </Button>
        <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>Mon compte</Heading>
        <Text fontSize="sm" style={{ color: C.muted }}>Profil légal, adresses et gestion des utilisateurs</Text>
      </Box>

      {/* ── PROFIL LÉGAL ──────────────────────────────────────────── */}
      <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
        <SectionHeader
          icon={<Building2 size={15} color={C.slate} />}
          title="Profil légal"
          action={
            editingProfile ? (
              <HStack spacing={2}>
                <Button size="xs" variant="ghost" leftIcon={<X size={11} />}
                  style={{ color: C.muted }} onClick={cancelEdit}>
                  Annuler
                </Button>
                <Button size="xs" fontWeight="700" leftIcon={<Save size={11} />}
                  isLoading={savingProfile}
                  style={{ background: C.navy, color: 'white' }} onClick={saveProfile}>
                  Enregistrer
                </Button>
              </HStack>
            ) : (
              <Button size="xs" variant="outline" fontWeight="600"
                leftIcon={<Edit3 size={11} />}
                style={{ borderColor: C.border, color: C.slate }}
                onClick={() => setEditingProfile(true)}>
                Modifier
              </Button>
            )
          }
        />
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
          <Field label="Raison sociale" value={profile.name}    editing={editingProfile} name="name"    onChange={(n, v) => setProfile((p) => ({ ...p, [n]: v }))} />
          <Field label="ICE"            value={profile.ice}     editing={editingProfile} name="ice"     onChange={(n, v) => setProfile((p) => ({ ...p, [n]: v }))} />
          <Field label="RC"             value={profile.rc}      editing={editingProfile} name="rc"      onChange={(n, v) => setProfile((p) => ({ ...p, [n]: v }))} />
          <Field label="Patente"        value={profile.patente} editing={editingProfile} name="patente" onChange={(n, v) => setProfile((p) => ({ ...p, [n]: v }))} />
          <Field label="CNSS"           value={profile.cnss}    editing={editingProfile} name="cnss"    onChange={(n, v) => setProfile((p) => ({ ...p, [n]: v }))} />
          <Field label="Téléphone"      value={profile.phone}   editing={editingProfile} name="phone"   onChange={(n, v) => setProfile((p) => ({ ...p, [n]: v }))} type="tel" />
          <Field label="Email"          value={profile.email}   editing={false}          name="email"   onChange={() => {}} type="email" />
          <Box gridColumn={{ md: '1 / -1' }}>
            <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.5px"
              style={{ color: C.muted }} mb={1}>Adresse siège</Text>
            {editingProfile ? (
              <Textarea size="sm" value={profile.address} rounded="lg" fontWeight="600" rows={2}
                style={{ borderColor: C.border, color: C.navy }}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
            ) : (
              <Text fontWeight="600" fontSize="sm" style={{ color: profile.address ? C.slate : C.muted }}
                fontStyle={profile.address ? 'normal' : 'italic'}>
                {profile.address || 'Non renseignée'}
              </Text>
            )}
          </Box>
        </SimpleGrid>
      </Box>

      {/* ── ADRESSES LIVRAISON ────────────────────────────────────── */}
      <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
        <SectionHeader
          icon={<MapPin size={15} color={C.slate} />}
          title="Adresses de livraison"
          action={
            <Button size="xs" fontWeight="700" leftIcon={<Plus size={11} />}
              style={{ background: C.navy, color: 'white' }}
              onClick={() => setShowAddAddress(true)}>
              Ajouter
            </Button>
          }
        />

        <VStack spacing={3} align="stretch">
          {addresses.length === 0 && !showAddAddress && (
            <Text fontSize="sm" fontStyle="italic" style={{ color: C.muted }}>
              Aucune adresse enregistrée. Ajoutez-en une pour accélérer le checkout.
            </Text>
          )}

          {addresses.map((addr) => (
            <Box key={addr.id} rounded="xl" px={4} py={3}
              style={{ border: `1.5px solid ${addr.is_default ? C.amberBorder : C.border}`, background: addr.is_default ? C.amberLight : C.bgAlt }}>
              <Flex align="flex-start" justify="space-between">
                <Box flex="1">
                  <HStack spacing={2} mb={0.5}>
                    <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }}>{addr.label}</Text>
                    {addr.is_default && (
                      <Badge rounded="full" px={2} fontSize="10px" fontWeight="700"
                        style={{ background: C.amberBorder, color: '#92400e' }}>
                        Défaut
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="xs" style={{ color: C.muted }}>{addr.street}</Text>
                  <Text fontSize="xs" style={{ color: C.muted }}>{addr.city} — {addr.region}</Text>
                  {addr.phone && <Text fontSize="xs" style={{ color: C.muted }}>{addr.phone}</Text>}
                </Box>
                <HStack spacing={1}>
                  {!addr.is_default && (
                    <Button size="xs" variant="ghost" fontWeight="600"
                      style={{ color: C.amber, fontSize: '11px' }}
                      onClick={() => setDefault(addr.id)}>
                      Définir par défaut
                    </Button>
                  )}
                  {!addr.is_default && (
                    <Box w={6} h={6} rounded="full" cursor="pointer" display="flex" alignItems="center" justifyContent="center"
                      style={{ color: C.red }} onClick={() => removeAddress(addr.id)}>
                      <Trash2 size={11} />
                    </Box>
                  )}
                </HStack>
              </Flex>
            </Box>
          ))}

          {showAddAddress && (
            <Box rounded="xl" p={4} style={{ border: `1.5px dashed ${C.border}`, background: C.bgAlt }}>
              <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }} mb={3}>Nouvelle adresse</Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={3}>
                {[
                  { label: 'Libellé *', key: 'label', placeholder: 'Ex: Entrepôt Nord' },
                  { label: 'Rue *', key: 'street', placeholder: 'N°, Rue, Quartier' },
                  { label: 'Ville', key: 'city', placeholder: 'Casablanca' },
                  { label: 'Téléphone', key: 'phone', placeholder: '+212 ...' },
                ].map(({ label, key, placeholder }) => (
                  <Box key={key}>
                    <Text fontSize="11px" fontWeight="700" style={{ color: C.muted }} mb={1}>{label}</Text>
                    <Input size="sm" rounded="lg" placeholder={placeholder}
                      value={(newAddr as Record<string, string>)[key]}
                      style={{ borderColor: C.border }}
                      onChange={(e) => setNewAddr((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </Box>
                ))}
                <Box>
                  <Text fontSize="11px" fontWeight="700" style={{ color: C.muted }} mb={1}>Région</Text>
                  <Box as="select" w="full" h="32px" rounded="lg" fontSize="sm" px={2}
                    style={{ border: `1px solid ${C.border}`, color: C.slate, background: 'white' }}
                    value={newAddr.region}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewAddr((prev) => ({ ...prev, region: e.target.value }))}>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Box>
                </Box>
              </SimpleGrid>
              <HStack spacing={2}>
                <Button size="sm" fontWeight="700" style={{ background: C.navy, color: 'white' }} rounded="lg"
                  isLoading={savingAddr} onClick={addAddress}>
                  Ajouter
                </Button>
                <Button size="sm" variant="ghost" style={{ color: C.muted }} onClick={() => setShowAddAddress(false)}>
                  Annuler
                </Button>
              </HStack>
            </Box>
          )}
        </VStack>
      </Box>

      {/* ── UTILISATEURS & RÔLES ─────────────────────────────────── */}
      <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
        <SectionHeader
          icon={<Users size={15} color={C.slate} />}
          title="Utilisateurs & rôles"
        />

        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={2} mb={5}>
          {(Object.entries(ROLE_MAP) as [UserRole, typeof ROLE_MAP[UserRole]][]).map(([key, r]) => (
            <Box key={key} rounded="lg" px={3} py={2}
              style={{ background: r.bg, border: `1px solid ${r.border}` }}>
              <HStack spacing={1.5} mb={0.5}>
                <Box style={{ color: r.color }}>{r.icon}</Box>
                <Text fontSize="11px" fontWeight="700" style={{ color: r.color }}>{r.label}</Text>
              </HStack>
              <Text fontSize="10px" style={{ color: C.muted }}>{r.desc}</Text>
            </Box>
          ))}
        </SimpleGrid>

        <Divider style={{ borderColor: C.border }} mb={4} />

        <VStack spacing={3} align="stretch">
          {members.map((m) => {
            const role = ROLE_MAP[m.role] ?? ROLE_MAP.read;
            const isMe = user?.id === m.userId;
            return (
              <Flex key={m.id} align="center" gap={4} px={4} py={3} rounded="xl"
                style={{ border: `1px solid ${C.border}`, background: C.bgAlt }}>
                <Avatar name={m.name} size="sm"
                  style={{ background: C.navy, color: 'white', fontSize: '13px', fontWeight: '700' }} />
                <Box flex="1" minW="120px">
                  <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }}>{m.name}</Text>
                  {isMe && <Text fontSize="xs" style={{ color: C.muted }}>{user?.email}</Text>}
                </Box>
                <Flex align="center" gap={1.5} px={2.5} py={1} rounded="full"
                  style={{ background: role.bg, border: `1px solid ${role.border}` }}>
                  <Box style={{ color: role.color }}>{role.icon}</Box>
                  <Text fontSize="11px" fontWeight="700" style={{ color: role.color }}>{role.label}</Text>
                </Flex>
                {isMe && (
                  <Box px={2} py={0.5} rounded="full"
                    style={{ background: C.greenLight, border: `1px solid ${C.greenBorder}` }}>
                    <HStack spacing={1}>
                      <CheckCircle size={10} color={C.green} />
                      <Text fontSize="10px" fontWeight="700" style={{ color: C.green }}>Vous</Text>
                    </HStack>
                  </Box>
                )}
              </Flex>
            );
          })}
          {members.length === 0 && (
            <Text fontSize="sm" fontStyle="italic" style={{ color: C.muted }}>Aucun membre chargé.</Text>
          )}
        </VStack>
      </Box>
    </VStack>
  );
}
