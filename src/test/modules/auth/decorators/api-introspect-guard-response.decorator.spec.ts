import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';

describe('ApiIntrospectGuardResponse', () => {
  it('debe retornar un decorator de clase/método', () => {
    const decorator = ApiIntrospectGuardResponse();
    expect(typeof decorator).toBe('function');
  });

  it('debe poder aplicarse sobre un método sin lanzar error', () => {
    class DummyController {
      testMethod() {
        return true;
      }
    }

    const decorator = ApiIntrospectGuardResponse();
    const descriptor = Object.getOwnPropertyDescriptor(
      DummyController.prototype,
      'testMethod',
    );

    expect(() => {
      decorator(DummyController.prototype, 'testMethod', descriptor);
    }).not.toThrow();
  });
});
