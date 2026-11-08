import { Component, inject, Input, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';

import type { Member } from '../../../models/member';

// same modal for add and rename, only save writes
@Component({
  selector: 'app-member-modal',
  templateUrl: './member-modal.component.html',
  styleUrls: ['./member-modal.component.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonNote,
    IonTitle,
    IonToolbar,
    FormsModule,
  ],
})
export class MemberModalComponent implements OnInit {
  private readonly modals = inject(ModalController);

  @Input() member: Member | null = null;

  readonly name = signal('');
  // errors only clear when you hit save again
  readonly nameError = signal(false);

  ngOnInit(): void {
    if (this.member !== null) {
      this.name.set(this.member.name);
    }
  }

  isEdit(): boolean {
    return this.member !== null;
  }

  isNameBlank(): boolean {
    return this.name().trim() === '';
  }

  async cancel(): Promise<void> {
    await this.modals.dismiss(undefined, 'cancel');
  }

  async save(): Promise<void> {
    this.nameError.set(this.isNameBlank());
    if (this.isNameBlank()) {
      return;
    }
    await this.modals.dismiss({ name: this.name().trim() }, 'confirm');
  }
}
