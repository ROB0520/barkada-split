import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController } from '@ionic/angular';

import { GroupModalComponent } from './group-modal.component';

describe('GroupModalComponent', () => {
  let component: GroupModalComponent;
  let fixture: ComponentFixture<GroupModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ModalController, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
