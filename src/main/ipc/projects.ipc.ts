import { ipcMain } from 'electron'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getAllProjects, insertProject, updateProject, deleteProject } from '../db/queries/projects.queries'
import { linkRepoToProject, unlinkRepoFromProject, getProjectsByRepoId } from '../db/queries/project-repos.queries'
import type { CreateProjectInput, UpdateProjectInput } from '../../shared/types/project.types'

export function registerProjectHandlers(db: Database.Database): void {
  ipcMain.handle(IPC_CHANNELS.PROJECTS.LIST, () => {
    try {
      return { success: true, data: getAllProjects(db) }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.CREATE, (_event, input: CreateProjectInput) => {
    try {
      return { success: true, data: insertProject(db, input) }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.UPDATE, (_event, id: string, input: UpdateProjectInput) => {
    try {
      const updated = updateProject(db, id, input)
      return updated
        ? { success: true, data: updated }
        : { success: false, error: { message: 'Project not found' } }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.DELETE, (_event, id: string) => {
    try {
      deleteProject(db, id)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.GET_BY_REPO, (_event, repoId: string) => {
    try {
      return { success: true, data: getProjectsByRepoId(db, repoId) }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.LINK_REPO, (_event, projectId: string, repoId: string) => {
    try {
      linkRepoToProject(db, projectId, repoId)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.UNLINK_REPO, (_event, projectId: string, repoId: string) => {
    try {
      unlinkRepoFromProject(db, projectId, repoId)
      return { success: true }
    } catch (err) {
      return { success: false, error: { message: String(err) } }
    }
  })

  log.info('Projects IPC handlers registered')
}
