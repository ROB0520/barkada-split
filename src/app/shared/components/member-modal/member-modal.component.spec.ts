import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController } from '@ionic/angular';

import { MemberModalComponent } from './member-modal.component';

describe('MemberModalComponent', () => {
  let component: MemberModalComponent;
  let fixture: ComponentFixture<MemberModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ModalController, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
