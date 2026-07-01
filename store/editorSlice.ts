import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type EditorState = { selectedItemId: string | null };
const initialState: EditorState = { selectedItemId: null };

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setSelectedItem(state, action: PayloadAction<string | null>) {
      state.selectedItemId = action.payload;
    },
  },
});

export const { setSelectedItem } = editorSlice.actions;
export default editorSlice.reducer;
