import { describe, expect, it } from 'vitest'

import { planPipeOwnerFlagEvaluation } from '../useIfThenV2Enabled'

describe('planPipeOwnerFlagEvaluation', () => {
  const owner = { email: 'owner@example.gov.sg', role: 'owner' }
  const editor = { email: 'editor@example.gov.sg', role: 'editor' }
  const viewer = { email: 'viewer@example.gov.sg', role: 'viewer' }

  describe('owner (or unknown role) evaluates against the app own context', () => {
    it('returns an own-context plan when the current user owns the pipe', () => {
      expect(planPipeOwnerFlagEvaluation('owner', [owner, editor])).toEqual({
        kind: 'ownContext',
      })
    })

    it('treats a missing role as own-context (the common solo/owner case)', () => {
      expect(planPipeOwnerFlagEvaluation(null, [])).toEqual({
        kind: 'ownContext',
      })
      expect(planPipeOwnerFlagEvaluation(undefined, [])).toEqual({
        kind: 'ownContext',
      })
      expect(planPipeOwnerFlagEvaluation('', [])).toEqual({
        kind: 'ownContext',
      })
    })

    it('matches the owner role case-insensitively', () => {
      expect(planPipeOwnerFlagEvaluation('OWNER', [owner])).toEqual({
        kind: 'ownContext',
      })
    })
  })

  describe('non-owner collaborators follow the pipe owner context', () => {
    it('resolves the owner email for an editor', () => {
      expect(planPipeOwnerFlagEvaluation('editor', [editor, owner])).toEqual({
        kind: 'pipeOwnerContext',
        ownerEmail: owner.email,
      })
    })

    it('resolves the owner email for a viewer', () => {
      expect(planPipeOwnerFlagEvaluation('viewer', [viewer, owner])).toEqual({
        kind: 'pipeOwnerContext',
        ownerEmail: owner.email,
      })
    })

    it('finds the owner entry regardless of its role casing', () => {
      expect(
        planPipeOwnerFlagEvaluation('editor', [
          editor,
          { email: owner.email, role: 'Owner' },
        ]),
      ).toEqual({ kind: 'pipeOwnerContext', ownerEmail: owner.email })
    })
  })

  describe('non-owner without a resolvable owner degrades', () => {
    it('returns an unresolved plan when no owner is in the collaborators', () => {
      expect(planPipeOwnerFlagEvaluation('editor', [editor, viewer])).toEqual({
        kind: 'unresolvedOwner',
      })
    })

    it('returns an unresolved plan when collaborators are empty', () => {
      expect(planPipeOwnerFlagEvaluation('editor', [])).toEqual({
        kind: 'unresolvedOwner',
      })
    })

    it('returns an unresolved plan when the owner entry has no email', () => {
      // IFlowCollaborator.email is optional; a client cannot be scoped without
      // an owner email, so degrade rather than initialise a keyless context.
      expect(
        planPipeOwnerFlagEvaluation('editor', [
          editor,
          { email: undefined, role: 'owner' },
        ]),
      ).toEqual({ kind: 'unresolvedOwner' })
    })
  })
})
