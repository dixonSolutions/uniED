import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { MessageModule } from 'primeng/message';
import { ToolbarModule } from 'primeng/toolbar';
import { LokService } from '../../services/lok.service';
import { TabsService } from '../../services/tabs.service';

const TWIPS_PER_PX = 15;

@Component({
  selector: 'app-lok-editor',
  standalone: true,
  imports: [ToolbarModule, MessageModule],
  template: `
    <div class="lok-root">
      @if (error) {
        <p-message severity="error" [text]="error" styleClass="w-full" />
      } @else {
        <p-toolbar styleClass="lok-toolbar border-noround">
          <span class="text-sm text-color-secondary">{{ status }}</span>
        </p-toolbar>
        <div class="viewport" #viewport (wheel)="onWheel($event)">
          <canvas #canvas class="canvas"></canvas>
        </div>
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
    }
    :host ::ng-deep .lok-toolbar {
      padding: 0.5rem 1rem;
      border-radius: 0;
      border: none;
      border-bottom: 1px solid var(--surface-border);
      background: var(--surface-card);
    }
    .viewport {
      flex: 1;
      overflow: auto;
      min-height: 0;
      background: var(--surface-ground);
      position: relative;
    }
    .canvas {
      display: block;
      image-rendering: pixelated;
    }
  `,
})
export class LokEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport') viewportRef!: ElementRef<HTMLDivElement>;

  @Input({ required: true }) tabId!: string;
  @Input({ required: true }) filePath!: string;

  private readonly lok = inject(LokService);
  private readonly tabs = inject(TabsService);

  error: string | null = null;
  status = 'Opening…';

  private docId: number | null = null;
  private widthTwips = 0;
  private heightTwips = 0;
  private scrollXtw = 0;
  private scrollYtw = 0;
  private renderPending: ReturnType<typeof setTimeout> | null = null;

  async ngAfterViewInit(): Promise<void> {
    try {
      const meta = await this.lok.open(this.filePath);
      this.docId = meta.docId;
      this.widthTwips = meta.widthTwips;
      this.heightTwips = meta.heightTwips;
      this.tabs.setLokMeta(this.tabId, meta);
      this.status = `${meta.widthTwips}×${meta.heightTwips} twips · doc #${meta.docId}`;
      await this.scheduleRender();
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : 'Failed to open document in LibreOfficeKit.';
      this.status = '';
    }
  }

  ngOnDestroy(): void {
    if (this.renderPending) clearTimeout(this.renderPending);
    if (this.docId != null) {
      void this.lok.close(this.docId);
    }
  }

  onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    this.scrollXtw += Math.round(ev.deltaX * TWIPS_PER_PX);
    this.scrollYtw += Math.round(ev.deltaY * TWIPS_PER_PX);
    this.scrollXtw = Math.max(0, this.scrollXtw);
    this.scrollYtw = Math.max(0, this.scrollYtw);
    void this.scheduleRender();
  }

  private async scheduleRender(): Promise<void> {
    if (this.renderPending) clearTimeout(this.renderPending);
    this.renderPending = setTimeout(() => {
      void this.render();
    }, 50);
  }

  private async render(): Promise<void> {
    const canvas = this.canvasRef?.nativeElement;
    const viewport = this.viewportRef?.nativeElement;
    if (!canvas || !viewport || this.docId == null) return;

    const w = Math.max(320, viewport.clientWidth);
    const h = Math.max(240, viewport.clientHeight - 4);
    canvas.width = w;
    canvas.height = h;

    const tileW = Math.min(this.widthTwips - this.scrollXtw, w * TWIPS_PER_PX);
    const tileH = Math.min(this.heightTwips - this.scrollYtw, h * TWIPS_PER_PX);

    try {
      const res = await this.lok.renderTile({
        docId: this.docId,
        tilePosX: this.scrollXtw,
        tilePosY: this.scrollYtw,
        tileWidth: tileW > 0 ? tileW : this.widthTwips,
        tileHeight: tileH > 0 ? tileH : this.heightTwips,
        canvasWidth: w,
        canvasHeight: h,
      });
      this.drawBgra(canvas, res);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Render failed';
    }
  }

  private drawBgra(
    canvas: HTMLCanvasElement,
    res: { buffer: ArrayBuffer | Uint8Array; width: number; height: number }
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const u8 = res.buffer instanceof Uint8Array ? res.buffer : new Uint8Array(res.buffer);
    const w = res.width;
    const h = res.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0, p = 0; i < u8.length && p < d.length; i += 4, p += 4) {
      const b = u8[i];
      const g = u8[i + 1];
      const r = u8[i + 2];
      const a = u8[i + 3];
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
  }
}
