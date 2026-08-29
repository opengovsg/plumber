import type { NextFunction, Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as authenticationHelper from '@/helpers/authentication'
import type { UnauthenticatedContext } from '@/types/express/context'

import {
  blockAdminOperations,
  getAuthenticatedContext,
  requireAuthentication,
  setCurrentUserContext,
} from '../../middleware/authentication'

const setGraphQLContext = vi.fn()

describe('API Authentication Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    vi.spyOn(authenticationHelper, 'setCurrentUserContext').mockImplementation(
      setGraphQLContext,
    )

    mockReq = {
      headers: {},
      context: undefined,
    } as Partial<Request>

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response>

    mockNext = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('setCurrentUserContext', () => {
    it('should call GraphQL context function and attach context to request', async () => {
      const mockContext: UnauthenticatedContext = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

      setGraphQLContext.mockResolvedValueOnce(mockContext)

      await setCurrentUserContext(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      )

      expect(setGraphQLContext).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes,
      })
      expect(mockReq.context).toEqual(mockContext)
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should handle admin operations', async () => {
      const mockContext: UnauthenticatedContext = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'admin-user-id',
          email: 'admin@plumber.gov.sg',
        } as any,
        isAdminOperation: true,
      }

      setGraphQLContext.mockResolvedValueOnce(mockContext)

      await setCurrentUserContext(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      )

      expect(mockReq.context?.isAdminOperation).toBe(true)
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should attach context even when user is null', async () => {
      const mockContext: UnauthenticatedContext = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: null,
        isAdminOperation: false,
      }

      setGraphQLContext.mockResolvedValueOnce(mockContext)

      await setCurrentUserContext(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      )

      expect(mockReq.context).toEqual(mockContext)
      expect(mockReq.context?.currentUser).toBeNull()
      expect(mockNext).toHaveBeenCalledOnce()
    })
  })

  describe('requireAuthentication', () => {
    it('should call next() when user is authenticated', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

      requireAuthentication(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledOnce()
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
    })

    it('should return 401 when context is undefined', () => {
      mockReq.context = undefined

      requireAuthentication(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Authorised!',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 401 when currentUser is null', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: null,
        isAdminOperation: false,
      }

      requireAuthentication(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Authorised!',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should allow admin operations through', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'admin-user-id',
          email: 'admin@plumber.gov.sg',
        } as any,
        isAdminOperation: true,
      }

      requireAuthentication(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledOnce()
      expect(mockRes.status).not.toHaveBeenCalled()
    })
  })

  describe('getAuthenticatedContext', () => {
    it('should return context when user is authenticated', () => {
      const mockContext = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      }

      mockReq.context = mockContext

      const result = getAuthenticatedContext(mockReq as Request)

      expect(result).toEqual(mockContext)
      expect(result.currentUser).toBeDefined()
      expect(result.currentUser.id).toBe('test-user-id')
    })

    it('should throw error when context is undefined', () => {
      mockReq.context = undefined

      expect(() => getAuthenticatedContext(mockReq as Request)).toThrow(
        'User must be authenticated',
      )
    })

    it('should throw error when currentUser is null', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: null,
        isAdminOperation: false,
      }

      expect(() => getAuthenticatedContext(mockReq as Request)).toThrow(
        'User must be authenticated',
      )
    })

    it('should return context for admin users', () => {
      const mockContext = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'admin-user-id',
          email: 'admin@plumber.gov.sg',
        } as any,
        isAdminOperation: true,
      }

      mockReq.context = mockContext

      const result = getAuthenticatedContext(mockReq as Request)

      expect(result).toEqual(mockContext)
      expect(result.isAdminOperation).toBe(true)
    })
  })

  describe('blockAdminOperations', () => {
    it('should block admin operations with 403', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'admin-user-id',
          email: 'admin@plumber.gov.sg',
        } as any,
        isAdminOperation: true,
      }

      blockAdminOperations(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Admin operations are read-only',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should allow non-admin operations', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'user-id',
          email: 'user@example.com',
        } as any,
        isAdminOperation: false,
      }

      blockAdminOperations(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should allow requests without context', () => {
      mockReq.context = undefined

      blockAdminOperations(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should allow requests with isAdminOperation set to false', () => {
      mockReq.context = {
        req: mockReq as Request,
        res: mockRes as Response,
        currentUser: {
          id: 'user-id',
          email: 'user@example.com',
        } as any,
        isAdminOperation: false,
      }

      blockAdminOperations(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalledOnce()
    })
  })
})
