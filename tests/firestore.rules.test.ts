import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Firebase Firestore Security Rules Unit Tests
 * Testing Suite for:
 * 1. Staff User (Approved, regular channel member)
 * 2. Approved Non-Bootstrap Admin (role: 'admin', status: 'approved', verified email)
 * 3. Pending User (status: 'pending', not approved)
 * 4. Unauthenticated Visitor
 */

const PROJECT_ID = 'fluid-myth-1ds98';

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed test users in Firestore with bypassSecurityRules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // 1. Approved Staff User
      await db.doc('users/staff_user_1').set({
        id: 'staff_user_1',
        fullName: 'Alice Staff',
        email: 'alice@company.com',
        role: 'staff',
        status: 'approved',
        channels: ['General', 'Finance Team'],
        historyFrom: {
          general: new Date('2026-01-01T00:00:00Z'),
          finance: new Date('2026-06-01T00:00:00Z'),
        },
      });

      // 2. Approved Non-Bootstrap Admin
      await db.doc('users/non_bootstrap_admin').set({
        id: 'non_bootstrap_admin',
        fullName: 'Bob Admin',
        email: 'bob.admin@company.com',
        role: 'admin',
        status: 'approved',
        channels: ['General', 'Finance Team', 'IT Support', 'Executive Board'],
        historyFrom: {},
      });

      // 3. Pending User (Waiting for admin approval)
      await db.doc('users/pending_user_1').set({
        id: 'pending_user_1',
        fullName: 'Charlie Pending',
        email: 'charlie@company.com',
        role: 'staff',
        status: 'pending',
        channels: [],
      });

      // Seed channel metadata documents
      await db.doc('channels/general').set({ name: 'General', description: 'General channel' });
      await db.doc('channels/finance').set({ name: 'Finance Team', description: 'Finance channel' });
      await db.doc('channels/executive-board').set({ name: 'Executive Board', description: 'Restricted' });

      // Seed channel messages for history testing
      await db.doc('channels/finance/messages/old_msg').set({
        senderId: 'non_bootstrap_admin',
        senderName: 'Bob Admin',
        text: 'Old financial message from January',
        createdAt: new Date('2026-01-15T00:00:00Z'),
        deliveredTo: ['non_bootstrap_admin'],
        readBy: ['non_bootstrap_admin'],
      });

      await db.doc('channels/finance/messages/new_msg').set({
        senderId: 'non_bootstrap_admin',
        senderName: 'Bob Admin',
        text: 'Recent financial message from July',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        deliveredTo: ['non_bootstrap_admin'],
        readBy: ['non_bootstrap_admin'],
      });
    });
  });

  // =========================================================================
  // 1. STAFF USER TESTS
  // =========================================================================
  describe('Staff User Operations', () => {
    it('allows staff user to read messages in channels they belong to after historyFrom', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Alice belongs to finance and message is after June 1, 2026
      await assertSucceeds(db.doc('channels/finance/messages/new_msg').get());
    });

    it('denies staff user from reading messages in their channel created before historyFrom', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Old message is from Jan 2026, but Alice historyFrom is June 2026
      await assertFails(db.doc('channels/finance/messages/old_msg').get());
    });

    it('denies staff user from reading messages in channels they do not belong to', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Alice is not in executive-board
      await assertFails(db.collection('channels/executive-board/messages').get());
    });

    it('denies staff user from promoting themselves to admin', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(
        db.doc('users/staff_user_1').update({
          role: 'admin',
        })
      );
    });

    it('denies staff user from approving or rejecting other users', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(
        db.doc('users/pending_user_1').update({
          status: 'approved',
        })
      );
    });

    it('denies staff user from creating initial profile with historyFrom field', async () => {
      const newStaff = testEnv.authenticatedContext('new_staff_uid', {
        email: 'new_staff@company.com',
        email_verified: true,
      });
      const db = newStaff.firestore();

      await assertFails(
        db.doc('users/new_staff_uid').set({
          role: 'staff',
          status: 'pending',
          channels: [],
          historyFrom: { general: new Date(0) }, // Must be blocked!
        })
      );
    });

    it('denies staff user from modifying channels in their directory document', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(
        db.doc('directory/staff_user_1').set(
          {
            channels: ['Executive Board'],
          },
          { merge: true }
        )
      );
    });

    it('allows staff user to create valid direct chat with sorted participant IDs', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();
      const sorted = ['non_bootstrap_admin', 'staff_user_1'].sort();
      const chatId = sorted.join('_');

      await assertSucceeds(
        db.doc(`directChats/${chatId}`).set({
          participants: sorted,
          createdAt: new Date(),
        })
      );
    });

    it('denies staff user from creating direct chat with unsorted/mismatched chatId', async () => {
      const staffContext = testEnv.authenticatedContext('staff_user_1', {
        email: 'alice@company.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(
        db.doc('directChats/random_custom_id').set({
          participants: ['non_bootstrap_admin', 'staff_user_1'],
          createdAt: new Date(),
        })
      );
    });
  });

  // =========================================================================
  // 2. APPROVED NON-BOOTSTRAP ADMIN TESTS
  // =========================================================================
  describe('Approved Non-Bootstrap Admin Operations', () => {
    it('allows approved admin to list all users in the organization', async () => {
      const adminContext = testEnv.authenticatedContext('non_bootstrap_admin', {
        email: 'bob.admin@company.com',
        email_verified: true,
      });
      const db = adminContext.firestore();

      await assertSucceeds(db.collection('users').get());
    });

    it('allows approved admin to approve a pending user and assign channels', async () => {
      const adminContext = testEnv.authenticatedContext('non_bootstrap_admin', {
        email: 'bob.admin@company.com',
        email_verified: true,
      });
      const db = adminContext.firestore();

      await assertSucceeds(
        db.doc('users/pending_user_1').update({
          status: 'approved',
          role: 'staff',
          channels: ['General'],
          updatedAt: new Date(),
        })
      );
    });

    it('allows approved admin to list and read all audit logs', async () => {
      const adminContext = testEnv.authenticatedContext('non_bootstrap_admin', {
        email: 'bob.admin@company.com',
        email_verified: true,
      });
      const db = adminContext.firestore();

      await assertSucceeds(db.collection('auditLogs').get());
    });

    it('allows approved admin to moderate/soft-delete violating messages across channels', async () => {
      const adminContext = testEnv.authenticatedContext('non_bootstrap_admin', {
        email: 'bob.admin@company.com',
        email_verified: true,
      });
      const db = adminContext.firestore();

      await assertSucceeds(
        db.doc('channels/finance/messages/new_msg').update({
          deleted: true,
          text: '',
          deletedAt: new Date(),
          deletedBy: 'admin',
          deletedReason: 'Policy violation',
        })
      );
    });
  });

  // =========================================================================
  // 3. PENDING USER TESTS
  // =========================================================================
  describe('Pending User Operations', () => {
    it('allows pending user to read their own profile only', async () => {
      const pendingContext = testEnv.authenticatedContext('pending_user_1', {
        email: 'charlie@company.com',
        email_verified: true,
      });
      const db = pendingContext.firestore();

      await assertSucceeds(db.doc('users/pending_user_1').get());
    });

    it('denies pending user from reading other users profiles or listing users', async () => {
      const pendingContext = testEnv.authenticatedContext('pending_user_1', {
        email: 'charlie@company.com',
        email_verified: true,
      });
      const db = pendingContext.firestore();

      await assertFails(db.doc('users/staff_user_1').get());
      await assertFails(db.collection('users').get());
    });

    it('denies pending user from reading channel messages or sending messages', async () => {
      const pendingContext = testEnv.authenticatedContext('pending_user_1', {
        email: 'charlie@company.com',
        email_verified: true,
      });
      const db = pendingContext.firestore();

      await assertFails(db.collection('channels/general/messages').get());
      await assertFails(
        db.collection('channels/general/messages').add({
          senderId: 'pending_user_1',
          senderName: 'Charlie Pending',
          text: 'Hello',
          createdAt: new Date(),
          deliveredTo: ['pending_user_1'],
          readBy: ['pending_user_1'],
        })
      );
    });

    it('denies pending user from creating audit log entries', async () => {
      const pendingContext = testEnv.authenticatedContext('pending_user_1', {
        email: 'charlie@company.com',
        email_verified: true,
      });
      const db = pendingContext.firestore();

      await assertFails(
        db.collection('auditLogs').add({
          id: 'log-1',
          timestamp: 'Now',
          actor: 'charlie@company.com',
          action: 'Sign in attempt',
          details: 'Pending login',
          category: 'Auth',
          actorUid: 'pending_user_1',
          createdAt: new Date(),
        })
      );
    });

    it('denies pending user from starting direct chats', async () => {
      const pendingContext = testEnv.authenticatedContext('pending_user_1', {
        email: 'charlie@company.com',
        email_verified: true,
      });
      const db = pendingContext.firestore();
      const sorted = ['pending_user_1', 'staff_user_1'].sort();

      await assertFails(
        db.doc(`directChats/${sorted.join('_')}`).set({
          participants: sorted,
          createdAt: new Date(),
        })
      );
    });
  });

  // =========================================================================
  // 4. UNAUTHENTICATED VISITOR TESTS
  // =========================================================================
  describe('Unauthenticated Visitor Operations', () => {
    it('denies unauthenticated requests to read any user documents', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthDb.doc('users/staff_user_1').get());
      await assertFails(unauthDb.collection('users').get());
    });

    it('denies unauthenticated requests to read channels or messages', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthDb.doc('channels/general').get());
      await assertFails(unauthDb.collection('channels/general/messages').get());
    });

    it('denies unauthenticated requests to write audit logs', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        unauthDb.collection('auditLogs').add({
          id: 'fake-log',
          actor: 'anonymous',
          createdAt: new Date(),
        })
      );
    });
  });
});
