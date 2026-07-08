/**
 * NewsEditor — rich article editor for the Super Admin news form.
 *
 * Fixes:
 *  - BodyEditor uses useEffect to set innerHTML ONCE on mount instead of
 *    dangerouslySetInnerHTML, which caused React to fight the DOM on every
 *    keystroke and reverse the text direction.
 *  - Cover upload uses file picker → Cloudinary → preview.
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
  type MouseEvent,
} from 'react';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function uploadNewsImage(file: File): Promise<string> {
  const token = localStorage.getItem('cc_token');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/api/uploads/news-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { detail?: string }).detail ?? `Upload failed (${res.status})`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      // preventDefault keeps focus on the editor when toolbar is clicked
      onMouseDown={(e) => { e.preventDefault(); onClick(e); }}
      className="news-editor__tool"
    >
      {children}
    </button>
  );
}

// ── Cover image picker ────────────────────────────────────────────────────────
export function CoverImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadNewsImage(file);
      onChange(url);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="news-cover-picker">
      {value ? (
        <div className="news-cover-picker__preview">
          <img src={value} alt="Cover" className="news-cover-picker__img" />
          <button
            type="button"
            className="news-cover-picker__remove"
            onClick={() => onChange('')}
            title="Remove cover image"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          className={`news-cover-picker__zone${uploading ? ' news-cover-picker__zone--busy' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="news-cover-picker__input"
            onChange={(e) => void handleFile(e)}
            disabled={uploading}
          />
          <span className="news-cover-picker__icon">🖼</span>
          <span className="news-cover-picker__label">
            {uploading ? 'Uploading…' : 'Upload cover image'}
          </span>
          <span className="news-cover-picker__hint">JPG / PNG / WEBP · max 3 MB</span>
        </label>
      )}
      {err && <p className="news-editor__err">{err}</p>}
    </div>
  );
}

// ── Body editor ───────────────────────────────────────────────────────────────
export function BodyEditor({
  initialValue = '',
  onChange,
}: {
  initialValue?: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const savedRange = useRef<Range | null>(null);

  // Set initial HTML exactly once on mount — never touch innerHTML again via React.
  // This is the correct pattern for contentEditable; dangerouslySetInnerHTML
  // causes React to overwrite DOM on every render and reverses typed text.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only on mount

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }

  const exec = useCallback(
    (cmd: string, val?: string) => {
      document.execCommand(cmd, false, val);
      editorRef.current?.focus();
      onChange(editorRef.current?.innerHTML ?? '');
    },
    [onChange],
  );

  function handleInput() {
    onChange(editorRef.current?.innerHTML ?? '');
  }

  async function handleImageFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadNewsImage(file);
      restoreSelection();
      // Insert figure with an editable caption
      document.execCommand(
        'insertHTML',
        false,
        `<figure class="news-body-img"><img src="${url}" alt="" /><figcaption class="news-body-caption" contenteditable="true" data-placeholder="Add a caption (optional)…"></figcaption></figure>`,
      );
      // Move cursor INTO the caption so the user can type it immediately
      const editor = editorRef.current;
      if (editor) {
        const captions = editor.querySelectorAll('figcaption.news-body-caption');
        const lastCaption = captions[captions.length - 1] as HTMLElement | null;
        if (lastCaption) {
          lastCaption.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(lastCaption, 0);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
      onChange(editorRef.current?.innerHTML ?? '');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  }

  function handleLink() {
    saveSelection();
    const url = window.prompt('Link URL (include https://):');
    if (!url) return;
    restoreSelection();
    exec('createLink', url);
  }

  // On paste — strip rich paste — only keep plain text
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    onChange(editorRef.current?.innerHTML ?? '');
  }

  // Handle Enter key — when inside a figcaption, first Enter exits to a new paragraph
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.getRangeAt(0).startContainer;
    // Check if we're inside a figcaption
    const caption = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element)
      ?.closest('figcaption');
    if (!caption) return;
    // Exit the caption: insert a <p> after the parent <figure> and move cursor there
    e.preventDefault();
    const figure = caption.closest('figure');
    if (!figure) return;
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    figure.after(p);
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    onChange(editorRef.current?.innerHTML ?? '');
  }

  return (
    <div className="news-editor">
      <div className="news-editor__toolbar" role="toolbar" aria-label="Formatting">
        <ToolBtn title="Bold" onClick={() => exec('bold')}><b>B</b></ToolBtn>
        <ToolBtn title="Italic" onClick={() => exec('italic')}><i>I</i></ToolBtn>
        <span className="news-editor__sep" />
        <ToolBtn title="Heading 2" onClick={() => exec('formatBlock', 'h2')}>H2</ToolBtn>
        <ToolBtn title="Heading 3" onClick={() => exec('formatBlock', 'h3')}>H3</ToolBtn>
        <ToolBtn title="Paragraph" onClick={() => exec('formatBlock', 'p')}>¶</ToolBtn>
        <ToolBtn title="Blockquote" onClick={() => exec('formatBlock', 'blockquote')}>"</ToolBtn>
        <span className="news-editor__sep" />
        <ToolBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>•</ToolBtn>
        <ToolBtn title="Numbered list" onClick={() => exec('insertOrderedList')}>1.</ToolBtn>
        <span className="news-editor__sep" />
        <ToolBtn title="Add link" onClick={handleLink}>🔗</ToolBtn>
        <ToolBtn
          title={uploading ? 'Uploading…' : 'Insert image'}
          onClick={() => { saveSelection(); imgInputRef.current?.click(); }}
        >
          {uploading ? '⏳' : '🖼'}
        </ToolBtn>
      </div>

      <input
        ref={imgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => void handleImageFile(e)}
      />

      {/* contentEditable — NO dangerouslySetInnerHTML, initial HTML set via useEffect */}
      <div
        ref={editorRef}
        className="news-editor__body"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder="Write your article here…"
        role="textbox"
        aria-multiline="true"
        aria-label="Article body"
      />

      {err && <p className="news-editor__err">{err}</p>}
    </div>
  );
}
