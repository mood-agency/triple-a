import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

const searchPluginKey = new PluginKey('search-highlight');

export interface SearchHighlightOptions {
  searchTerm: string;
  currentMatchIndex: number;
}

export interface SearchHighlightStorage {
  searchTerm: string;
  currentMatchIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchHighlight: (searchTerm: string, currentMatchIndex: number) => ReturnType;
      clearSearchHighlight: () => ReturnType;
    };
  }
}

export const SearchHighlightExtension = Extension.create<SearchHighlightOptions, SearchHighlightStorage>({
  name: 'searchHighlight',

  addOptions() {
    return {
      searchTerm: '',
      currentMatchIndex: 0,
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      currentMatchIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchHighlight:
        (searchTerm: string, currentMatchIndex: number) =>
        ({ tr, dispatch }: { tr: Transaction; dispatch: ((tr: Transaction) => void) | undefined }) => {
          this.storage.searchTerm = searchTerm;
          this.storage.currentMatchIndex = currentMatchIndex;
          // Dispatch transaction to trigger update
          if (dispatch) {
            tr.setMeta('searchHighlightUpdate', true);
            dispatch(tr);
          }
          return true;
        },
      clearSearchHighlight:
        () =>
        ({ tr, dispatch }: { tr: Transaction; dispatch: ((tr: Transaction) => void) | undefined }) => {
          this.storage.searchTerm = '';
          this.storage.currentMatchIndex = 0;
          if (dispatch) {
            tr.setMeta('searchHighlightUpdate', true);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr: Transaction, oldState: DecorationSet) {
            const searchTerm = extension.storage.searchTerm;
            const currentMatchIndex = extension.storage.currentMatchIndex;

            if (!searchTerm) return DecorationSet.empty;

            // Recalculate if document changed or search was updated
            const searchUpdated = tr.getMeta('searchHighlightUpdate');
            if (tr.docChanged || searchUpdated) {
              const decorations: Decoration[] = [];
              const { doc } = tr;
              let matchIndex = 0;

              doc.descendants((node: PMNode, pos: number) => {
                if (node.isText && node.text) {
                  const text = node.text.toLowerCase();
                  const search = searchTerm.toLowerCase();
                  let start = 0;

                  while ((start = text.indexOf(search, start)) !== -1) {
                    const isCurrent = matchIndex === currentMatchIndex;
                    decorations.push(
                      Decoration.inline(pos + start, pos + start + searchTerm.length, {
                        class: isCurrent ? 'search-result-current' : 'search-result-highlight',
                      })
                    );
                    matchIndex++;
                    start += searchTerm.length;
                  }
                }
              });

              return DecorationSet.create(doc, decorations);
            }

            return oldState.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state: EditorState) {
            return searchPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
