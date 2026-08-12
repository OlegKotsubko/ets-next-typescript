import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import editor from './editorSlice'
import { assetsApi } from './apis/assetsApi'
import { playersApi } from './apis/playersApi'
import { talentsApi } from './apis/talentsApi'
import { teamsApi } from './apis/teamsApi'
import { sponsorsApi } from './apis/sponsorsApi'
import { videosApi } from './apis/videosApi'
import { bracketsApi } from './apis/bracketsApi'
import { projectCssApi } from './apis/projectCssApi'
import { projectsApi } from './apis/projectsApi'
import { overlayPackagesApi } from './apis/overlayPackagesApi'
import { rundownsApi } from './apis/rundownsApi'

const rootReducer = combineReducers({
  editor,
  [assetsApi.reducerPath]: assetsApi.reducer,
  [playersApi.reducerPath]: playersApi.reducer,
  [talentsApi.reducerPath]: talentsApi.reducer,
  [teamsApi.reducerPath]: teamsApi.reducer,
  [sponsorsApi.reducerPath]: sponsorsApi.reducer,
  [videosApi.reducerPath]: videosApi.reducer,
  [bracketsApi.reducerPath]: bracketsApi.reducer,
  [projectCssApi.reducerPath]: projectCssApi.reducer,
  [projectsApi.reducerPath]: projectsApi.reducer,
  [overlayPackagesApi.reducerPath]: overlayPackagesApi.reducer,
  [rundownsApi.reducerPath]: rundownsApi.reducer,
})

const entityMiddleware = [
  assetsApi.middleware,
  playersApi.middleware,
  talentsApi.middleware,
  teamsApi.middleware,
  sponsorsApi.middleware,
  videosApi.middleware,
  bracketsApi.middleware,
  projectCssApi.middleware,
  projectsApi.middleware,
  overlayPackagesApi.middleware,
  rundownsApi.middleware,

] as any[]

export const store = configureStore({
  reducer: rootReducer,
   
  middleware: (getDefault) => getDefault().concat(...entityMiddleware) as any,
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
