import { it, expect } from 'vitest'
import { rundownItemsApi } from '@/store/apis/rundownItemsApi'
import { titlesApi } from '@/store/apis/titlesApi'

it('rundownItemsApi exposes list/create/update/delete/reorder endpoints', () => {
  expect(Object.keys(rundownItemsApi.endpoints)).toEqual(
    expect.arrayContaining(['listItems', 'createItem', 'updateItem', 'deleteItem', 'reorderItems']),
  )
})
it('titlesApi exposes listTitles', () => {
  expect(Object.keys(titlesApi.endpoints)).toEqual(expect.arrayContaining(['listTitles']))
})
