import { useState, useEffect } from 'preact/hooks';
import type { Snippet, SnippetShortcut } from '@/utils/types';
import {
  snippetsSetting,
  addSnippet,
  updateSnippet,
  deleteSnippet,
} from '@/utils/storage';
import type { StorageResult } from '@/utils/storage';

/** Format a shortcut for display (e.g., "Alt+Shift+1") */
function formatShortcut(shortcut?: SnippetShortcut): string {
  if (!shortcut?.key) return 'No shortcut';
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}

/** Estimate storage size of snippets array in bytes */
function estimateSize(snippets: Snippet[]): number {
  return JSON.stringify(snippets).length;
}

const QUOTA_WARNING_BYTES = 6 * 1024; // 6KB warning threshold

interface SnippetFormData {
  name: string;
  content: string;
  shortcutAlt: boolean;
  shortcutShift: boolean;
  shortcutCtrl: boolean;
  shortcutKey: string;
}

const emptyForm: SnippetFormData = {
  name: '',
  content: '',
  shortcutAlt: true,
  shortcutShift: true,
  shortcutCtrl: false,
  shortcutKey: '',
};

function formToShortcut(form: SnippetFormData): SnippetShortcut | undefined {
  if (!form.shortcutKey) return undefined;
  return {
    alt: form.shortcutAlt,
    shift: form.shortcutShift,
    ctrl: form.shortcutCtrl,
    key: form.shortcutKey,
  };
}

function snippetToForm(snippet: Snippet): SnippetFormData {
  return {
    name: snippet.name,
    content: snippet.content,
    shortcutAlt: snippet.shortcut?.alt ?? true,
    shortcutShift: snippet.shortcut?.shift ?? true,
    shortcutCtrl: snippet.shortcut?.ctrl ?? false,
    shortcutKey: snippet.shortcut?.key ?? '',
  };
}

export function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SnippetFormData>(emptyForm);
  const [createForm, setCreateForm] = useState<SnippetFormData>(emptyForm);
  const [quotaWarning, setQuotaWarning] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  /** Check a storage result and set/clear the error banner */
  function handleStorageResult(result: StorageResult): boolean {
    if (!result.ok) {
      setStorageError(result.message);
      return false;
    }
    setStorageError(null);
    return true;
  }

  // Load snippets on mount and watch for changes
  useEffect(() => {
    snippetsSetting.getValue().then(setSnippets);
    const unwatch = snippetsSetting.watch((newVal) => {
      if (newVal) {
        setSnippets(newVal);
        setQuotaWarning(estimateSize(newVal) > QUOTA_WARNING_BYTES);
      }
    });
    return () => {
      unwatch();
    };
  }, []);

  async function handleCreate() {
    if (!createForm.name.trim() || !createForm.content) return;
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      name: createForm.name.trim(),
      content: createForm.content,
      shortcut: formToShortcut(createForm),
    };
    const result = await addSnippet(snippet);
    if (handleStorageResult(result)) {
      setCreateForm(emptyForm);
    }
  }

  function startEdit(snippet: Snippet) {
    setEditingId(snippet.id);
    setEditForm(snippetToForm(snippet));
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.name.trim() || !editForm.content) return;
    const result = await updateSnippet(editingId, {
      name: editForm.name.trim(),
      content: editForm.content,
      shortcut: formToShortcut(editForm),
    });
    if (handleStorageResult(result)) {
      setEditingId(null);
      setEditForm(emptyForm);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this snippet?')) return;
    const result = await deleteSnippet(id);
    if (handleStorageResult(result)) {
      if (editingId === id) cancelEdit();
    }
  }

  /** Count invisible characters (spread handles surrogate pairs) */
  function invisibleCharCount(content: string): number {
    return [...content].length;
  }

  return (
    <div class="min-h-screen bg-gray-50 text-sm">
      <div class="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div class="mb-6">
          <h1 class="text-xl font-semibold text-gray-800">
            InvisibleUnicode Settings
          </h1>
          <p class="text-xs text-gray-500 mt-1">
            Manage your saved invisible Unicode snippets
          </p>
        </div>

        {/* Quota Warning */}
        {quotaWarning && (
          <div class="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-md text-xs text-yellow-800">
            Storage is getting full. Consider removing unused snippets to stay
            within the sync storage limit.
          </div>
        )}

        {/* Storage Error Banner */}
        {storageError && (
          <div class="mb-4 px-4 py-2 bg-red-50 border border-red-300 rounded-md text-xs text-red-800 flex items-center justify-between">
            <span>{storageError}</span>
            <button
              type="button"
              onClick={() => setStorageError(null)}
              class="ml-3 text-red-600 hover:text-red-800 font-bold text-sm leading-none"
              aria-label="Dismiss error"
            >
              X
            </button>
          </div>
        )}

        {/* Create Form */}
        <section class="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <h2 class="text-sm font-medium text-gray-700 mb-3">
            Create New Snippet
          </h2>
          <div class="flex flex-col gap-3">
            <input
              type="text"
              value={createForm.name}
              onInput={(e) =>
                setCreateForm({
                  ...createForm,
                  name: (e.target as HTMLInputElement).value,
                })
              }
              placeholder="Snippet name"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
            />
            <textarea
              value={createForm.content}
              onInput={(e) =>
                setCreateForm({
                  ...createForm,
                  content: (e.target as HTMLTextAreaElement).value,
                })
              }
              placeholder="Paste invisible Unicode content here..."
              class="w-full h-20 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm text-transparent"
            />
            {createForm.content && (
              <p class="text-xs text-gray-500">
                {invisibleCharCount(createForm.content)} invisible characters
              </p>
            )}

            {/* Shortcut configurator */}
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-xs text-gray-600">Shortcut:</span>
              <label class="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={createForm.shortcutAlt}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      shortcutAlt: (e.target as HTMLInputElement).checked,
                    })
                  }
                />
                Alt
              </label>
              <label class="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={createForm.shortcutShift}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      shortcutShift: (e.target as HTMLInputElement).checked,
                    })
                  }
                />
                Shift
              </label>
              <label class="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={createForm.shortcutCtrl}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      shortcutCtrl: (e.target as HTMLInputElement).checked,
                    })
                  }
                />
                Ctrl
              </label>
              <input
                type="text"
                maxLength={1}
                value={createForm.shortcutKey}
                onInput={(e) =>
                  setCreateForm({
                    ...createForm,
                    shortcutKey: (e.target as HTMLInputElement).value,
                  })
                }
                placeholder="Key"
                class="w-12 px-2 py-1 border border-gray-300 rounded-md text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!createForm.name.trim() || !createForm.content}
              class="self-start px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save Snippet
            </button>
          </div>
        </section>

        {/* Snippet List */}
        <section>
          <h2 class="text-sm font-medium text-gray-700 mb-3">
            Saved Snippets ({snippets.length})
          </h2>

          {snippets.length === 0 ? (
            <p class="text-xs text-gray-400 italic">
              No snippets saved yet. Create one above.
            </p>
          ) : (
            <div class="flex flex-col gap-3">
              {snippets.map((snippet) =>
                editingId === snippet.id ? (
                  /* Inline Edit Form */
                  <div
                    key={snippet.id}
                    class="p-4 bg-white rounded-lg border-2 border-blue-300"
                  >
                    <div class="flex flex-col gap-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onInput={(e) =>
                          setEditForm({
                            ...editForm,
                            name: (e.target as HTMLInputElement).value,
                          })
                        }
                        placeholder="Snippet name"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                      />
                      <textarea
                        value={editForm.content}
                        onInput={(e) =>
                          setEditForm({
                            ...editForm,
                            content: (e.target as HTMLTextAreaElement).value,
                          })
                        }
                        placeholder="Paste invisible Unicode content here..."
                        class="w-full h-20 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm text-transparent"
                      />
                      {editForm.content && (
                        <p class="text-xs text-gray-500">
                          {invisibleCharCount(editForm.content)} invisible
                          characters
                        </p>
                      )}

                      {/* Shortcut configurator */}
                      <div class="flex items-center gap-3 flex-wrap">
                        <span class="text-xs text-gray-600">Shortcut:</span>
                        <label class="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.shortcutAlt}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                shortcutAlt: (e.target as HTMLInputElement)
                                  .checked,
                              })
                            }
                          />
                          Alt
                        </label>
                        <label class="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.shortcutShift}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                shortcutShift: (e.target as HTMLInputElement)
                                  .checked,
                              })
                            }
                          />
                          Shift
                        </label>
                        <label class="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.shortcutCtrl}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                shortcutCtrl: (e.target as HTMLInputElement)
                                  .checked,
                              })
                            }
                          />
                          Ctrl
                        </label>
                        <input
                          type="text"
                          maxLength={1}
                          value={editForm.shortcutKey}
                          onInput={(e) =>
                            setEditForm({
                              ...editForm,
                              shortcutKey: (e.target as HTMLInputElement).value,
                            })
                          }
                          placeholder="Key"
                          class="w-12 px-2 py-1 border border-gray-300 rounded-md text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div class="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={
                            !editForm.name.trim() || !editForm.content
                          }
                          class="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          class="px-4 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Snippet Display Row */
                  <div
                    key={snippet.id}
                    class="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-4"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-gray-800 truncate">
                        {snippet.name}
                      </p>
                      <p class="text-xs text-gray-500 mt-0.5">
                        [{invisibleCharCount(snippet.content)} invisible chars]
                      </p>
                      <p class="text-xs text-gray-400 mt-0.5">
                        {formatShortcut(snippet.shortcut)}
                      </p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(snippet)}
                        class="px-3 py-1 text-xs text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(snippet.id)}
                        class="px-3 py-1 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
