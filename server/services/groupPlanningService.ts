import crypto from 'crypto';
import { db } from '../db/database';
import type { TripMemberEntity, TripItemVoteEntity, TripSplitEntity } from '../db/schema';

/**
 * Group planning + split pay (blueprint row #16).
 *
 * A trip owner can invite companions. Members can view the itinerary and
 * vote on suggested activities. The trip cost can be split among members
 * with per-member tracking of paid amounts.
 *
 * Design decisions:
 * - The trip owner is always the first member with role='owner'.
 * - Only accepted members can vote. Pending/declined members cannot.
 * - Votes are per-trip-item, per-user (upsert: re-voting replaces the old vote).
 * - Auto-approval: when >50% of accepted members approve, item moves to HELD.
 * - Split: owner can set equal or custom splits. Status is derived from paidEGP.
 */

// ─── Membership ────────────────────────────────────────────────────────

export function addMember(tripId: string, userId: string, invitedBy: string, role: 'owner' | 'member' = 'member'): TripMemberEntity {
  if (!tripId || !userId || !invitedBy) throw new Error('tripId, userId, and invitedBy are required.');

  const trip = db.trips.find(t => t.id === tripId);
  if (!trip) throw new Error('Trip not found.');

  // Idempotent: don't double-add.
  const existing = db.tripMembers.find(m => m.tripId === tripId && m.userId === userId);
  if (existing) return existing;

  // Self-join (adding yourself as owner at creation) is always allowed.
  const isSelfJoin = userId === invitedBy;
  if (!isSelfJoin) {
    // Only the owner or Ops/Admin can invite others.
    const inviter = db.tripMembers.find(m => m.tripId === tripId && m.userId === invitedBy);
    if (!inviter || inviter.role !== 'owner') {
      const actor = db.users.find(u => u.id === invitedBy);
      if (!actor || (actor.role !== 'Operations' && actor.role !== 'Admin')) {
        throw new Error('Only the trip owner can invite members.');
      }
    }
  }

  const now = new Date().toISOString();
  const member: TripMemberEntity = {
    id: `TM-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    tripId,
    userId,
    role,
    status: role === 'owner' ? 'accepted' : 'pending',
    invitedBy,
    invitedAt: now,
    respondedAt: role === 'owner' ? now : undefined,
    createdAt: now,
  };

  db.tripMembers.push(member);
  return member;
}

export function acceptInvite(memberId: string, userId: string): TripMemberEntity | null {
  const member = db.tripMembers.find(m => m.id === memberId && m.userId === userId);
  if (!member || member.status !== 'pending') return null;
  member.status = 'accepted';
  member.respondedAt = new Date().toISOString();
  return member;
}

export function declineInvite(memberId: string, userId: string): TripMemberEntity | null {
  const member = db.tripMembers.find(m => m.id === memberId && m.userId === userId);
  if (!member || member.status !== 'pending') return null;
  member.status = 'declined';
  member.respondedAt = new Date().toISOString();
  return member;
}

export function removeMember(tripId: string, userId: string, removedBy: string): boolean {
  const idx = db.tripMembers.findIndex(m => m.tripId === tripId && m.userId === userId);
  if (idx === -1) return false;
  const member = db.tripMembers[idx];
  if (member.role === 'owner') throw new Error('Cannot remove the trip owner.');

  // Only the owner or the member themselves can leave.
  if (removedBy !== member.userId) {
    const remover = db.tripMembers.find(m => m.tripId === tripId && m.userId === removedBy);
    if (!remover || remover.role !== 'owner') {
      throw new Error('Only the trip owner can remove members.');
    }
  }

  db.tripMembers.splice(idx, 1);
  return true;
}

export function membersForTrip(tripId: string): TripMemberEntity[] {
  return db.tripMembers.filter(m => m.tripId === tripId);
}

export function acceptedMembers(tripId: string): TripMemberEntity[] {
  return db.tripMembers.filter(m => m.tripId === tripId && m.status === 'accepted');
}

export function isMember(tripId: string, userId: string): boolean {
  return db.tripMembers.some(m => m.tripId === tripId && m.userId === userId && m.status === 'accepted');
}

export function isOwner(tripId: string, userId: string): boolean {
  return db.tripMembers.some(m => m.tripId === tripId && m.userId === userId && m.role === 'owner');
}

// ─── Voting ────────────────────────────────────────────────────────────

/**
 * Submits or replaces a vote on a trip itinerary item.
 * Only accepted members can vote. Only SUGGESTED items can be voted on.
 * When the approval threshold is reached, the item auto-approves.
 */
export function submitVote(params: {
  tripId: string;
  tripItemId: string;
  userId: string;
  vote: 'approve' | 'reject';
  comment?: string;
}): TripItemVoteEntity {
  const { tripId, tripItemId, userId, vote, comment } = params;

  // Only accepted members can vote.
  if (!isMember(tripId, userId)) throw new Error('Only accepted group members can vote.');

  // Item must exist and be SUGGESTED.
  const item = db.tripItems.find(i => i.id === tripItemId && i.tripId === tripId);
  if (!item) throw new Error('Trip item not found.');
  if (item.status !== 'SUGGESTED') throw new Error(`Cannot vote on items with status "${item.status}".`);

  // Upsert: replace existing vote.
  const existing = db.tripItemVotes.find(v => v.tripItemId === tripItemId && v.userId === userId);
  if (existing) {
    existing.vote = vote;
    existing.comment = comment?.trim() || existing.comment;
    return existing;
  }

  const voteEntity: TripItemVoteEntity = {
    id: `VOTE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    tripId,
    tripItemId,
    userId,
    vote,
    comment: comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  db.tripItemVotes.push(voteEntity);

  // Check auto-approval.
  maybeAutoApprove(tripId, tripItemId);

  return voteEntity;
}

/**
 * Checks if a SUGGESTED item should auto-approve based on vote tally.
 * Auto-approves when >50% of accepted members have voted 'approve'.
 */
function maybeAutoApprove(tripId: string, tripItemId: string): void {
  const acceptedCount = acceptedMembers(tripId).length;
  if (acceptedCount === 0) return;

  const votes = db.tripItemVotes.filter(v => v.tripItemId === tripItemId);
  const approvals = votes.filter(v => v.vote === 'approve').length;

  if (approvals > acceptedCount / 2) {
    const item = db.tripItems.find(i => i.id === tripItemId);
    if (item && item.status === 'SUGGESTED') {
      item.status = 'HELD';
      item.updatedAt = new Date().toISOString();
    }
  }
}

/** Returns the vote tally for a trip item. */
export function voteTally(tripItemId: string): { approvals: number; rejections: number; total: number } {
  const votes = db.tripItemVotes.filter(v => v.tripItemId === tripItemId);
  return {
    approvals: votes.filter(v => v.vote === 'approve').length,
    rejections: votes.filter(v => v.vote === 'reject').length,
    total: votes.length,
  };
}

/** Returns all votes for a trip. */
export function votesForTrip(tripId: string): TripItemVoteEntity[] {
  return db.tripItemVotes.filter(v => v.tripId === tripId);
}

/** Returns the user's vote for a specific item, if any. */
export function voteForItem(tripItemId: string, userId: string): TripItemVoteEntity | undefined {
  return db.tripItemVotes.find(v => v.tripItemId === tripItemId && v.userId === userId);
}

// ─── Split Payment ─────────────────────────────────────────────────────

/**
 * Creates equal split shares among accepted members.
 * Replaces any existing splits for the trip.
 */
export function createEqualSplit(tripId: string, totalEGP: number): TripSplitEntity[] {
  const members = acceptedMembers(tripId);
  if (members.length === 0) throw new Error('No accepted members to split among.');

  const shareEach = Math.ceil(totalEGP / members.length);
  const now = new Date().toISOString();

  // Clear existing splits.
  for (let i = db.tripSplits.length - 1; i >= 0; i--) {
    if (db.tripSplits[i].tripId === tripId) db.tripSplits.splice(i, 1);
  }

  const splits: TripSplitEntity[] = members.map(m => {
    const split: TripSplitEntity = {
      id: `SPLIT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      tripId,
      userId: m.userId,
      shareEGP: shareEach,
      paidEGP: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    db.tripSplits.push(split);
    return split;
  });

  return splits;
}

/**
 * Creates custom split shares. Amounts must sum to totalEGP.
 */
export function createCustomSplit(tripId: string, splits: Array<{ userId: string; shareEGP: number }>, totalEGP: number): TripSplitEntity[] {
  const sum = splits.reduce((acc, s) => acc + s.shareEGP, 0);
  if (Math.abs(sum - totalEGP) > 1) {
    throw new Error(`Split amounts (${sum} EGP) must equal total (${totalEGP} EGP).`);
  }

  const now = new Date().toISOString();
  for (let i = db.tripSplits.length - 1; i >= 0; i--) {
    if (db.tripSplits[i].tripId === tripId) db.tripSplits.splice(i, 1);
  }

  const result: TripSplitEntity[] = splits.map(s => {
    const split: TripSplitEntity = {
      id: `SPLIT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      tripId,
      userId: s.userId,
      shareEGP: s.shareEGP,
      paidEGP: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    db.tripSplits.push(split);
    return split;
  });

  return result;
}

/** Records a partial or full payment toward a member's share. */
export function recordPayment(tripId: string, userId: string, amountEGP: number): TripSplitEntity | null {
  const split = db.tripSplits.find(s => s.tripId === tripId && s.userId === userId);
  if (!split) return null;

  split.paidEGP = Math.min(split.shareEGP, split.paidEGP + amountEGP);
  split.status = split.paidEGP >= split.shareEGP ? 'paid' : 'partial';
  split.updatedAt = new Date().toISOString();
  return split;
}

/** Returns all splits for a trip. */
export function splitsForTrip(tripId: string): TripSplitEntity[] {
  return db.tripSplits.filter(s => s.tripId === tripId);
}

/** Returns the split for a specific member. */
export function splitForMember(tripId: string, userId: string): TripSplitEntity | undefined {
  return db.tripSplits.find(s => s.tripId === tripId && s.userId === userId);
}

/** Returns aggregate split status for a trip. */
export function splitStatus(tripId: string): { totalEGP: number; paidEGP: number; pendingEGP: number; allPaid: boolean } {
  const splits = splitsForTrip(tripId);
  const totalEGP = splits.reduce((a, s) => a + s.shareEGP, 0);
  const paidEGP = splits.reduce((a, s) => a + s.paidEGP, 0);
  return {
    totalEGP,
    paidEGP,
    pendingEGP: totalEGP - paidEGP,
    allPaid: splits.length > 0 && splits.every(s => s.status === 'paid'),
  };
}

export const groupPlanningService = {
  // Membership
  addMember,
  acceptInvite,
  declineInvite,
  removeMember,
  membersForTrip,
  acceptedMembers,
  isMember,
  isOwner,
  // Voting
  submitVote,
  voteTally,
  votesForTrip,
  voteForItem,
  // Split
  createEqualSplit,
  createCustomSplit,
  recordPayment,
  splitsForTrip,
  splitForMember,
  splitStatus,
};
