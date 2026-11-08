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
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';

import type { Group } from '../../../models/group';

// same modal for add and edit, only save writes
@Component({
  selector: 'app-group-modal',
  templateUrl: './group-modal.component.html',
  styleUrls: ['./group-modal.component.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonNote,
    IonTextarea,
    IonTitle,
    IonToolbar,
    FormsModule,
  ],
})
export class GroupModalComponent implements OnInit {
  private readonly modals = inject(ModalController);

  @Input() group: Group | null = null;

  readonly name = signal('');
  readonly description = signal('');
  // errors only clear when you hit save again
  readonly nameError = signal(false);

  ngOnInit(): void {
    if (this.group !== null) {
      this.name.set(this.group.name);
      this.description.set(this.group.description);
    }
  }

  isEdit(): boolean {
    return this.group !== null;
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
    await this.modals.dismiss({ name: this.name().trim(), description: this.description() }, 'confirm');
  }
}
