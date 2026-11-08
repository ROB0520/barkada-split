import { computed, inject, Injectable, signal } from '@angular/core';

import type { Payment } from '../models/payment';

import { MAX_AMOUNT } from './money';
import { isGroup, isMember, isPayment, StorageService } from './storage.service';

export interface CreatePaymentInput {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

// a payment moves money between two members without changing shared costs.
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly storage = inject(StorageService);

  private readonly _payments = signal<Payment[]>([]);
  readonly payments = this._payments.asReadonly();
  readonly paymentCount = computed(() => this._payments().length);
  readonly paymentsNewestFirst = computed(() => [...this._payments()].reverse());

  paymentsForGroup(groupId: string): Payment[] {
    return this._payments().filter((payment: Payment) => payment.groupId === groupId);
  }

  // Drops one group's payments from memory after the group is deleted.
  evictGroup(groupId: string): void {
    this._payments.update((current: Payment[]) => current.filter((payment: Payment) => payment.groupId !== groupId));
  }

  // Clears all payments from memory after a full wipe.
  clearAll(): void {
    this._payments.set([]);
  }

  async loadGroup(groupId: string): Promise<void> {
    const ids: string[] = await this.storage.readIds(this.storage.groupPaymentsKey(groupId));
    const found: Payment[] = [];
    for (const id of ids) {
      const payment = await this.storage.readRecord(this.storage.paymentKey(id), isPayment);
      if (payment !== null && payment.groupId === groupId) {
        found.push(payment);
      }
    }
    this._payments.update((current: Payment[]) => [
      ...current.filter((payment: Payment) => payment.groupId !== groupId),
      ...found,
    ]);
  }

  async loadAll(): Promise<void> {
    const groupIds: string[] = await this.storage.readIds(this.storage.GROUP_IDS_KEY);
    for (const groupId of groupIds) {
      await this.loadGroup(groupId);
    }
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    const group = await this.storage.readRecord(this.storage.groupKey(input.groupId), isGroup);
    if (group === null) {
      throw new Error('Group not found');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) {
      throw new Error('Payment must be a positive peso amount within range');
    }
    if (input.fromMemberId === input.toMemberId) {
      throw new Error('Payment needs two different members');
    }
    const from = await this.storage.readRecord(this.storage.memberKey(input.fromMemberId), isMember);
    const to = await this.storage.readRecord(this.storage.memberKey(input.toMemberId), isMember);
    if (from === null || from.groupId !== input.groupId || to === null || to.groupId !== input.groupId) {
      throw new Error('Both members must belong to the group');
    }
    const today: string = new Date().toISOString().slice(0, 10);
    const payment: Payment = {
      id: crypto.randomUUID(),
      groupId: input.groupId,
      fromMemberId: input.fromMemberId,
      toMemberId: input.toMemberId,
      amount: Math.round(input.amount * 100) / 100,
      date: today,
      createdAt: new Date().toISOString(),
    };
    await this.storage.writeRecord(this.storage.paymentKey(payment.id), payment);
    await this.storage.addIdToIndex(this.storage.groupPaymentsKey(input.groupId), payment.id);
    this._payments.update((current: Payment[]) => [...current, payment]);
    return payment;
  }

  // undo, balances go back to what they were.
  async delete(id: string): Promise<void> {
    const existing = await this.storage.readRecord(this.storage.paymentKey(id), isPayment);
    if (existing === null) {
      throw new Error('Payment not found');
    }
    await this.storage.removeRecord(this.storage.paymentKey(id));
    await this.storage.removeIdFromIndex(this.storage.groupPaymentsKey(existing.groupId), id);
    this._payments.update((current: Payment[]) => current.filter((payment: Payment) => payment.id !== id));
  }

  async countMemberInvolvement(groupId: string, memberId: string): Promise<number> {
    const ids: string[] = await this.storage.readIds(this.storage.groupPaymentsKey(groupId));
    let count = 0;
    for (const id of ids) {
      const payment = await this.storage.readRecord(this.storage.paymentKey(id), isPayment);
      if (payment === null || payment.groupId !== groupId) {
        continue;
      }
      if (payment.fromMemberId === memberId || payment.toMemberId === memberId) {
        count += 1;
      }
    }
    return count;
  }
}
