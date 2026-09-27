/**
 * Minimal headless-browser driver over the Chrome DevTools Protocol, so the
 * icon script needs no extra dependency. Uses Edge on Windows, or the browser
 * named in $BROWSER (any Chromium: chrome, chromium, msedge).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch() {
  const bin = CANDIDATES.find((p) => existsSync(p))
  if (!bin) throw new Error('No Chromium browser found; set $BROWSER to its path.')
  const profile = mkdtempSync(join(tmpdir(), 'medguard-cdp-'))
  const proc = spawn(bin, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })

  let port
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100)
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0] } catch { /* not yet */ }
  }
  if (!port) throw new Error('Browser did not start')
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))

  let id = 0
  const pending = new Map()
  const waiters = []
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.j(new Error(msg.error.message))
      else p.r(msg.result)
    } else for (const w of waiters.splice(0)) if (w.method === msg.method) w.r(); else waiters.push(w)
  }
  const send = (method, params = {}) =>
    new Promise((r, j) => (pending.set(++id, { r, j }), ws.send(JSON.stringify({ id, method, params }))))
  const once = (method) => new Promise((r) => waiters.push({ method, r }))

  await send('Page.enable')
  return {
    send,
    /** Sets the viewport, loads the URL and returns a PNG buffer. */
    async shot(url, { width, height, transparent = false, before } = {}) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      await send('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {})
      const loaded = once('Page.loadEventFired')
      await send('Page.navigate', { url })
      await loaded
      if (before) await before(send)
      await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
      await sleep(250)
      const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } })
      return Buffer.from(data, 'base64')
    },
    async close() {
      ws.close()
      proc.kill()
      await sleep(300)
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
    },
  }
}
