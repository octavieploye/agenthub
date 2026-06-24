import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod/v4'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getAllProjects, insertProject, updateProject, deleteProject, getProjectById } from '../db/queries/projects.queries'
import { linkRepoToProject, unlinkRepoFromProject, getProjectsByRepoId } from '../db/queries/project-repos.queries'
import { validateInput, success, error } from './ipc-helpers'

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  contextDoc: z.string().nullable().optional()
})

const idSchema = z.string().min(1)

export function registerProjectsHandlers(db: Database.Database): void {
  ipcMain.handle(IPC_CHANNELS.PROJECTS.LIST, () => {
    try {
      return success(getAllProjects(db))
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.CREATE, (_event, input: unknown) => {
    try {
      const parsed = validateInput(createProjectSchema, input)
      if (!parsed.valid) return parsed.response
      return success(insertProject(db, parsed.data))
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.UPDATE, (_event, id: unknown, input: unknown) => {
    try {
      const idParsed = validateInput(idSchema, id)
      if (!idParsed.valid) return idParsed.response
      const inputParsed = validateInput(updateProjectSchema, input)
      if (!inputParsed.valid) return inputParsed.response

      const existing = getProjectById(db, idParsed.data)
      if (existing?.path && inputParsed.data.path !== undefined && inputParsed.data.path !== existing.path) {
        rmSync(join(existing.path, '.claude', 'workspace_memory.md'), { force: true })
      }

      const updated = updateProject(db, idParsed.data, inputParsed.data)
      return updated
        ? success(updated)
        : error('NOT_FOUND', 'Project not found')
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.DELETE, (_event, id: unknown) => {
    try {
      const parsed = validateInput(idSchema, id)
      if (!parsed.valid) return parsed.response
      const project = getProjectById(db, parsed.data)
      if (project?.path) {
        rmSync(join(project.path, '.claude', 'workspace_memory.md'), { force: true })
      }
      deleteProject(db, parsed.data)
      return success(undefined)
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.GET_BY_REPO, (_event, repoId: unknown) => {
    try {
      const parsed = validateInput(idSchema, repoId)
      if (!parsed.valid) return parsed.response
      return success(getProjectsByRepoId(db, parsed.data))
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.LINK_REPO, (_event, projectId: unknown, repoId: unknown) => {
    try {
      const pParsed = validateInput(idSchema, projectId)
      if (!pParsed.valid) return pParsed.response
      const rParsed = validateInput(idSchema, repoId)
      if (!rParsed.valid) return rParsed.response
      linkRepoToProject(db, pParsed.data, rParsed.data)
      return success(undefined)
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS.UNLINK_REPO, (_event, projectId: unknown, repoId: unknown) => {
    try {
      const pParsed = validateInput(idSchema, projectId)
      if (!pParsed.valid) return pParsed.response
      const rParsed = validateInput(idSchema, repoId)
      if (!rParsed.valid) return rParsed.response
      unlinkRepoFromProject(db, pParsed.data, rParsed.data)
      return success(undefined)
    } catch (err) {
      return error('PROJECTS_ERROR', String(err))
    }
  })

  log.info('Projects IPC handlers registered')
}
