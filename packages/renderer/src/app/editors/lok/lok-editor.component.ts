import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { LokService } from '../../services/lok.service';

// ──────────────────────────────────────────────────────────────────────────────
// LOK key codes (from css::awt::Key + vcl/keycodes.hxx)
// ──────────────────────────────────────────────────────────────────────────────
const LOK_KEY: Record<string, number> = {
  ArrowDown:  1024, ArrowUp:    1025, ArrowLeft: 1026, ArrowRight: 1027,
  Home:       1028, End:        1029, PageUp:    1030, PageDown:   1031,
  Enter:      1280, Escape:     1281, Tab:       1282, Backspace:  1283,
  ' ':        1284, Insert:     1285, Delete:    1286,
  F1:  768, F2:  769, F3:  770,  F4:  771,
  F5:  772, F6:  773, F7:  774,  F8:  775,
  F9:  776, F10: 777, F11: 778,  F12: 779,
};

// Modifier bitmasks
const LOK_SHIFT = 0x1000;
const LOK_CTRL  = 0x2000;
const LOK_ALT   = 0x4000;

/** Pixels rendered per tile (both axes). */
const TILE_PX = 512;

/** Twips per inch. At 96 DPI: 1 px = 1440/96 = 15 twips. */
const TWIPS_PER_INCH = 1440;
const DPI = 96;
const TWIPS_PER_PX = TWIPS_PER_INCH / DPI; // = 15

type ViewState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-lok-editor',
  standalone: true,
  imports: [ButtonModule, MessageModule, ProgressSpinnerModule, TooltipModule],
  template: `
    <div class="lok-root">

      @switch (state()) {

        @case ('loading') {
          <div class="lok-loading" role="status" aria-label="Opening document">
            <p-progressSpinner
              strokeWidth="4"
              [style]="{ width: '2.25rem', height: '2.25rem' }"
              aria-hidden="true"
            />
            <p class="loading-text">Opening with LibreOfficeKit…</p>
            <p class="loading-hint">First load may take a few seconds</p>
          </div>
        }

        @case ('error') {
          <div class="lok-error-wrap" role="alert">
            <p-message severity="error" [text]="errorMsg" styleClass="lok-error-msg" />
            <p class="error-file">{{ fileName }}</p>
          </div>
        }

        @case ('ready') {
          <!-- Compact toolbar -->
          <div class="lok-toolbar">
            <p-button
              icon="pi pi-search-minus"
              [text]="true" size="small" pTooltip="Zoom out" tooltipPosition="bottom"
              (onClick)="adjustZoom(0.8)"
            />
            <span class="zoom-label">{{ zoomPct() }}%</span>
            <p-button
              icon="pi pi-search-plus"
              [text]="true" size="small" pTooltip="Zoom in" tooltipPosition="bottom"
              (onClick)="adjustZoom(1.25)"
            />
            <span class="toolbar-sep"></span>
            <p-button
              icon="pi pi-refresh"
              [text]="true" size="small" pTooltip="Refresh view" tooltipPosition="bottom"
              (onClick)="redraw()"
            />
          </div>

          <!-- Scrollable canvas host — receives pointer / keyboard events -->
          <div
            #scrollHost
            class="lok-scroll-host"
            tabindex="0"
            (scroll)="onScroll()"
            (click)="onClick($event)"
            (mousedown)="onMouseDown($event)"
            (mouseup)="onMouseUp($event)"
            (keydown)="onKeyDown($event)"
          >
            <canvas
              #docCanvas
              [attr.width]="docWidthPx()"
              [attr.height]="docHeightPx()"
              class="lok-canvas"
            ></canvas>
          </div>
        }

      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }

    .lok-root {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Loading ── */
    .lok-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      background: var(--surface-ground);
    }

    .loading-text {
      margin: 0;
      font-size: 0.9375rem;
      color: var(--text-color);
    }

    .loading-hint {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
      opacity: 0.7;
    }

    /* ── Error ── */
    .lok-error-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 2rem;
      background: var(--surface-ground);
    }

    :host ::ng-deep .lok-error-msg {
      max-width: 30rem;
      width: 100%;
    }

    .error-file {
      margin: 0;
      font-size: 0.8125rem;
      font-family: var(--font-mono, monospace);
      color: var(--text-color-secondary);
      opacity: 0.65;
    }

    /* ── Toolbar ── */
    .lok-toolbar {
      display: flex;
      align-items: center;
      gap: 0.125rem;
      padding: 0.25rem 0.5rem;
      flex-shrink: 0;
      border-bottom: 1px solid var(--surface-border);
      background: var(--surface-card);
    }

    .zoom-label {
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
      min-width: 3rem;
      text-align: center;
    }

    .toolbar-sep {
      flex: 1;
    }

    /* ── Canvas scroll host ── */
    .lok-scroll-host {
      flex: 1;
      min-height: 0;
      overflow: auto;
      background: var(--surface-ground);
      outline: none;
      display: flex;
      justify-content: center;
    }

    .lok-canvas {
      display: block;
      background: #fff;
      /* Crisp pixel rendering — no interpolation when CSS size ≠ canvas size */
      image-rendering: pixelated;
      align-self: flex-start;
    }
  `,
})
export class LokEditorComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) tabId!: string;
  @Input({ required: true }) filePath!: string;

  @ViewChild('scrollHost') scrollHostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('docCanvas')  canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly lok = inject(LokService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly state = signal<ViewState>('loading');
  errorMsg = '';

  private docId   = 0;
  private wTwips  = 0;
  private hTwips  = 0;
  private zoom    = signal(1);
  private ctx: CanvasRenderingContext2D | null = null;

  /** Keys for tiles that have been requested (avoids duplicate requests). */
  private requested = new Set<string>();

  /** Pending scroll timer (debounce). */
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  get fileName(): string {
    return this.filePath.split(/[/\\]/).pop() ?? this.filePath;
  }

  readonly zoomPct = () => Math.round(this.zoom() * 100);

  readonly docWidthPx  = () => Math.round(this.wTwips / (TWIPS_PER_PX / this.zoom()));
  readonly docHeightPx = () => Math.round(this.hTwips / (TWIPS_PER_PX / this.zoom()));

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  async ngAfterViewInit(): Promise<void> {
    try {
      const result = await this.lok.open(this.filePath);
      this.docId  = result.docId;
      this.wTwips = result.widthTwips;
      this.hTwips = result.heightTwips;
      this.state.set('ready');
      this.cdr.detectChanges();

      // Wait one tick for the canvas to enter the DOM
      await new Promise<void>((r) => setTimeout(r, 0));
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d', { alpha: false }) ?? null;

      void this.renderVisibleTiles();
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : String(e);
      this.state.set('error');
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.docId) {
      this.lok.close(this.docId).catch(() => {});
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Zoom
  // ──────────────────────────────────────────────────────────────────────────

  adjustZoom(factor: number): void {
    const next = Math.max(0.25, Math.min(4, this.zoom() * factor));
    this.zoom.set(next);
    this.requested.clear();
    this.cdr.detectChanges();
    setTimeout(() => void this.renderVisibleTiles(), 0);
  }

  redraw(): void {
    this.requested.clear();
    void this.renderVisibleTiles();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tile rendering
  // ──────────────────────────────────────────────────────────────────────────

  private async renderVisibleTiles(): Promise<void> {
    if (!this.ctx || this.state() !== 'ready') return;

    const host = this.scrollHostRef.nativeElement;
    const scrollX = host.scrollLeft;
    const scrollY = host.scrollTop;
    const viewW   = host.clientWidth;
    const viewH   = host.clientHeight;

    const z = this.zoom();
    const twipsPerPx = TWIPS_PER_PX / z;
    const tileTwips  = Math.round(TILE_PX * twipsPerPx);

    const docW = this.docWidthPx();
    const docH = this.docHeightPx();

    const firstTileX = Math.floor(scrollX / TILE_PX);
    const firstTileY = Math.floor(scrollY / TILE_PX);
    const lastTileX  = Math.ceil((scrollX + viewW) / TILE_PX);
    const lastTileY  = Math.ceil((scrollY + viewH) / TILE_PX);

    const renders: Promise<void>[] = [];

    for (let ty = firstTileY; ty < lastTileY; ty++) {
      for (let tx = firstTileX; tx < lastTileX; tx++) {
        const pixelX = tx * TILE_PX;
        const pixelY = ty * TILE_PX;
        if (pixelX >= docW || pixelY >= docH) continue;

        const key = `${tx},${ty},${z.toFixed(2)}`;
        if (this.requested.has(key)) continue;
        this.requested.add(key);

        const canvasW = Math.min(TILE_PX, docW - pixelX);
        const canvasH = Math.min(TILE_PX, docH - pixelY);
        const tilePosX = Math.round(pixelX * twipsPerPx);
        const tilePosY = Math.round(pixelY * twipsPerPx);

        renders.push(
          this.renderOneTile(pixelX, pixelY, canvasW, canvasH, tilePosX, tilePosY, tileTwips),
        );
      }
    }

    await Promise.allSettled(renders);
  }

  private async renderOneTile(
    pixelX: number, pixelY: number,
    canvasW: number, canvasH: number,
    tilePosX: number, tilePosY: number,
    tileTwips: number,
  ): Promise<void> {
    try {
      const base64 = await this.lok.renderTile(
        this.docId,
        canvasW, canvasH,
        tilePosX, tilePosY,
        tileTwips, tileTwips,
      );

      // Decode base64 → RGBA Uint8ClampedArray
      const binary = atob(base64);
      const arr = new Uint8ClampedArray(binary.length);
      for (let i = 0; i < binary.length; i++) {
        arr[i] = binary.charCodeAt(i);
      }

      const imageData = new ImageData(arr, canvasW, canvasH);
      this.ctx?.putImageData(imageData, pixelX, pixelY);
    } catch (e) {
      console.error('[lok] Tile render failed:', e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scroll
  // ──────────────────────────────────────────────────────────────────────────

  onScroll(): void {
    if (this.scrollTimer !== null) clearTimeout(this.scrollTimer);
    // Small debounce so we don't fire a render on every scroll pixel.
    this.scrollTimer = setTimeout(() => void this.renderVisibleTiles(), 80);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mouse events
  // ──────────────────────────────────────────────────────────────────────────

  onMouseDown(ev: MouseEvent): void {
    this.postMouse(ev, 0, 1);
  }

  onMouseUp(ev: MouseEvent): void {
    this.postMouse(ev, 1, 1);
    // Refresh tiles ~150 ms after mouse-up (cursor/selection change may redraw content).
    setTimeout(() => void this.renderVisibleTiles(), 150);
  }

  onClick(_ev: MouseEvent): void {
    this.scrollHostRef.nativeElement.focus();
  }

  private postMouse(ev: MouseEvent, type: number, count: number): void {
    if (!this.docId) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const px   = ev.clientX - rect.left;
    const py   = ev.clientY - rect.top;
    const twipsPerPx = TWIPS_PER_PX / this.zoom();
    const tx   = Math.round(px * twipsPerPx);
    const ty   = Math.round(py * twipsPerPx);
    const buttons  = ev.buttons || (1 << (ev.button)); // normalise
    const modifier = this.modifiers(ev);
    this.lok.postMouse(this.docId, type, tx, ty, count, buttons, modifier).catch(() => {});
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keyboard events
  // ──────────────────────────────────────────────────────────────────────────

  onKeyDown(ev: KeyboardEvent): void {
    if (!this.docId) return;

    // Pass printable characters via charCode; control keys via keyCode.
    const isPrintable = ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey;
    const charCode = isPrintable ? ev.key.charCodeAt(0) : 0;
    const keyCode  = LOK_KEY[ev.key] ?? 0;
    const modifier = this.modifiers(ev);

    if (charCode === 0 && keyCode === 0) return; // unknown key — ignore

    // Prevent browser from handling navigation keys inside the canvas host.
    ev.preventDefault();

    this.lok.postKey(this.docId, 0, charCode, keyCode | modifier).catch(() => {});
    this.lok.postKey(this.docId, 1, charCode, keyCode | modifier).catch(() => {});

    // Redraw after a brief delay (LOK may update content or cursor).
    setTimeout(() => {
      this.requested.clear();
      void this.renderVisibleTiles();
    }, 120);
  }

  private modifiers(ev: MouseEvent | KeyboardEvent): number {
    let mod = 0;
    if (ev.shiftKey) mod |= LOK_SHIFT;
    if (ev.ctrlKey)  mod |= LOK_CTRL;
    if (ev.altKey)   mod |= LOK_ALT;
    return mod;
  }
}
