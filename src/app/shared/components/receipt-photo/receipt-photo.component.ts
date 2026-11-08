import { Component, inject, Input, signal } from '@angular/core';
import type { OnChanges, OnInit } from '@angular/core';

import { ReceiptService } from '../../../services/receipt.service';

// one place that shows receipt photos, thumb or full
@Component({
  selector: 'app-receipt-photo',
  templateUrl: './receipt-photo.component.html',
  styleUrls: ['./receipt-photo.component.scss'],
  imports: [],
})
export class ReceiptPhotoComponent implements OnInit, OnChanges {
  private readonly receipts = inject(ReceiptService);

  @Input() receiptPath: string | undefined;
  @Input() size: 'thumb' | 'full' = 'thumb';

  readonly src = signal<string | null>(null);

  // skips old loads when the path changes fast
  private resolution = 0;
  private initialized = false;

  ngOnInit(): void {
    this.initialized = true;
    void this.resolve();
  }

  ngOnChanges(): void {
    if (this.initialized) {
      void this.resolve();
    }
  }

  private async resolve(): Promise<void> {
    const at = ++this.resolution;
    const path = this.receiptPath;
    if (path === undefined) {
      this.src.set(null);
      return;
    }
    try {
      const url = await this.receipts.receiptUrl(path);
      if (at === this.resolution) {
        this.src.set(url);
      }
    } catch {
      if (at === this.resolution) {
        this.src.set(null);
      }
    }
  }
}
