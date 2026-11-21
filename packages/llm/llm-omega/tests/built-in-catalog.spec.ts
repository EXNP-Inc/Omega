/** Recognizing the built-in catalog, which is how an uncustomized `models` setting resolves. */
import { expect, it } from 'vitest'
import { Config, isBuiltInCatalog, plainOptions, resolveAdapterOptions } from '../src/config.ts'
import { DEFAULT_MODELS } from '../src/models.ts'

it('recognizes the built-in catalog however it was supplied', () => {
  expect(isBuiltInCatalog(resolveAdapterOptions({}).models)).toBe(true)
  expect(isBuiltInCatalog(resolveAdapterOptions({ models: structuredClone(DEFAULT_MODELS) }).models)).toBe(true)
  expect(isBuiltInCatalog(resolveAdapterOptions(plainOptions(Config({}))).models)).toBe(true)
})

it('treats any other catalog as customized', () => {
  expect(isBuiltInCatalog(resolveAdapterOptions({ models: [{ id: 'omega-flash', inputModalities: ['text'] }] }).models)).toBe(false)
  expect(isBuiltInCatalog(resolveAdapterOptions({ models: [{ id: 'omega-flash' }, { id: 'omega-v4-pro' }] }).models)).toBe(false)
  expect(isBuiltInCatalog(resolveAdapterOptions({ models: [{ id: 'omega-flash', maxTokens: 321 }] }).models)).toBe(false)
})
