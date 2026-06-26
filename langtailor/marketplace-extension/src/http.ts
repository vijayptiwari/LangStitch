import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'

function pickClient(url: string): typeof http | typeof https {
  return url.startsWith('https:') ? https : http
}

/** GET JSON, following redirects. A bearer token is sent only when provided. */
export function getJson<T>(url: string, token?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const req = pickClient(url).get(url, { headers }, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        resolve(getJson<T>(new URL(res.headers.location, url).toString(), token))
        return
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (status >= 400) {
          reject(new Error(`HTTP ${status}: ${body.slice(0, 200)}`))
          return
        }
        try {
          resolve(JSON.parse(body) as T)
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
    })
    req.on('error', reject)
  })
}

/** Download a (binary) file to ``dest``, following redirects. */
export function downloadFile(url: string, dest: string, token?: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const req = pickClient(url).get(url, { headers }, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        resolve(downloadFile(new URL(res.headers.location, url).toString(), dest, token))
        return
      }
      if (status >= 400) {
        res.resume()
        reject(new Error(`HTTP ${status} downloading ${url}`))
        return
      }
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => file.close((err) => (err ? reject(err) : resolve())))
      file.on('error', reject)
    })
    req.on('error', reject)
  })
}
