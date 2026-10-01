import { DEFAULT_AUTH_SECRET } from './auth.constants';
import { createAuthSecretIsDefaultError } from './auth.errors';

export function ensureAuthSecretIsNotDefaultInProduction({
  config,
  defaultAuthSecret = DEFAULT_AUTH_SECRET,
}: {
  config: { auth: { secret: string }; env: string };
  defaultAuthSecret?: string;
}) {
  if (config.env === 'production' && config.auth.secret === defaultAuthSecret) {
    throw createAuthSecretIsDefaultError();
  }
}

export function ensureAdminAccountConfigIsValid({
  config,
}: {
  config: {
    auth: {
      adminAccount: { email?: string; password?: string };
      providers: { email: { isEnabled: boolean } };
    };
  };
}) {
  const { email, password } = config.auth.adminAccount;
  const hasEmail = email !== undefined;
  const hasPassword = password !== undefined;

  if (hasEmail !== hasPassword) {
    throw new Error('AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD must be configured together.');
  }

  if (password !== undefined && (password.length < 8 || password.length > 128)) {
    throw new Error('AUTH_ADMIN_PASSWORD must be between 8 and 128 characters.');
  }

  if (email && !config.auth.providers.email.isEnabled) {
    throw new Error(
      'AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD require AUTH_PROVIDERS_EMAIL_IS_ENABLED to be enabled.',
    );
  }
}
