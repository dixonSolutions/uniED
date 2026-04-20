/** LibreOffice-backed extensions (subset). */
const LOK_EXTENSIONS = new Set([
  'odt',
  'ods',
  'odp',
  'odg',
  'odf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'rtf',
  'csv',
]);

export type EditorKind = 'code' | 'lok';

export function editorKindForPath(filePath: string): EditorKind {
  const base = filePath.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (LOK_EXTENSIONS.has(ext)) return 'lok';
  return 'code';
}
