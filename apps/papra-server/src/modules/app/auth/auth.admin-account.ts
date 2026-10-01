import type { Config } from '../../config/config.types';
import type { Database } from '../database/database.types';
import type { Auth } from './auth.services';
import type { Logger } from '../../shared/logger/logger';
import { createLogger } from '../../shared/logger/logger';
import { createUsersRepository } from '../../users/users.repository';
import { ROLES } from '../../roles/roles.constants';
import { createRolesRepository } from '../../roles/roles.repository';

export async function bootstrapAdminAccount({
  auth,
  config,
  db,
  logger = createLogger({ namespace: 'auth:admin-account' }),
}: {
  auth: Auth;
  config: Config;
  db: Database;
  logger?: Logger;
}) {
  const { email, password, name } = config.auth.adminAccount;

  if (!email || !password) {
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const usersRepository = createUsersRepository({ db });
  const rolesRepository = createRolesRepository({ db });
  const authContext = await auth.$context;
  const hashedPassword = await authContext.password.hash(password);

  try {
    await authContext.internalAdapter.createOAuthUser(
      {
        email: normalizedEmail,
        name,
        emailVerified: true,
      },
      {
        accountId: normalizedEmail,
        providerId: 'credential',
        password: hashedPassword,
      },
    );
  } catch (error) {
    // If the user already exists, we can ignore the error and proceed to assign the admin role.
  }

  const { user } = await usersRepository.getUserByEmail({ email: normalizedEmail });

  if (!user) {
    throw new Error('Configured admin account was not created.');
  }

  await rolesRepository.assignRoleToUser({ userId: user.id, role: ROLES.ADMIN });

  logger.info(
    { userId: user.id, email: user.email},
    'Configured admin account ensured',
  );
}
