import { describe, it, expect } from 'vitest';
import { store } from '@/store';
import { setSelectedItem } from '@/store/editorSlice';

describe('store', () => {
  it('starts with no selected item', () => {
    expect(store.getState().editor.selectedItemId).toBeNull();
  });
  it('updates selection via dispatch', () => {
    store.dispatch(setSelectedItem('abc'));
    expect(store.getState().editor.selectedItemId).toBe('abc');
  });
});
