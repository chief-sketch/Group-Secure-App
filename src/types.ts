export type AuthScreen =
  | 'login'
  | 'signup'
  | 'verify_email'
  | 'verifying_keys'
  | 'chat'
  | 'admin_login'
  | 'admin_signup'
  | 'admin_dashboard'
  | 'not_found';

export type UserRole = 'staff' | 'team_lead' | 'admin';

export type AccountStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

export interface UserSession {
  uid: string;
  email: string;
  fullName: string;
  department: string;
  role: UserRole;
  status: AccountStatus;
  keyFingerprint: string;
  deviceId: string;
  algorithm: string;
  channels?: string[];
  historyFrom?: Record<string, any>;
  privacyAcceptedAt?: any;
  providerId?: string;
  emailVerified?: boolean;
}

export interface DirectoryUser {
  uid: string;
  displayName: string;
  department: string;
  channels?: string[];
  avatarMode?: 'initials' | 'photo';
  avatarColor?: string;
  avatarPhoto?: string;
}

export interface ChannelDoc {
  id: string;
  name: string;
  description: string;
  avatarMode?: 'icon' | 'photo';
  avatarIcon?: string;
  avatarColor?: string;
  avatarPhoto?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DirectChatDoc {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
}

export interface OrgUser {
  id: string;
  fullName: string;
  email: string;
  department: string;
  role: UserRole;
  status: AccountStatus;
  channels: string[]; // e.g. ['General', 'IT Support']
  historyFrom?: Record<string, any>;
  dateRegistered: string;
  privacyAcceptedAt?: any;
  password?: string;
  authProvider?: 'google' | 'email' | 'password';
  passwordHash?: string;
  passwordSalt?: string;
}

export type AuditCategory = 'Auth' | 'Role change' | 'Approval' | 'Retention' | 'Purge' | 'Moderation';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  category: AuditCategory;
  actorUid?: string;
  type?: string;
}

export interface ActivityEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  category: 'role' | 'approval' | 'rejection' | 'signup' | 'security';
}

export interface ChannelRetentionPolicy {
  channelName: string;
  messageExpiry: string; // 'Never' | '7 days' | '30 days' | '90 days' | '1 year'
  fileExpiry: string; // 'Never' | '7 days' | '30 days' | '90 days'
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  isImage: boolean;
  blob?: Blob;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  fullName: string;
  email: string;
  department: string;
  password: string;
  confirmPassword: string;
}

export interface FormErrors {
  fullName?: string;
  email?: string;
  department?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ReportDoc {
  id: string;
  reporterId: string;
  reporterName: string;
  conversationType: 'channel' | 'direct' | 'app';
  conversationId?: string;
  messageId?: string;
  reason: string;
  note: string;
  status: 'open' | 'resolved';
  createdAt: any;
}

export interface HistoryRequest {
  id: string;
  uid: string;
  userName: string;
  channelId: string;
  note?: string;
  status: 'open' | 'approved' | 'declined';
  createdAt: any;
}

export interface MessageReplyTo {
  messageId: string;
  senderName: string;
  preview: string;
}

export interface FileDoc {
  id: string;
  senderId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  data: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor?: string;
  text?: string;
  timestamp: string;
  createdAt?: any;
  editedAt?: any;
  deleted?: boolean;
  deletedAt?: any;
  deletedBy?: 'sender' | 'admin' | string;
  deletedReason?: string;
  replyTo?: MessageReplyTo;
  deliveredTo?: string[];
  readBy?: string[];
  isOutgoing: boolean;
  status?: MessageStatus;
  isPending?: boolean;
  uploadFailed?: boolean;
  type?: 'text' | 'file';
  fileId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  thumb?: string;
  fileUploadProgress?: number;
  pendingFileData?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    data: string;
    thumb?: string;
  };
  file?: AttachedFile;
  fileDataUrl?: string;
}

export type ChatType = 'channel' | 'direct';

export interface ChatConversation {
  id: string;
  name: string;
  type: ChatType;
  hasAccess: boolean;
  participantUid?: string;
  participantDepartment?: string;
  memberCount?: number;
  statusSubtitle?: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageCreatedAt?: any;
  messages: ChatMessage[];
  isTyping?: boolean;
}

export interface NotificationToastData {
  id: string;
  chatId: string;
  chatName: string;
  senderName: string;
  senderColor?: string;
  text: string;
  isChannel: boolean;
}

export type MeetingStatus = 'scheduled' | 'cancelled';
export type MeetingRsvpStatus = 'going' | 'maybe' | 'declined';

export interface MeetingDoc {
  id: string;
  title: string;
  startsAt: any; // Firestore Timestamp
  durationMinutes: number; // 5 to 480
  location?: string; // max 120
  link?: string; // max 200, must start with https://
  note?: string; // max 300
  status: MeetingStatus;
  createdBy: string;
  createdByName: string;
  createdAt: any; // Timestamp
  rsvp: Record<string, MeetingRsvpStatus>;
  editedAt?: any;
  cancelledBy?: string;
  cancelledAt?: any;
}

export interface MyMeetingDoc {
  id: string;
  conversationType: 'channel' | 'direct';
  conversationId: string;
  conversationName: string;
  title: string;
  startsAt: any; // Timestamp
}

export interface MeetingReminderToastData {
  id: string;
  meetingId: string;
  conversationType: 'channel' | 'direct';
  conversationId: string;
  conversationName: string;
  title: string;
  timing: '15' | '0'; // 15 mins before or now
}
