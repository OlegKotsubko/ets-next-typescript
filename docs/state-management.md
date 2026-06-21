# State Management

ETS uses **Redux Toolkit** + **RTK Query** for the admin UI.

- **RTK Query** handles all server cache (entities, rundowns, projects). It replaces SWR / React Query for our purposes.
- **Redux Toolkit slices** hold ephemeral client UI state — the currently-selected title in the rundown editor, the controller's HIDE/AIR state, the "current project" context.

Broadcast pages (`/preview`, `/air`) do **not** use Redux at all. They subscribe directly to SSE; everything they need flows through the `data` prop.

## Store setup

```ts
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { projectsApi } from './apis/projectsApi';
import { playersApi } from './apis/playersApi';
import { teamsApi } from './apis/teamsApi';
import { sponsorsApi } from './apis/sponsorsApi';
import { assetsApi } from './apis/assetsApi';
import { videosApi } from './apis/videosApi';
import { bracketsApi } from './apis/bracketsApi';
import { projectCssApi } from './apis/projectCssApi';
import { rundownsApi } from './apis/rundownsApi';
import { editorSlice } from './slices/editorSlice';

export const store = configureStore({
  reducer: {
    [projectsApi.reducerPath]: projectsApi.reducer,
    [playersApi.reducerPath]: playersApi.reducer,
    [teamsApi.reducerPath]: teamsApi.reducer,
    [sponsorsApi.reducerPath]: sponsorsApi.reducer,
    [assetsApi.reducerPath]: assetsApi.reducer,
    [videosApi.reducerPath]: videosApi.reducer,
    [bracketsApi.reducerPath]: bracketsApi.reducer,
    [projectCssApi.reducerPath]: projectCssApi.reducer,
    [rundownsApi.reducerPath]: rundownsApi.reducer,
    editor: editorSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(
    projectsApi.middleware,
    playersApi.middleware,
    teamsApi.middleware,
    sponsorsApi.middleware,
    assetsApi.middleware,
    videosApi.middleware,
    bracketsApi.middleware,
    projectCssApi.middleware,
    rundownsApi.middleware,
  ),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```tsx
// app/admin/layout.tsx (client portion)
'use client';
import { Provider } from 'react-redux';
import { store } from '@/store';

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
```

## RTK Query: one API slice per entity

The template every entity follows (Players shown; the others are identical apart from names and types):

```ts
// store/apis/playersApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Player, CreatePlayerInput, UpdatePlayerInput } from '@/types/players';

export const playersApi = createApi({
  reducerPath: 'playersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Player'],
  endpoints: (b) => ({
    listPlayers: b.query<Player[], string>({
      query: (projectId) => `/projects/${projectId}/players`,
      providesTags: (_r, _e, projectId) => [{ type: 'Player', id: `LIST:${projectId}` }],
    }),
    getPlayer: b.query<Player, { projectId: string; id: string }>({
      query: ({ projectId, id }) => `/projects/${projectId}/players/${id}`,
      providesTags: (_r, _e, { id }) => [{ type: 'Player', id }],
    }),
    createPlayer: b.mutation<Player, { projectId: string; data: CreatePlayerInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/players`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Player', id: `LIST:${projectId}` }],
    }),
    updatePlayer: b.mutation<Player, { projectId: string; id: string; data: UpdatePlayerInput }>({
      query: ({ projectId, id, data }) => ({
        url: `/projects/${projectId}/players/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_r, _e, { projectId, id }) => [
        { type: 'Player', id },
        { type: 'Player', id: `LIST:${projectId}` },
      ],
    }),
    deletePlayer: b.mutation<void, { projectId: string; id: string }>({
      query: ({ projectId, id }) => ({
        url: `/projects/${projectId}/players/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { projectId, id }) => [
        { type: 'Player', id },
        { type: 'Player', id: `LIST:${projectId}` },
      ],
    }),
  }),
});

export const {
  useListPlayersQuery,
  useGetPlayerQuery,
  useCreatePlayerMutation,
  useUpdatePlayerMutation,
  useDeletePlayerMutation,
} = playersApi;
```

### The tag pattern

Every tag includes the **project ID** in its identifier. This is critical: switching projects in the admin must not show cached players from the previous project.

- `[{ type: 'Player', id: 'LIST:atl' }]` — the list of players in project `atl`.
- `[{ type: 'Player', id: '<uuid>' }]` — a single player.

Mutations invalidate both the specific row and the project-scoped list. RTK Query auto-refetches subscribed queries.

## Ephemeral UI state: the `editor` slice

The rundown editor needs some state that **shouldn't** live on the server: which rundown item is currently selected, whether the operator preview panel is open, the in-flight HIDE/AIR state.

```ts
// store/slices/editorSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type EditorState = {
  selectedItemId: string | null;
  onAirItemId: string | null;            // mirror of broadcast bus state for UI highlighting
  previewVisible: boolean;
};

const initialState: EditorState = {
  selectedItemId: null,
  onAirItemId: null,
  previewVisible: true,
};

export const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    selectItem(state, action: PayloadAction<string | null>) {
      state.selectedItemId = action.payload;
    },
    setOnAir(state, action: PayloadAction<string | null>) {
      state.onAirItemId = action.payload;
    },
    togglePreview(state) {
      state.previewVisible = !state.previewVisible;
    },
  },
});

export const { selectItem, setOnAir, togglePreview } = editorSlice.actions;
```

Use it from a component:

```tsx
import { useDispatch, useSelector } from 'react-redux';
import { selectItem } from '@/store/slices/editorSlice';
import type { RootState } from '@/store';

const selectedId = useSelector((s: RootState) => s.editor.selectedItemId);
const dispatch = useDispatch();
// dispatch(selectItem(item.id));
```

## When to use which

| Need | Mechanism |
|---|---|
| List, get, create, update, delete an entity | RTK Query (one of the APIs above) |
| Currently-selected title in the editor | `editor` slice |
| What's on AIR right now (for highlighting in the UI) | `editor.onAirItemId`, updated by the same SSE stream the broadcast page uses |
| Optimistic UI on a mutation | RTK Query's `onQueryStarted` |
| Pure derived data (filtered list, sorted) | `useMemo` in the component or `createSelector` |
| Form state (in-progress edits before save) | Local `useState` or a form library (uncontrolled `<form>` is fine for our scale) |

## Why RTK Query and not React Query / SWR

- We're already using Redux Toolkit for the `editor` slice; one library is simpler than two.
- RTK Query's tag invalidation maps cleanly onto our project-scoped cache requirements.
- DevTools support is excellent — easier to debug than the alternatives.

This is a judgment call, not a strong technical reason. If you have an existing React Query setup elsewhere, swap it in — the rest of the docs don't depend on the specific choice.

## Anti-patterns

- **Storing server data in a slice.** Use RTK Query. The cache, invalidation, and refetch logic is free.
- **Calling `fetch` from a component.** Always go through an RTK Query endpoint so the data is cached and revalidated correctly.
- **Forgetting the `projectId` in a tag.** Bug: switching projects shows stale data.
- **Putting the broadcast page in the Provider tree.** `/preview` and `/air` do not need Redux — keep them lean.
