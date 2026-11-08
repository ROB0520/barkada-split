import { computed, inject, Injectable, signal } from '@angular/core';

import type { Group } from '../models/group';

import { ExpenseService } from './expense.service';
import { MemberService } from './member.service';
import { PaymentService } from './payment.service';
import { ReceiptService } from './receipt.service';
import { isExpense, isGroup, StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly _groups = signal<Group[]>([]);
  readonly groups = this._groups.asReadonly();
  readonly groupCount = computed(() => this._groups().length);

  private readonly storage = inject(StorageService);
  private readonly members = inject(MemberService);
  private readonly expenses = inject(ExpenseService);
  private readonly payments = inject(PaymentService);
  private readonly receipts = inject(ReceiptService);

  async load(): Promise<void> {
    const ids: string[] = await this.storage.readIds(this.storage.GROUP_IDS_KEY);
    const found: Group[] = [];
    for (const id of ids) {
      const group = await this.storage.readRecord(this.storage.groupKey(id), isGroup);
      if (group !== null) {
        found.push(group);
      }
    }
    this._groups.set(found);
  }

  async create(name: string, description = ''): Promise<Group> {
    const trimmed: string = name.trim();
    if (trimmed === '') {
      throw new Error('Group name is required');
    }
    const now: string = new Date().toISOString();
    const group: Group = {
      id: crypto.randomUUID(),
      name: trimmed,
      description: description.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.writeRecord(this.storage.groupKey(group.id), group);
    await this.storage.addIdToIndex(this.storage.GROUP_IDS_KEY, group.id);
    this._groups.update((current: Group[]) => [...current, group]);
    return group;
  }

  async rename(id: string, name: string, description?: string): Promise<Group> {
    const existing = await this.storage.readRecord(this.storage.groupKey(id), isGroup);
    if (existing === null) {
      throw new Error('Group not found');
    }
    const trimmed: string = name.trim();
    if (trimmed === '') {
      throw new Error('Group name is required');
    }
    const updated: Group = {
      ...existing,
      name: trimmed,
      description: description === undefined ? existing.description : description.trim(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.writeRecord(this.storage.groupKey(id), updated);
    this._groups.update((current: Group[]) => current.map((group: Group) => (group.id === id ? updated : group)));
    return updated;
  }

  // removes the group plus its members, expenses, payments, and files.
  async delete(id: string): Promise<void> {
    const memberIds: string[] = await this.storage.readIds(this.storage.groupMembersKey(id));
    for (const memberId of memberIds) {
      await this.storage.removeRecord(this.storage.memberKey(memberId));
    }
    const expenseIds: string[] = await this.storage.readIds(this.storage.groupExpensesKey(id));
    for (const expenseId of expenseIds) {
      const expense = await this.storage.readRecord(this.storage.expenseKey(expenseId), isExpense);
      const receiptPath = expense?.receiptPath;
      await this.storage.removeRecord(this.storage.expenseKey(expenseId));
      if (receiptPath !== undefined) {
        try {
          await this.receipts.deleteFile(receiptPath);
        } catch {
          // file may already be gone, keep deleting the rest.
          console.warn(`[receipt] file delete skipped: ${receiptPath}`);
        }
      }
    }
    const paymentIds: string[] = await this.storage.readIds(this.storage.groupPaymentsKey(id));
    for (const paymentId of paymentIds) {
      await this.storage.removeRecord(this.storage.paymentKey(paymentId));
    }
    await this.storage.removeRecord(this.storage.groupMembersKey(id));
    await this.storage.removeRecord(this.storage.groupExpensesKey(id));
    await this.storage.removeRecord(this.storage.groupPaymentsKey(id));
    await this.storage.removeRecord(this.storage.groupKey(id));
    await this.storage.removeIdFromIndex(this.storage.GROUP_IDS_KEY, id);
    this._groups.update((current: Group[]) => current.filter((group: Group) => group.id !== id));
    // drop the deleted group's leftover list entries.
    this.members.evictGroup(id);
    this.expenses.evictGroup(id);
    this.payments.evictGroup(id);
  }

  getById(id: string): Group | undefined {
    return this._groups().find((group: Group) => group.id === id);
  }

  // clear the list, storage stays as is.
  clearAll(): void {
    this._groups.set([]);
  }
}
