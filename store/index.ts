import { configureStore } from '@reduxjs/toolkit';
import editor from './editorSlice';

export const store = configureStore({
  reducer: { editor },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
