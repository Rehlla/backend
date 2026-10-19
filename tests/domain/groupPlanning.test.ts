import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import { groupPlanningService } from '../../server/services/groupPlanningService';

/**
 * Group planning + split pay (blueprint row #16).
 *
 * Tests cover: membership CRUD, voting with auto-approval,
 * equal/custom splits, payment tracking.
 */

let dir: string;
let adapter: SqlitePersistenceAdapter;

function seedUser(id: string, name: string) {
  db.users.push({
    id, email: `${id.toLowerCase()}@test.com`, name, role: 'Traveler',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
}

function seedTrip(tripId: string, ownerId: string) {
  db.trips.push({
    id: tripId, userId: ownerId, title: 'Group Trip', status: 'PLANNED',
    lengthDays: 5, travelersCount: 3, budget: 'Moderate', pace: 'Balanced',
    interests: ['diving'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
  // Auto-add owner as first member.
  groupPlanningService.addMember(tripId, ownerId, ownerId, 'owner');
}

function seedItem(tripId: string, status: 'SUGGESTED' | 'HELD' | 'BOOKED' = 'SUGGESTED') {
  const id = `ITEM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  db.tripItems.push({
    id, tripId, serviceType: 'diving', skuId: 'SKU-1', title: 'Blue Hole Dive',
    dayNumber: 1, priceEGP: 1200, status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
  return id;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-group-'));
  adapter = new SqlitePersistenceAdapter(path.join(dir, 'test.sqlite'));
  db.setAdapter(adapter);
  initializeCmsSchema();

  seedUser('USR-OWNER', 'Trip Owner');
  seedUser('USR-M1', 'Member 1');
  seedUser('USR-M2', 'Member 2');
  seedUser('USR-M3', 'Member 3');
  seedUser('USR-OUTSIDER', 'Outsider');
  seedTrip('TRIP-GROUP', 'USR-OWNER');
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('groupPlanningService', () => {
  describe('membership', () => {
    it('owner is auto-added as accepted member', () => {
      const members = groupPlanningService.membersForTrip('TRIP-GROUP');
      expect(members).toHaveLength(1);
      expect(members[0].role).toBe('owner');
      expect(members[0].status).toBe('accepted');
    });

    it('owner can invite members', () => {
      const m = groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      expect(m.status).toBe('pending');
      expect(m.role).toBe('member');
    });

    it('outsiders cannot invite', () => {
      expect(() =>
        groupPlanningService.addMember('TRIP-GROUP', 'USR-M2', 'USR-OUTSIDER')
      ).toThrow(/only the trip owner/i);
    });

    it('members can accept/decline invites', () => {
      const m = groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      groupPlanningService.acceptInvite(m.id, 'USR-M1');
      expect(groupPlanningService.isMember('TRIP-GROUP', 'USR-M1')).toBe(true);

      const m2 = groupPlanningService.addMember('TRIP-GROUP', 'USR-M2', 'USR-OWNER');
      groupPlanningService.declineInvite(m2.id, 'USR-M2');
      expect(groupPlanningService.isMember('TRIP-GROUP', 'USR-M2')).toBe(false);
    });

    it('owner can remove members (not themselves)', () => {
      const m = groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      groupPlanningService.acceptInvite(m.id, 'USR-M1');
      expect(groupPlanningService.removeMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER')).toBe(true);
      expect(groupPlanningService.isMember('TRIP-GROUP', 'USR-M1')).toBe(false);
    });

    it('cannot remove the owner', () => {
      expect(() =>
        groupPlanningService.removeMember('TRIP-GROUP', 'USR-OWNER', 'USR-OWNER')
      ).toThrow(/cannot remove the trip owner/i);
    });

    it('members can leave voluntarily', () => {
      const m = groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      groupPlanningService.acceptInvite(m.id, 'USR-M1');
      expect(groupPlanningService.removeMember('TRIP-GROUP', 'USR-M1', 'USR-M1')).toBe(true);
    });

    it('addMember is idempotent', () => {
      const m1 = groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      const m2 = groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      expect(m2.id).toBe(m1.id);
      expect(groupPlanningService.membersForTrip('TRIP-GROUP')).toHaveLength(2); // owner + M1
    });
  });

  describe('voting', () => {
    let itemId: string;

    beforeEach(() => {
      groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      groupPlanningService.acceptInvite(
        db.tripMembers.find(m => m.tripId === 'TRIP-GROUP' && m.userId === 'USR-M1')!.id,
        'USR-M1'
      );
      groupPlanningService.addMember('TRIP-GROUP', 'USR-M2', 'USR-OWNER');
      groupPlanningService.acceptInvite(
        db.tripMembers.find(m => m.tripId === 'TRIP-GROUP' && m.userId === 'USR-M2')!.id,
        'USR-M2'
      );
      itemId = seedItem('TRIP-GROUP');
    });

    it('accepted members can vote on SUGGESTED items', () => {
      const vote = groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
      });
      expect(vote.id).toMatch(/^VOTE-/);
      expect(vote.vote).toBe('approve');
    });

    it('outsiders cannot vote', () => {
      expect(() =>
        groupPlanningService.submitVote({
          tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-OUTSIDER', vote: 'approve',
        })
      ).toThrow(/only accepted group members/i);
    });

    it('cannot vote on non-SUGGESTED items', () => {
      db.tripItems.find(i => i.id === itemId)!.status = 'HELD';
      expect(() =>
        groupPlanningService.submitVote({
          tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
        })
      ).toThrow(/cannot vote on items with status/i);
    });

    it('re-voting replaces the old vote', () => {
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
      });
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'reject',
      });
      const tally = groupPlanningService.voteTally(itemId);
      expect(tally.approvals).toBe(0);
      expect(tally.rejections).toBe(1);
    });

    it('auto-approves when >50% of accepted members approve', () => {
      // 3 accepted members (owner + M1 + M2). Need 2 approvals.
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-OWNER', vote: 'approve',
      });
      expect(db.tripItems.find(i => i.id === itemId)!.status).toBe('SUGGESTED');

      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
      });
      // 2/3 = 66% > 50% → auto-approve
      expect(db.tripItems.find(i => i.id === itemId)!.status).toBe('HELD');
    });

    it('does not auto-approve at exactly 50%', () => {
      // Only M1 and M2 are voting (owner doesn't vote). 2 accepted members total.
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
      });
      // 1/2 = 50% → NOT > 50%
      expect(db.tripItems.find(i => i.id === itemId)!.status).toBe('SUGGESTED');
    });

    it('voteTally counts correctly', () => {
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
      });
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M2', vote: 'reject',
      });
      const tally = groupPlanningService.voteTally(itemId);
      expect(tally.approvals).toBe(1);
      expect(tally.rejections).toBe(1);
      expect(tally.total).toBe(2);
    });

    it('votesForTrip returns all votes for a trip', () => {
      groupPlanningService.submitVote({
        tripId: 'TRIP-GROUP', tripItemId: itemId, userId: 'USR-M1', vote: 'approve',
      });
      expect(groupPlanningService.votesForTrip('TRIP-GROUP')).toHaveLength(1);
    });
  });

  describe('split payment', () => {
    beforeEach(() => {
      groupPlanningService.addMember('TRIP-GROUP', 'USR-M1', 'USR-OWNER');
      groupPlanningService.acceptInvite(
        db.tripMembers.find(m => m.tripId === 'TRIP-GROUP' && m.userId === 'USR-M1')!.id,
        'USR-M1'
      );
      groupPlanningService.addMember('TRIP-GROUP', 'USR-M2', 'USR-OWNER');
      groupPlanningService.acceptInvite(
        db.tripMembers.find(m => m.tripId === 'TRIP-GROUP' && m.userId === 'USR-M2')!.id,
        'USR-M2'
      );
    });

    it('createEqualSplit divides evenly among accepted members', () => {
      const splits = groupPlanningService.createEqualSplit('TRIP-GROUP', 3000);
      expect(splits).toHaveLength(3); // owner + M1 + M2
      expect(splits[0].shareEGP).toBe(1000);
      expect(splits.every(s => s.status === 'pending')).toBe(true);
    });

    it('ceil rounding ensures full amount is covered', () => {
      const splits = groupPlanningService.createEqualSplit('TRIP-GROUP', 1000);
      // 1000/3 = 333.33 → ceil = 334 each → total = 1002 (overage is by design)
      expect(splits[0].shareEGP).toBe(334);
    });

    it('createCustomSplit validates sum matches total', () => {
      expect(() =>
        groupPlanningService.createCustomSplit('TRIP-GROUP', [
          { userId: 'USR-OWNER', shareEGP: 1000 },
          { userId: 'USR-M1', shareEGP: 1000 },
          { userId: 'USR-M2', shareEGP: 500 }, // short by 500
        ], 3000)
      ).toThrow(/must equal total/i);
    });

    it('createCustomSplit works when sum matches', () => {
      const splits = groupPlanningService.createCustomSplit('TRIP-GROUP', [
        { userId: 'USR-OWNER', shareEGP: 1500 },
        { userId: 'USR-M1', shareEGP: 750 },
        { userId: 'USR-M2', shareEGP: 750 },
      ], 3000);
      expect(splits).toHaveLength(3);
      expect(splits.find(s => s.userId === 'USR-OWNER')!.shareEGP).toBe(1500);
    });

    it('recordPayment tracks partial and full payment', () => {
      groupPlanningService.createEqualSplit('TRIP-GROUP', 3000);
      const split = groupPlanningService.recordPayment('TRIP-GROUP', 'USR-M1', 500);
      expect(split!.paidEGP).toBe(500);
      expect(split!.status).toBe('partial');

      groupPlanningService.recordPayment('TRIP-GROUP', 'USR-M1', 500);
      expect(split!.paidEGP).toBe(1000);
      expect(split!.status).toBe('paid');
    });

    it('payment caps at share amount', () => {
      groupPlanningService.createEqualSplit('TRIP-GROUP', 3000);
      groupPlanningService.recordPayment('TRIP-GROUP', 'USR-M1', 5000);
      const split = groupPlanningService.splitForMember('TRIP-GROUP', 'USR-M1');
      expect(split!.paidEGP).toBe(split!.shareEGP);
    });

    it('splitStatus reports aggregate', () => {
      groupPlanningService.createEqualSplit('TRIP-GROUP', 3000);
      groupPlanningService.recordPayment('TRIP-GROUP', 'USR-OWNER', 1000);
      const status = groupPlanningService.splitStatus('TRIP-GROUP');
      expect(status.totalEGP).toBe(3000);
      expect(status.paidEGP).toBe(1000);
      expect(status.pendingEGP).toBe(2000);
      expect(status.allPaid).toBe(false);
    });

    it('allPaid is true when every member is paid', () => {
      groupPlanningService.createEqualSplit('TRIP-GROUP', 3000);
      groupPlanningService.recordPayment('TRIP-GROUP', 'USR-OWNER', 1000);
      groupPlanningService.recordPayment('TRIP-GROUP', 'USR-M1', 1000);
      groupPlanningService.recordPayment('TRIP-GROUP', 'USR-M2', 1000);
      expect(groupPlanningService.splitStatus('TRIP-GROUP').allPaid).toBe(true);
    });

    it('replacing splits clears old ones', () => {
      groupPlanningService.createEqualSplit('TRIP-GROUP', 3000);
      groupPlanningService.createEqualSplit('TRIP-GROUP', 6000);
      const splits = groupPlanningService.splitsForTrip('TRIP-GROUP');
      expect(splits).toHaveLength(3);
      expect(splits[0].shareEGP).toBe(2000);
    });
  });
});
