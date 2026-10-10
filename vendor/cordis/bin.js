#!/usr/bin/env node

import { Context } from '@omega-ai/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@omega-ai/cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@omega-ai/cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
