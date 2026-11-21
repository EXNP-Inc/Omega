/** The API-key route follows the official listing only for the built-in catalog on the official endpoint. */
import { expect, it } from 'vitest'
import { resolveAdapterOptions as resolveProtocolOptions } from '@omega-ai/dsh-llm-omega'
import { Config, plainOptions, resolveAdapterOptions } from '../src/config.ts'

const LISTING = { url: 'http://127.0.0.1:8090/models', timeoutMs: 5_000, maxAgeMs: 600_000 }

it('follows the official listing while the catalog is the built-in one', () => {
  expect(resolveAdapterOptions({}).listing).toEqual(LISTING)
  expect(resolveAdapterOptions(plainOptions(Config({}))).listing).toEqual(LISTING)
  expect(resolveAdapterOptions({ models: [...resolveProtocolOptions({}).models] }).listing).toEqual(LISTING)
  expect(resolveAdapterOptions({ models: [] }).listing).toEqual(LISTING)
  expect(resolveAdapterOptions({ baseURL: 'http://127.0.0.1:8090/anthropic/v1', modelsTimeoutMs: 7, modelsMaxAgeMs: 0 }).listing)
    .toEqual({ url: 'http://127.0.0.1:8090/models', timeoutMs: 7, maxAgeMs: 0 })
})

it.each([
  [{ models: [{ id: 'custom' }] }],
  [{ baseURL: 'https://gateway.example/anthropic' }],
  [{ baseURL: 'http://api.omega.com/anthropic' }],
])('keeps its own catalog for %j', (options) => {
  expect(resolveAdapterOptions(options)).not.toHaveProperty('listing')
})

it.each([
  [{ modelsTimeoutMs: 0 }, /^llm-omega-api-key: modelsTimeoutMs must be a positive finite number/],
  [{ modelsMaxAgeMs: 1.5 }, /^llm-omega-api-key: modelsMaxAgeMs must be a non-negative safe integer/],
])('rejects %j', (options, message) => {
  expect(() => resolveAdapterOptions({ models: [{ id: 'custom' }], ...options })).toThrow(message)
})
