import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error, validateInput } from './ipc-helpers'
import { getGuardrailsManager } from '../services/service-orchestrator'
import { z } from 'zod/v4'

export function registerGuardrailsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.GUARDRAILS.GET,
    (_event, repoPath: unknown) => {
      try {
        const validation = validateInput(z.string(), repoPath)
        if (!validation.valid) return validation.response
        const manager = getGuardrailsManager()
        if (!manager) {
          return error('GUARDRAILS_NOT_READY', 'Guardrails manager not initialized')
        }
        return success(manager.getGuardrails(validation.data))
      } catch (err) {
        log.error('Failed to get guardrails', err)
        return error('GUARDRAILS_ERROR', (err as Error).message)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GUARDRAILS.UPDATE,
    (_event, repoPath: unknown, key: unknown, value: unknown) => {
      try {
        const pathValidation = validateInput(z.string(), repoPath)
        if (!pathValidation.valid) return pathValidation.response
        const keyValidation = validateInput(z.string(), key)
        if (!keyValidation.valid) return keyValidation.response
        const manager = getGuardrailsManager()
        if (!manager) {
          return error('GUARDRAILS_NOT_READY', 'Guardrails manager not initialized')
        }
        const updated = manager.updateGuardrail(
          pathValidation.data,
          keyValidation.data as keyof import('../../shared/types/config.types').GuardrailConfig,
          value
        )
        return success(updated)
      } catch (err) {
        log.error('Failed to update guardrails', err)
        return error('GUARDRAILS_ERROR', (err as Error).message)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GUARDRAILS.RESET,
    (_event, repoPath: unknown) => {
      try {
        const validation = validateInput(z.string(), repoPath)
        if (!validation.valid) return validation.response
        const manager = getGuardrailsManager()
        if (!manager) {
          return error('GUARDRAILS_NOT_READY', 'Guardrails manager not initialized')
        }
        return success(manager.resetGuardrails(validation.data))
      } catch (err) {
        log.error('Failed to reset guardrails', err)
        return error('GUARDRAILS_ERROR', (err as Error).message)
      }
    }
  )

  log.info('Guardrails IPC handlers registered')
}
