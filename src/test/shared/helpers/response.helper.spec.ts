import { HttpStatus } from '@nestjs/common';
import { ResponseHelper } from '@shared/helpers/response.helper';

describe('ResponseHelper', () => {
  describe('success', () => {
    it('should return a default success response', () => {
      const data = { id: 1 };
      const response = ResponseHelper.success(data);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.message).toBe('shared.SUCCESS');
      expect(response.body).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    it('should return a custom success response', () => {
      const data = [1, 2];
      const response = ResponseHelper.success(data, {
        message: 'Custom message',
        status: HttpStatus.CREATED,
      });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.message).toBe('Custom message');
      expect(response.body).toEqual(data);
    });
  });

  describe('error', () => {
    it('should return a default error response', () => {
      const response = ResponseHelper.error('Something went wrong');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).toBe('Something went wrong');
      expect(response.error).toBeNull();
    });

    it('should extract error message from an Error object', () => {
      const error = new Error('Detail error');
      const response = ResponseHelper.error('Main error', { error });

      expect(response.error).toBe('Detail error');
    });

    it('should handle custom error objects with message property', () => {
      const error = { message: 'Custom object error' };
      const response = ResponseHelper.error('Main error', { error });
      expect(response.error).toBe('Custom object error');
    });

    it('should handle a plain string as the error', () => {
      const response = ResponseHelper.error('Main error', {
        error: 'Plain string error',
      });
      expect(response.error).toBe('Plain string error');
    });

    it('should extract error message from an object with error property', () => {
      const error = { error: 'Error property object' };
      const response = ResponseHelper.error('Main error', { error });
      expect(response.error).toBe('Error property object');
    });

    it('should stringify a non-extractable error object', () => {
      const response = ResponseHelper.error('Main error', {
        error: { code: 123 } as unknown as Error,
      });
      expect(response.error).toBe('[object Object]');
    });

    it('should stringify a primitive non-string error', () => {
      const response = ResponseHelper.error('Main error', { error: 42 });
      expect(response.error).toBe('42');
    });

    it('should fall back to the default message when message is empty', () => {
      const response = ResponseHelper.error('');
      expect(response.message).toBe('shared.INTERNAL_ERROR');
    });
  });

  describe('notFound', () => {
    it('should format a notFound error with identifier', () => {
      const response = ResponseHelper.notFound('User', 123);

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.message).toBe('shared.RESOURCE_NOT_FOUND_WITH_ID');
      expect(response.body).toEqual({ resource: 'User', identifier: 123 });
    });

    it('should format a notFound error without identifier', () => {
      const response = ResponseHelper.notFound('Resource');
      expect(response.message).toBe('shared.RESOURCE_NOT_FOUND');
      expect(response.body).toEqual({
        resource: 'Resource',
        identifier: undefined,
      });
    });
  });

  describe('validationError', () => {
    it('should return a 400 response with validation details', () => {
      const errors = ['Email is required'];
      const response = ResponseHelper.validationError(errors);
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body).toEqual({ validationErrors: errors });
    });

    it('should return a 400 response with a custom message', () => {
      const errors = { email: ['Email is required'] };
      const response = ResponseHelper.validationError(errors, 'Custom message');
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.message).toBe('Custom message');
      expect(response.body).toEqual({ validationErrors: errors });
    });
  });

  describe('unauthorized', () => {
    it('should return a 401 response with default message', () => {
      const response = ResponseHelper.unauthorized();
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.message).toBe('shared.UNAUTHORIZED');
    });

    it('should return a 401 response with a custom message', () => {
      const response = ResponseHelper.unauthorized('Custom unauthorized');
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.message).toBe('Custom unauthorized');
    });
  });

  describe('forbidden', () => {
    it('should return a 403 response with default message', () => {
      const response = ResponseHelper.forbidden();
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.message).toBe('shared.FORBIDDEN');
    });

    it('should return a 403 response with a custom message', () => {
      const response = ResponseHelper.forbidden('Custom forbidden');
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.message).toBe('Custom forbidden');
    });
  });
});
