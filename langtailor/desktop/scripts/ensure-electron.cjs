const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const requireElectron = createRequire(path.join(__dirname, '../node_modules/electron/package.json'))
const { downloadArtifact } = requireElectron('@electron/get')
const extract = requireElectron('extract-zip')

const electronDir = path.join(__dirname, '../node_modules/electron')

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === 'false') {
  delete process.env.ELECTRON_SKIP_BINARY_DOWNLOAD
}

const { version } = require(path.join(electronDir, 'package.json'))

function platformPath() {
  if (process.platform === 'win32') return 'electron.exe'
  if (process.platform === 'darwin') return 'Electron.app/Contents/MacOS/Electron'
  return 'electron'
}

function isInstalled() {
  try {
    const dist = path.join(electronDir, 'dist')
    const ver = fs.readFileSync(path.join(dist, 'version'), 'utf8').replace(/^v/, '')
    const recorded = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8')
    return ver === version && recorded === platformPath() && fs.existsSync(path.join(dist, platformPath()))
  } catch {
    return false
  }
}

async function main() {
  if (isInstalled()) {
    console.log(`Electron ${version} already installed`)
    return
  }
  console.log(`Downloading Electron ${version}...`)
  const zip = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
  })
  const dist = path.join(electronDir, 'dist')
  fs.rmSync(dist, { recursive: true, force: true })
  fs.mkdirSync(dist, { recursive: true })
  console.log(`Extracting ${zip}...`)
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Path '${zip.replace(/'/g, "''")}' -DestinationPath '${dist.replace(/'/g, "''")}' -Force`],
      { stdio: 'inherit' },
    )
  } else {
    await extract(zip, { dir: dist })
  }
  const srcType = path.join(dist, 'electron.d.ts')
  const dstType = path.join(electronDir, 'electron.d.ts')
  if (fs.existsSync(srcType)) fs.renameSync(srcType, dstType)
  fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath())
  fs.writeFileSync(path.join(dist, 'version'), `v${version}`)
  const exe = path.join(dist, platformPath())
  if (!fs.existsSync(exe)) {
    throw new Error(`Electron binary missing after extract: ${exe}`)
  }
  console.log(`Electron ${version} ready at ${exe}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
