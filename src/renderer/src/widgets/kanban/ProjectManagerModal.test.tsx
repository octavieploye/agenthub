import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectManagerModal } from './ProjectManagerModal'
import { useProjectStore } from '../../stores/project-store'
import type { Project } from '@shared/types/project.types'

const mockProject: Project = {
  id: 'proj-1',
  name: 'My Project',
  description: 'A test project',
  path: '/repo/foo',
  contextDoc: '# Context\nProject info here',
  contextDocUpdatedAt: '2026-06-24T00:00:00Z',
  createdAt: '2026-06-24T00:00:00Z',
  updatedAt: '2026-06-24T00:00:00Z'
}

describe('ProjectManagerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({
      projects: [mockProject],
      selectedProjectId: null
    })

    // Mock window.agentHub bridge
    ;(window.agentHub as any) = {
      db: {
        getRepos: vi.fn().mockResolvedValue({ success: true, data: [] })
      },
      projects: {
        getByRepo: vi.fn().mockResolvedValue({ success: true, data: [] })
      }
    }
  })

  describe('edit mode', () => {
    it('renders path and contextDoc fields when editing', async () => {
      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      // Wait for the modal to load
      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      // Click Edit button
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Wait for edit form to appear
      await waitFor(() => {
        const pathInput = screen.queryByDisplayValue('/repo/foo')
        expect(pathInput).toBeInTheDocument()
      })

      // Verify path input is visible with correct value
      const pathInput = screen.getByDisplayValue('/repo/foo') as HTMLInputElement
      expect(pathInput).toBeInTheDocument()
      expect(pathInput).toHaveAttribute('type', 'text')

      // Verify contextDoc textarea is visible with correct value
      const textareas = screen.getAllByRole('textbox')
      const contextDocTextarea = textareas.find((ta) => (ta as HTMLTextAreaElement).value.includes('# Context'))
      expect(contextDocTextarea).toBeInTheDocument()
      expect(contextDocTextarea?.tagName).toBe('TEXTAREA')
      expect((contextDocTextarea as HTMLTextAreaElement).value).toBe('# Context\nProject info here')
    })

    it('saves path and contextDoc when Save is clicked', async () => {
      const updateProject = vi.spyOn(useProjectStore.getState(), 'updateProject')
      updateProject.mockResolvedValue(true)

      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('/repo/foo')).toBeInTheDocument()
      })

      // Update path
      const pathInput = screen.getByDisplayValue('/repo/foo') as HTMLInputElement
      fireEvent.change(pathInput, { target: { value: '/new/path' } })

      // Update contextDoc - find it by searching for the textarea with the right content
      const textareas = screen.getAllByRole('textbox')
      const contextDocTextarea = textareas.find((ta) => (ta as HTMLTextAreaElement).value.includes('# Context')) as HTMLTextAreaElement
      fireEvent.change(contextDocTextarea, { target: { value: '# Updated' } })

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // Verify updateProject was called with new values
      await waitFor(() => {
        expect(updateProject).toHaveBeenCalledWith('proj-1', {
          name: 'My Project',
          description: 'A test project',
          path: '/new/path',
          contextDoc: '# Updated'
        })
      })
    })

    it('trims path and contextDoc before saving', async () => {
      const updateProject = vi.spyOn(useProjectStore.getState(), 'updateProject')
      updateProject.mockResolvedValue(true)

      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('/repo/foo')).toBeInTheDocument()
      })

      const pathInput = screen.getByDisplayValue('/repo/foo') as HTMLInputElement
      fireEvent.change(pathInput, { target: { value: '  /trimmed/path  ' } })

      const textareas = screen.getAllByRole('textbox')
      const contextDocTextarea = textareas.find((ta) => (ta as HTMLTextAreaElement).value.includes('# Context')) as HTMLTextAreaElement
      fireEvent.change(contextDocTextarea, { target: { value: '  # Trimmed  ' } })

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(updateProject).toHaveBeenCalledWith(
          'proj-1',
          expect.objectContaining({
            path: '/trimmed/path',
            contextDoc: '# Trimmed'
          })
        )
      })
    })

    it('converts empty path and contextDoc to null when saving', async () => {
      const updateProject = vi.spyOn(useProjectStore.getState(), 'updateProject')
      updateProject.mockResolvedValue(true)

      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('/repo/foo')).toBeInTheDocument()
      })

      const pathInput = screen.getByDisplayValue('/repo/foo') as HTMLInputElement
      fireEvent.change(pathInput, { target: { value: '' } })

      const textareas = screen.getAllByRole('textbox')
      const contextDocTextarea = textareas.find((ta) => (ta as HTMLTextAreaElement).value.includes('# Context')) as HTMLTextAreaElement
      fireEvent.change(contextDocTextarea, { target: { value: '' } })

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(updateProject).toHaveBeenCalledWith(
          'proj-1',
          expect.objectContaining({
            path: null,
            contextDoc: null
          })
        )
      })
    })
  })

  describe('view mode', () => {
    it('shows path when not editing and path is set', async () => {
      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      // Path should be visible in view mode
      expect(screen.getByText('/repo/foo')).toBeInTheDocument()
    })

    it('does not show path when path is null', async () => {
      const projectWithoutPath = { ...mockProject, path: null }
      useProjectStore.setState({
        projects: [projectWithoutPath],
        selectedProjectId: null
      })

      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      // Path should not be in the document when it's null
      expect(screen.queryByText('/repo/foo')).not.toBeInTheDocument()
    })
  })

  describe('cancel edit', () => {
    it('discards changes when Cancel is clicked', async () => {
      render(<ProjectManagerModal isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('/repo/foo')).toBeInTheDocument()
      })

      const pathInput = screen.getByDisplayValue('/repo/foo') as HTMLInputElement
      fireEvent.change(pathInput, { target: { value: '/different/path' } })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // After cancel, should be back in view mode showing original path
      expect(screen.getByText('/repo/foo')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('/different/path')).not.toBeInTheDocument()
    })
  })
})
