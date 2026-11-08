import { Component, computed, inject, Input, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ActionSheetController,
  ModalController,
} from '@ionic/angular';

import { isFutureDate, isValidExpenseDate } from '../../../models/date-util';
import type { Expense } from '../../../models/expense';
import type { Member } from '../../../models/member';
import { computeShares, orderMemberIds } from '../../../services/expense.service';
import { MemberService } from '../../../services/member.service';
import { formatAmount, parseAmount } from '../../../services/money';
import { ReceiptService } from '../../../services/receipt.service';
import { ReceiptPhotoComponent } from '../receipt-photo/receipt-photo.component';

@Component({
  selector: 'app-expense-modal',
  templateUrl: './expense-modal.component.html',
  styleUrls: ['./expense-modal.component.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonDatetime,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    FormsModule,
    ReceiptPhotoComponent,
  ],
})
export class ExpenseModalComponent implements OnInit {
  private readonly modals = inject(ModalController);
  private readonly members = inject(MemberService);
  private readonly receipts = inject(ReceiptService);
  private readonly sheets = inject(ActionSheetController);

  @Input() expense: Expense | null = null;
  @Input() groupId: string | null = null;

  readonly description = signal('');
  readonly amountText = signal('');
  readonly payerId = signal('');
  readonly dateString = signal('');
  // errors only clear when you hit save again
  readonly descriptionError = signal(false);
  readonly amountErrorText = signal<string | null>(null);
  readonly payerError = signal(false);
  readonly dateError = signal(false);

  readonly receiptPath = signal<string | undefined>(undefined);
  readonly receiptError = signal<string | null>(null);
  readonly receiptNotice = signal<string | null>(null);
  readonly galleryFallbackOffered = signal(false);

  // save waits for this so we never store a bad path
  private copyFlight: Promise<string | null> | null = null;
  private copySource: 'camera' | 'gallery' | null = null;

  ngOnInit(): void {
    if (this.expense !== null) {
      // trim here just guards old saved data
      this.description.set(this.expense.description.trim());
      this.amountText.set(ExpenseModalComponent.amountToText(this.expense.amount));
      this.payerId.set(this.expense.payerId);
      this.dateString.set(this.expense.date);
      this.receiptPath.set(this.expense.receiptPath);
    } else {
      // new form starts at today
      const now = new Date();
      const month = `${now.getMonth() + 1}`.padStart(2, '0');
      const day = `${now.getDate()}`.padStart(2, '0');
      this.dateString.set(`${now.getFullYear()}-${month}-${day}`);
    }
    // reuse a photo saved when the app was killed mid-capture
    const restored = this.receipts.restoredPendingPath();
    if (restored !== null) {
      this.receiptNotice.set(this.receipts.restoreNotice() ?? 'We recovered your photo.');
      this.receiptPath.set(restored);
      this.receipts.consumeRestoredPath();
    }
  }

  isEdit(): boolean {
    return this.expense !== null;
  }

  private static amountToText(amount: number): string {
    return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
  }

  readonly orderedMembers = computed<Member[]>(() => {
    if (this.groupId === null) {
      return [];
    }
    const roster: Member[] = this.members.membersForGroup(this.groupId);
    const byId = new Map(roster.map((member: Member) => [member.id, member]));
    const ordered: Member[] = [];
    for (const memberId of orderMemberIds(roster)) {
      const member = byId.get(memberId);
      if (member !== undefined) {
        ordered.push(member);
      }
    }
    return ordered;
  });

  // null when the amount text is invalid
  readonly parsedAmount = computed<number | null>(() => {
    try {
      return parseAmount(this.amountText());
    } catch {
      return null;
    }
  });

  readonly formattedPreview = computed<string | null>(() => {
    const total = this.parsedAmount();
    return total === null ? null : formatAmount(total);
  });

  readonly previewShares = computed<Record<string, number> | null>(() => {
    const total = this.parsedAmount();
    if (total === null) {
      return null;
    }
    const ids: string[] = this.orderedMembers().map((member: Member) => member.id);
    if (ids.length === 0) {
      return null;
    }
    return computeShares(total, ids);
  });

  readonly sharesDiffer = computed<boolean>(() => {
    const shares = this.previewShares();
    if (shares === null) {
      return false;
    }
    const values: number[] = Object.values(shares);
    return values.some((value: number) => value !== values[0]);
  });

  readonly formatAmount = formatAmount;

  // datetime needs full iso, we store just the day
  dateIso(): string | undefined {
    return this.dateString() === '' ? undefined : `${this.dateString()}T00:00:00`;
  }

  onDateChange(event: CustomEvent): void {
    const iso = (event.detail as { value?: string | null } | null)?.value;
    this.dateString.set(typeof iso === 'string' ? iso.slice(0, 10) : '');
  }

  isDescriptionBlank(): boolean {
    return this.description().trim() === '';
  }

  amountError(): string | null {
    try {
      parseAmount(this.amountText());
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid amount';
    }
  }

  isPayerBlank(): boolean {
    return this.payerId().trim() === '';
  }

  isDateInvalid(): boolean {
    return !isValidExpenseDate(this.dateString()) || isFutureDate(this.dateString());
  }

  async cancel(): Promise<void> {
    // drops the staged photo but keeps the old one
    const staged = this.receiptPath();
    if (staged !== undefined && staged !== this.expense?.receiptPath) {
      try {
        await this.receipts.deleteFile(staged);
      } catch {
        // ignore cleanup errors
      }
    }
    await this.modals.dismiss(undefined, 'cancel');
  }

  async attach(): Promise<void> {
    const sheet = await this.sheets.create({
      header: 'Add receipt',
      buttons: [
        { text: 'Take photo', handler: (): Promise<void> => this.runCapture('camera') },
        { text: 'Choose from gallery', handler: (): Promise<void> => this.runCapture('gallery') },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async replaceStaged(): Promise<void> {
    await this.attach();
  }

  async removeStaged(): Promise<void> {
    const staged = this.receiptPath();
    this.receiptPath.set(undefined);
    if (staged !== undefined && staged !== this.expense?.receiptPath) {
      try {
        await this.receipts.deleteFile(staged);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private async runCapture(source: 'camera' | 'gallery'): Promise<void> {
    this.receiptError.set(null);
    this.galleryFallbackOffered.set(false);
    const flight: Promise<string | null> =
      source === 'camera' ? this.receipts.captureViaCamera() : this.receipts.pickFromGallery();
    this.copyFlight = flight;
    this.copySource = source;
    try {
      const rel = await flight;
      if (rel !== null) {
        const previous = this.receiptPath();
        this.receiptPath.set(rel);
        if (previous !== undefined && previous !== this.expense?.receiptPath) {
          try {
            await this.receipts.deleteFile(previous);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    } catch (error) {
      this.mapCaptureError(error, source);
    } finally {
      if (this.copyFlight === flight) {
        this.copyFlight = null;
      }
    }
  }

  async useGalleryFallback(): Promise<void> {
    this.galleryFallbackOffered.set(false);
    await this.runCapture('gallery');
  }

  private mapCaptureError(error: unknown, source: 'camera' | 'gallery'): void {
    if (ReceiptService.isCaptureCancel(error)) {
      return;
    }
    if (ReceiptService.isPermissionDenial(error) && source === 'camera') {
      this.receiptError.set('Camera access was blocked. You can choose from the gallery instead.');
      this.galleryFallbackOffered.set(true);
    } else if (ReceiptService.isPermissionDenial(error)) {
      this.receiptError.set('Gallery access was blocked. You can still save the expense without a photo.');
    } else {
      this.receiptError.set('The camera is unavailable. You can continue without a photo.');
    }
  }

  async save(): Promise<void> {
    this.descriptionError.set(this.isDescriptionBlank());
    this.amountErrorText.set(this.amountError());
    this.payerError.set(this.isPayerBlank());
    this.dateError.set(this.isDateInvalid());
    if (this.descriptionError() || this.amountErrorText() !== null || this.payerError() || this.dateError()) {
      return;
    }
    // wait for a pending copy so we never save a bad path
    const flight = this.copyFlight;
    if (flight !== null) {
      try {
        const rel = await flight;
        if (rel !== null) {
          this.receiptPath.set(rel);
        }
      } catch (error) {
        this.receiptPath.set(this.expense?.receiptPath);
        this.mapCaptureError(error, this.copySource ?? 'camera');
      } finally {
        this.copyFlight = null;
        this.copySource = null;
      }
    }
    await this.modals.dismiss(
      {
        description: this.description().trim(),
        amount: this.parsedAmount() ?? 0,
        payerId: this.payerId(),
        date: this.dateString(),
        receiptPath: this.receiptPath(),
      },
      'confirm',
    );
  }
}
