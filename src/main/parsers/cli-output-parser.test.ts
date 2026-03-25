import { describe, it, expect, beforeEach } from 'vitest'
import { ClaudeCliOutputParser } from './cli-output-parser'

describe('ClaudeCliOutputParser', () => {
  let parser: ClaudeCliOutputParser

  beforeEach(() => {
    parser = new ClaudeCliOutputParser()
  })

  describe('locked state detection', () => {
    it('detects prompt character as locked', () => {
      const result = parser.parse('? Do you want to proceed?')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects y/n prompt as awaiting_approval', () => {
      const result = parser.parse('Continue? (y/n)')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects Claude CLI tool approval as awaiting_approval', () => {
      const result = parser.parse('Do you want to create test.md?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })
  })

  describe('completed state detection', () => {
    it('detects task completed', () => {
      const result = parser.parse('task completed successfully')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('detects checkmark completion', () => {
      const result = parser.parse('✓ All tasks completed')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })
  })

  describe('busy state detection', () => {
    it('detects spinner as busy', () => {
      const result = parser.parse('⠋ Processing...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects thinking indicator as busy', () => {
      const result = parser.parse('thinking...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects Inferring status as busy', () => {
      const result = parser.parse('✻ Inferring…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })
  })

  describe('no match', () => {
    it('returns null for unrecognized output', () => {
      const result = parser.parse('some random text')
      expect(result).toBeNull()
    })
  })

  describe('buffer management', () => {
    it('resets buffer after status match so old patterns do not persist', () => {
      // First parse matches busy (spinner) and resets buffer
      parser.parse('✻ Inferring…')
      // Next parse should NOT still see the spinner
      const result = parser.parse('some random text')
      expect(result).toBeNull()
    })

    it('accumulates buffer when no match to handle multi-chunk patterns', () => {
      parser.parse('Do you want ')
      const result = parser.parse('to create file.md?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('resets buffer explicitly', () => {
      parser.parse('? prompt')
      parser.resetBuffer()
      const result = parser.parse('some random text')
      expect(result).toBeNull()
    })
  })

  describe('false positive prevention', () => {
    it('does NOT trigger locked for question mark in normal prose', () => {
      const result = parser.parse('What is the meaning of life? I think it depends on context.')
      expect(result?.status).not.toBe('locked')
    })

    it('does NOT trigger locked for > in a code block or quote', () => {
      const result = parser.parse('The output was:\n```\nif (a > b) {\n  return a\n}\n```')
      expect(result?.status).not.toBe('locked')
    })

    it('does NOT trigger locked for > at end of HTML/XML tag', () => {
      const result = parser.parse('Created the file with <div> and <span> tags.')
      expect(result?.status).not.toBe('locked')
    })

    it('does NOT trigger locked for "allow" in normal prose', () => {
      const result = parser.parse('This configuration will allow users to set preferences.')
      expect(result?.status).not.toBe('locked')
    })

    it('does NOT trigger locked for "approve" in normal prose', () => {
      const result = parser.parse('The manager will approve the request later.')
      expect(result?.status).not.toBe('locked')
    })

    it('does NOT trigger locked for "deny" in normal prose', () => {
      const result = parser.parse('The server may deny the connection if credentials are invalid.')
      expect(result?.status).not.toBe('locked')
    })
  })

  describe('real Claude CLI prompt detection', () => {
    it('detects ❯ prompt as locked (Claude CLI v2.x idle)', () => {
      const result = parser.parse('❯ ')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects ? at start of line as a confirmation prompt', () => {
      const result = parser.parse('? Are you sure you want to proceed?')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects generic (y/n) prompt as awaiting_approval', () => {
      const result = parser.parse('Continue with operation? (y/n)')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects [Y/n] prompt', () => {
      const result = parser.parse('Do you want to continue? [Y/n]')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects "press enter to continue"', () => {
      const result = parser.parse('Press enter to continue...')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects "waiting for input"', () => {
      const result = parser.parse('waiting for input')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects Claude CLI write approval prompt', () => {
      const result = parser.parse('Do you want to write to config.json?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })
  })

  describe('error patterns removed (false positives from code content)', () => {
    it('does NOT detect error: as error — Claude writes code about error handling', () => {
      const result = parser.parse('error: something went wrong')
      expect(result).toBeNull()
    })

    it('does NOT detect failed: as error', () => {
      const result = parser.parse('failed: build step')
      expect(result).toBeNull()
    })

    it('does NOT detect exception as error', () => {
      const result = parser.parse('catch (exception) { handle(); }')
      expect(result).toBeNull()
    })
  })

  describe('awaiting_approval state detection', () => {
    it('detects "Do you want to create" as awaiting_approval', () => {
      const result = parser.parse('Do you want to create test.md?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects "Do you want to write" as awaiting_approval', () => {
      const result = parser.parse('Do you want to write to config.json?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects "Do you want to edit" as awaiting_approval', () => {
      const result = parser.parse('Do you want to edit src/main.ts?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects "Do you want to delete" as awaiting_approval', () => {
      const result = parser.parse('Do you want to delete old-file.txt?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects "Do you want to run" as awaiting_approval', () => {
      const result = parser.parse('Do you want to run npm test?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('does not detect "Do you want to" without a tool verb', () => {
      const result = parser.parse('Do you want to continue with the next step?')
      expect(result?.status).not.toBe('awaiting_approval')
    })

    it('(y/n) is an approval pattern, returns awaiting_approval', () => {
      const result = parser.parse('Continue? (y/n)')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('resets looping history on approval detection', () => {
      // Simulate several locked transitions
      for (let i = 0; i < 6; i++) {
        parser.resetBuffer()
        parser.parse('? prompt')
      }
      // Approval should reset the counter
      parser.resetBuffer()
      parser.parse('Do you want to create file.md?')
      // Now locked should NOT trigger looping
      parser.resetBuffer()
      const result = parser.parse('? prompt')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })
  })

  describe('looping detection', () => {
    it('detects looping when locked transitions exceed threshold (8) in 30s', () => {
      // Simulate rapid busy->locked oscillations
      for (let i = 0; i < 7; i++) {
        parser.resetBuffer()
        parser.parse('\u28CB Processing...')
        parser.resetBuffer()
        parser.parse('? Do you want to proceed?')
      }
      parser.resetBuffer()
      parser.parse('\u28CB Processing...')
      parser.resetBuffer()
      const result = parser.parse('? Do you want to proceed?')
      expect(result).toEqual({ status: 'looping', confidence: 'inferred' })
    })

    it('does not detect looping for fewer than 8 locked transitions', () => {
      for (let i = 0; i < 3; i++) {
        parser.resetBuffer()
        parser.parse('\u28CB Processing...')
        parser.resetBuffer()
        parser.parse('? prompt')
      }
      parser.resetBuffer()
      parser.parse('\u28CB Processing...')
      parser.resetBuffer()
      const result = parser.parse('? prompt')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })
  })

  describe('Claude CLI v2.x patterns', () => {
    it('detects decorative spinner ✻ as busy', () => {
      const result = parser.parse('✻ Bootstrapping…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects decorative spinner ✳ as busy', () => {
      const result = parser.parse('✳ thinking with low effort')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects decorative spinner ✢ as busy', () => {
      const result = parser.parse('✢')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects "Brewing" status as busy', () => {
      const result = parser.parse('✻ Brewing… ')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects "Deciphering" status as busy', () => {
      const result = parser.parse('· Deciphering… ')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects "Done!" as completed', () => {
      const result = parser.parse('Done! Created test.md with hello inside.')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('strips ANSI codes and replaces cursor movement with spaces', () => {
      // Simulates: "Do you want to create file" with ANSI cursor movements
      const result = parser.parse('Do\x1b[1Cyou\x1b[1Cwant\x1b[1Cto\x1b[1Ccreate\x1b[1Cfile.md?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('replaces \\x1b[nC] cursor movement with n spaces for pattern matching', () => {
      // Claude CLI v2.x uses cursor-right instead of literal spaces
      const result = parser.parse('Do\x1b[1Cyou\x1b[1Cwant\x1b[1Cto\x1b[1Ccreate\x1b[1C\x1b[1mtest.md\x1b[22m?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('completion takes priority over busy spinner in same buffer', () => {
      const result = parser.parse('Done! Created file.\n✻ Spelunking…')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('after completion, buffer resets so next idle detects locked', () => {
      parser.parse('Done! Created file.')
      // Buffer was reset by completion detection
      const result = parser.parse('❯ ')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects Claude CLI tool approval prompt with cursor-movement spaces', () => {
      // Real Claude CLI v2.x uses \x1b[1C instead of literal spaces
      const result = parser.parse(
        'Do\x1b[1Cyou\x1b[1Cwant\x1b[1Cto\x1b[1Ccreate\x1b[1Ctest2-v5.md?\n❯ 1. Yes\n2. Yes, allow all edits\n3. No'
      )
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects Imagining status as busy', () => {
      const result = parser.parse('· Imagining…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects Nesting status as busy', () => {
      const result = parser.parse('✽ Nesting…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects Caramelizing status as busy', () => {
      const result = parser.parse('✻ Caramelizing…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects Spelunking status as busy', () => {
      const result = parser.parse('✳ Spelunking…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects Crystallizing status as busy', () => {
      const result = parser.parse('· Crystallizing…')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })
  })

  describe('parser interface', () => {
    it('returns parser name', () => {
      expect(parser.getParserName()).toBe('claude-cli-v1')
    })
  })
})
