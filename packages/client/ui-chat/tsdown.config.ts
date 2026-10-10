import { clientBundle } from '../tsdown.client.ts'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const bundle = clientBundle('@omega-ai/dsh-client-ui-chat', ['lib/types/index.js'])
const stylesheet = fileURLToPath(new URL('./src/client/chat/ChatView.module.css', import.meta.url)).replaceAll('\\', '/')
const omegaImage = fileURLToPath(new URL('./src/client/chat/running-omega@2x.png', import.meta.url))

export default ((options) => bundle(options).map(config => ({
  ...config,
  plugins: [...(config.plugins ?? []), {
    name: 'chat-omega-image',
    async transform(code: string, id: string) {
      if (id.replaceAll('\\', '/') !== `\0dsh-css:${stylesheet}.mjs`) return null
      const imageUrl = './running-omega@2x.png'
      if (!code.includes(imageUrl)) return null
      this.addWatchFile(omegaImage)
      const image = await readFile(omegaImage)
      return { code: code.replaceAll(imageUrl, `data:image/png;base64,${image.toString('base64')}`), map: null }
    },
  }],
}))) satisfies typeof bundle
