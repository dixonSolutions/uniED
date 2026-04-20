import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <section class="welcome" aria-labelledby="welcome-title">
      <h1 id="welcome-title" class="title">uniED</h1>
      <p-button
        label="Open folder"
        icon="pi pi-folder-open"
        size="large"
        styleClass="welcome-cta"
        (onClick)="openFolder.emit()"
      />
      @if (lastFolder) {
        <p-button
          [label]="reopenLabel"
          [text]="true"
          severity="secondary"
          size="small"
          styleClass="welcome-recent"
          (onClick)="reopenLast.emit()"
        />
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      padding: 2rem 1rem;
      background: var(--surface-ground);
    }
    .title {
      margin: 0;
      font-size: 2.5rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--text-color);
    }
    :host ::ng-deep .welcome-cta .p-button {
      padding: 0.75rem 1.75rem;
      font-size: 1rem;
      min-width: 14rem;
    }
  `,
})
export class WelcomeComponent {
  @Input() lastFolder: string | null = null;
  @Output() openFolder = new EventEmitter<void>();
  @Output() reopenLast = new EventEmitter<void>();

  get reopenLabel(): string {
    if (!this.lastFolder) return '';
    const name = this.lastFolder.split(/[/\\]/).filter(Boolean).pop() ?? this.lastFolder;
    return `Reopen ${name}`;
  }
}
