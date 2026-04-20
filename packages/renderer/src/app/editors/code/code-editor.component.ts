import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { Compartment, EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { FsService } from '../../services/fs.service';
import { ThemeService } from '../../services/theme.service';
import { TabsService } from '../../services/tabs.service';

function extensionForPath(filePath: string) {
  const base = filePath.split(/[/\\]/).pop() ?? '';
  const ext = base.includes('.') ? base.split('.').pop()?.toLowerCase() ?? '' : '';
  switch (ext) {
    case 'md':
    case 'markdown':
      return markdown();
    case 'json':
      return json();
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ typescript: ext === 'ts' || ext === 'tsx' });
    case 'py':
      return python();
    case 'yml':
    case 'yaml':
      return yaml();
    case 'html':
    case 'htm':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    default:
      return [];
  }
}

function cmTheme(isDark: boolean): Extension {
  if (isDark) return oneDark;
  return EditorView.theme(
    {
      '&': { height: '100%' },
      '.cm-scroller': {
        fontFamily: 'inherit',
        backgroundColor: 'var(--surface-ground)',
        color: 'var(--text-color)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--surface-50)',
        color: 'var(--text-color-secondary)',
        border: 'none',
        borderRight: '1px solid var(--surface-border)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'var(--surface-100)' },
      '.cm-activeLine': { backgroundColor: 'var(--surface-100)' },
    },
    { dark: false }
  );
}

@Component({
  selector: 'app-code-editor',
  standalone: true,
  template: ` <div class="wrap unied-code-host" #host></div> `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    .wrap {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    :host ::ng-deep .cm-editor {
      height: 100%;
      font-family: var(--font-mono);
      font-size: 13px;
    }
    :host ::ng-deep .cm-scroller {
      font-family: inherit;
    }
  `,
})
export class CodeEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host') host!: ElementRef<HTMLDivElement>;
  @Input({ required: true }) tabId!: string;
  @Input({ required: true }) filePath!: string;

  private readonly fs = inject(FsService);
  private readonly tabs = inject(TabsService);
  private readonly themeSvc = inject(ThemeService);
  private readonly themeComp = new Compartment();

  private view: EditorView | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private initial = '';

  constructor() {
    effect(() => {
      const isDark = this.themeSvc.isDark();
      if (!this.view) return;
      this.view.dispatch({
        effects: this.themeComp.reconfigure(cmTheme(isDark)),
      });
    });
  }

  ngAfterViewInit(): void {
    void this.loadAndBuild();
  }

  ngOnDestroy(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.view?.destroy();
    this.view = null;
  }

  private async loadAndBuild(): Promise<void> {
    const text = await this.fs.readFile(this.filePath);
    this.initial = text;
    const state = EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        extensionForPath(this.filePath),
        this.themeComp.of(cmTheme(this.themeSvc.isDark())),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          this.tabs.markDirty(this.tabId, u.state.doc.toString() !== this.initial);
          this.scheduleSave(u.state.doc.toString());
        }),
      ],
    });
    this.view = new EditorView({
      state,
      parent: this.host.nativeElement,
    });
  }

  private scheduleSave(content: string): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.fs.writeFile(this.filePath, content).then(() => {
        this.initial = content;
        this.tabs.markDirty(this.tabId, false);
      });
    }, 600);
  }
}
