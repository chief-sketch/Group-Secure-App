import { ChatConversation } from '../types';

/**
 * Standard real channels for the organization workspace with fixed IDs:
 * "general", "finance", "it-support", "executive-board"
 */
export const DEFAULT_CHANNELS: ChatConversation[] = [
  {
    id: 'general',
    name: 'General',
    type: 'channel',
    hasAccess: true,
    memberCount: 0,
    statusSubtitle: 'Organization-wide broadcast & staff channel',
    unreadCount: 0,
    lastMessage: '',
    lastMessageTime: '',
    messages: [],
  },
  {
    id: 'finance',
    name: 'Finance Team',
    type: 'channel',
    hasAccess: false,
    memberCount: 0,
    statusSubtitle: 'Finance & procurement team channel',
    unreadCount: 0,
    lastMessage: '',
    lastMessageTime: '',
    messages: [],
  },
  {
    id: 'it-support',
    name: 'IT Support',
    type: 'channel',
    hasAccess: false,
    memberCount: 0,
    statusSubtitle: 'Technical support & infrastructure channel',
    unreadCount: 0,
    lastMessage: '',
    lastMessageTime: '',
    messages: [],
  },
  {
    id: 'executive-board',
    name: 'Executive Board',
    type: 'channel',
    hasAccess: false,
    memberCount: 0,
    statusSubtitle: 'Restricted fiduciary governance channel',
    unreadCount: 0,
    lastMessage: '',
    lastMessageTime: '',
    messages: [],
  },
];
