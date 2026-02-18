import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('../electron/main', () => ({
  RECORDINGS_DIR: '/recordings',
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  desktopCapturer: {
    getSources: vi.fn().mockResolvedValue([]),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/downloads'),
    getAppPath: vi.fn().mockReturnValue('/app'),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: class {},
}))

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
  },
}))

import { ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'
import { registerIpcHandlers } from '../electron/ipc/handlers'

describe('project save/load handlers', () => {
  const setupHandlers = () => {
    registerIpcHandlers(
      () => {},
      () => ({ close: vi.fn(), focus: vi.fn() }) as any,
      () => null,
      () => null,
    )
  }

  const getRegisteredHandler = (channel: string) => {
    const calls = (ipcMain.handle as unknown as Mock).mock.calls
    const match = calls.find(([name]) => name === channel)
    if (!match) {
      throw new Error(`Handler not found for channel: ${channel}`)
    }
    return match[1] as (...args: any[]) => Promise<any>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupHandlers()
  })

  it('overwrites existing project path without showing save dialog', async () => {
    const saveHandler = getRegisteredHandler('save-project-file')
    const projectData = { version: 1, videoPath: '/tmp/video.webm', editor: { zoomRegions: [] } }

    ;(fs.writeFile as unknown as Mock).mockResolvedValue(undefined)

    const result = await saveHandler({}, projectData, 'project-name', '/tmp/current.openscreen')

    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/current.openscreen',
      JSON.stringify(projectData, null, 2),
      'utf-8',
    )
    expect(result).toMatchObject({ success: true, path: '/tmp/current.openscreen' })
  })

  it('uses save dialog when no existing project path is provided', async () => {
    const saveHandler = getRegisteredHandler('save-project-file')
    const projectData = { version: 1, videoPath: '/tmp/video.webm', editor: { zoomRegions: [] } }

    ;(dialog.showSaveDialog as unknown as Mock).mockResolvedValue({
      canceled: false,
      filePath: '/tmp/new.openscreen',
    })
    ;(fs.writeFile as unknown as Mock).mockResolvedValue(undefined)

    const result = await saveHandler({}, projectData, 'new-project')

    expect(dialog.showSaveDialog).toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/new.openscreen',
      JSON.stringify(projectData, null, 2),
      'utf-8',
    )
    expect(result).toMatchObject({ success: true, path: '/tmp/new.openscreen' })
  })

  it('loads project JSON payload from selected file', async () => {
    const loadHandler = getRegisteredHandler('load-project-file')
    const serialized = JSON.stringify({ version: 1, videoPath: '/tmp/video.webm', editor: {} })

    ;(dialog.showOpenDialog as unknown as Mock).mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/example.openscreen'],
    })
    ;(fs.readFile as unknown as Mock).mockResolvedValue(serialized)

    const result = await loadHandler({})

    expect(dialog.showOpenDialog).toHaveBeenCalled()
    expect(fs.readFile).toHaveBeenCalledWith('/tmp/example.openscreen', 'utf-8')
    expect(result).toMatchObject({
      success: true,
      path: '/tmp/example.openscreen',
      project: { version: 1, videoPath: '/tmp/video.webm' },
    })
  })
})
