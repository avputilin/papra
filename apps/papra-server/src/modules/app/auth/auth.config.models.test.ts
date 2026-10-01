import { describe, expect, test } from 'vitest';
import { overrideConfig } from '../../config/config.test-utils';
import {
  ensureAdminAccountConfigIsValid,
  ensureAuthSecretIsNotDefaultInProduction,
} from './auth.config.models';
import { createAuthSecretIsDefaultError } from './auth.errors';

describe('auth config models', () => {
  describe('ensureAuthSecretIsNotDefaultInProduction', () => {
    const defaultAuthSecret = 'papra-default-auth-secret-change-me';

    test('throws an error if in production and auth secret is the default one', () => {
      expect(() =>
        ensureAuthSecretIsNotDefaultInProduction({
          config: { auth: { secret: defaultAuthSecret }, env: 'production' },
          defaultAuthSecret,
        }),
      ).toThrow(createAuthSecretIsDefaultError());

      expect(() =>
        ensureAuthSecretIsNotDefaultInProduction({
          config: { auth: { secret: defaultAuthSecret }, env: 'dev' },
          defaultAuthSecret,
        }),
      ).not.toThrow();

      expect(() =>
        ensureAuthSecretIsNotDefaultInProduction({
          config: { auth: { secret: 'a-non-default-secure-secret' }, env: 'production' },
          defaultAuthSecret,
        }),
      ).not.toThrow();
    });
  });

  describe('ensureAdminAccountConfigIsValid', () => {
    test('requires the admin email and password to be configured together', () => {
      expect(() =>
        ensureAdminAccountConfigIsValid({
          config: overrideConfig({ auth: { adminAccount: { email: 'admin@example.com' } } }),
        }),
      ).toThrow('AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD must be configured together.');

      expect(() =>
        ensureAdminAccountConfigIsValid({
          config: overrideConfig({ auth: { adminAccount: { password: 'StrongPassword123!' } } }),
        }),
      ).toThrow('AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD must be configured together.');
    });

    test('requires email and password authentication to be enabled', () => {
      expect(() =>
        ensureAdminAccountConfigIsValid({
          config: overrideConfig({
            auth: {
              adminAccount: {
                email: 'admin@example.com',
                password: 'StrongPassword123!',
              },
              providers: { email: { isEnabled: false } },
            },
          }),
        }),
      ).toThrow(
        'AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD require AUTH_PROVIDERS_EMAIL_IS_ENABLED to be enabled.',
      );
    });

    test('validates the admin password length without including it in the error', () => {
      expect(() =>
        ensureAdminAccountConfigIsValid({
          config: overrideConfig({
            auth: {
              adminAccount: { email: 'admin@example.com', password: 'short' },
            },
          }),
        }),
      ).toThrow('AUTH_ADMIN_PASSWORD must be between 8 and 128 characters.');
    });
  });
});
