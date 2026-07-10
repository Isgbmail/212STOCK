import { useEffect, useState, useRef } from 'react';
import {
  Box, Badge, Popover, PopoverTrigger, PopoverContent,
  PopoverHeader, PopoverBody, PopoverArrow, PopoverCloseButton,
  VStack, Text, HStack, IconButton, Button, Divider,
} from '@chakra-ui/react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Notification } from '../types';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) ?? []);
  }

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    channelRef.current = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [user]);

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markOneRead(n: Notification) {
    if (n.read) return;
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!user) return null;

  return (
    <Popover placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Box position="relative" display="inline-flex">
          <IconButton
            aria-label="Notifications"
            icon={<Bell size={18} />}
            variant="ghost"
            colorScheme="gray"
            size="sm"
            rounded="full"
          />
          {unreadCount > 0 && (
            <Badge
              position="absolute"
              top="-2px"
              right="-2px"
              colorScheme="red"
              rounded="full"
              px={1.5}
              fontSize="9px"
              minW="16px"
              textAlign="center"
              pointerEvents="none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent w="340px" shadow="xl" rounded="2xl" border="1px" borderColor="gray.100" overflow="hidden">
        <PopoverArrow />
        <PopoverCloseButton top={3} right={3} />
        <PopoverHeader borderBottom="1px" borderColor="gray.100" py={3} px={4}>
          <HStack justify="space-between" pr={6}>
            <HStack spacing={2}>
              <Text fontWeight="bold" fontSize="sm">Notifications</Text>
              {unreadCount > 0 && (
                <Badge colorScheme="blue" rounded="full" px={2} fontSize="10px">{unreadCount}</Badge>
              )}
            </HStack>
            {unreadCount > 0 && (
              <Button size="xs" variant="ghost" colorScheme="blue" onClick={markAllRead}>
                Tout lire
              </Button>
            )}
          </HStack>
        </PopoverHeader>
        <PopoverBody p={0} maxH="380px" overflowY="auto">
          {notifications.length === 0 ? (
            <Box py={10} textAlign="center">
              <Bell size={24} color="var(--chakra-colors-gray-300)" style={{ margin: '0 auto 8px' }} />
              <Text fontSize="sm" color="gray.400">Aucune notification</Text>
            </Box>
          ) : (
            <VStack spacing={0} align="stretch" divider={<Divider />}>
              {notifications.map(n => (
                <Box
                  key={n.id}
                  px={4}
                  py={3}
                  bg={n.read ? 'white' : 'blue.50'}
                  _hover={{ bg: n.read ? 'gray.50' : 'blue.100' }}
                  cursor="pointer"
                  transition="background 0.1s"
                  onClick={() => markOneRead(n)}
                >
                  <HStack justify="space-between" align="start" spacing={2}>
                    <VStack align="start" spacing={0.5} flex={1} minW={0}>
                      <Text
                        fontSize="sm"
                        fontWeight={n.read ? 'normal' : 'semibold'}
                        color="gray.800"
                        noOfLines={1}
                      >
                        {n.title}
                      </Text>
                      {n.body && (
                        <Text fontSize="xs" color="gray.500" noOfLines={2}>{n.body}</Text>
                      )}
                      <Text fontSize="10px" color="gray.400" mt={0.5}>
                        {new Date(n.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </VStack>
                    {!n.read && (
                      <Box w={2} h={2} bg="blue.500" rounded="full" flexShrink={0} mt={1.5} />
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
