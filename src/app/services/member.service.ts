import { computed, inject, Injectable, signal } from '@angular/core';

import type { Member } from '../models/member';

import { ExpenseService } from './expense.service';
import { PaymentService } from './payment.service';
import { isGroup, isMember, StorageService } from './storage.service';

// members live under their group, one key per member plus an index per group.
@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly _members = signal<Member[]>([]);
  readonly members = this._members.asReadonly();
  readonly memberCount = computed(() => this._members().length);

  private readonly storage = inject(StorageService);
  private readonly expenses = inject(ExpenseService);
  private readonly payments = inject(PaymentService);

  membersForGroup(groupId: string): Member[] {
    return this._members().filter((member: Member) => member.groupId === groupId);
  }

  // drop one group's members from the list, storage stays as is.
  evictGroup(groupId: string): void {
    this._members.update((current: Member[]) => current.filter((member: Member) => member.groupId !== groupId));
  }

  // clear the list, storage stays as is.
  clearAll(): void {
    this._members.set([]);
  }

  async loadGroup(groupId: string): Promise<void> {
    const ids: string[] = await this.storage.readIds(this.storage.groupMembersKey(groupId));
    const found: Member[] = [];
    for (const id of ids) {
      const member = await this.storage.readRecord(this.storage.memberKey(id), isMember);
      if (member !== null && member.groupId === groupId) {
        found.push(member);
      }
    }
    this._members.update((current: Member[]) => [
      ...current.filter((member: Member) => member.groupId !== groupId),
      ...found,
    ]);
  }

  // load every group's members so home and expenses show data on launch.
  async loadAll(): Promise<void> {
    const groupIds: string[] = await this.storage.readIds(this.storage.GROUP_IDS_KEY);
    for (const groupId of groupIds) {
      await this.loadGroup(groupId);
    }
  }

  async create(groupId: string, name: string): Promise<Member> {
    const group = await this.storage.readRecord(this.storage.groupKey(groupId), isGroup);
    if (group === null) {
      throw new Error('Group not found');
    }
    const trimmed: string = name.trim();
    if (trimmed === '') {
      throw new Error('Member name is required');
    }
    const member: Member = {
      id: crypto.randomUUID(),
      groupId,
      name: trimmed,
      createdAt: new Date().toISOString(),
    };
    await this.storage.writeRecord(this.storage.memberKey(member.id), member);
    await this.storage.addIdToIndex(this.storage.groupMembersKey(groupId), member.id);
    this._members.update((current: Member[]) => [...current, member]);
    return member;
  }

  async rename(id: string, name: string): Promise<Member> {
    const existing = await this.storage.readRecord(this.storage.memberKey(id), isMember);
    if (existing === null) {
      throw new Error('Member not found');
    }
    const trimmed: string = name.trim();
    if (trimmed === '') {
      throw new Error('Member name is required');
    }
    const updated: Member = { ...existing, name: trimmed };
    await this.storage.writeRecord(this.storage.memberKey(id), updated);
    this._members.update((current: Member[]) => current.map((member: Member) => (member.id === id ? updated : member)));
    return updated;
  }

  // blocked when the member is in any expense or payment.
  async delete(id: string): Promise<void> {
    const existing = await this.storage.readRecord(this.storage.memberKey(id), isMember);
    if (existing === null) {
      throw new Error('Member not found');
    }
    const involvement = await this.expenses.countMemberInvolvement(existing.groupId, id);
    if (involvement.count > 0) {
      const role = involvement.asPayer ? 'they are the payer' : 'in the split';
      throw new Error(`${existing.name} can't be removed — ${role} of ${involvement.count} recorded expense(s).`);
    }
    const paymentCount = await this.payments.countMemberInvolvement(existing.groupId, id);
    if (paymentCount > 0) {
      throw new Error(`${existing.name} can't be removed — they have ${paymentCount} recorded payment(s).`);
    }
    await this.storage.removeRecord(this.storage.memberKey(id));
    await this.storage.removeIdFromIndex(this.storage.groupMembersKey(existing.groupId), id);
    this._members.update((current: Member[]) => current.filter((member: Member) => member.id !== id));
  }
}
