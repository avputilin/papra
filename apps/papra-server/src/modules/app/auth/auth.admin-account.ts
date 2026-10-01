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
  const { user: existingUser } = await usersRepository.getUserByEmail({ email: normalizedEmail });
  let wasCreated = false;

  if (!existingUser) {
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

      wasCreated = true;
    } catch (error) {
      const { user: concurrentlyCreatedUser } = await usersRepository.getUserByEmail({
        email: normalizedEmail,
      });

      if (!concurrentlyCreatedUser) {
        throw error;
      }
    }
  }

  const { user } = await usersRepository.getUserByEmail({ email: normalizedEmail });

  if (!user) {
    throw new Error('Configured admin account was not created.');
  }

  await rolesRepository.assignRoleToUser({ userId: user.id, role: ROLES.ADMIN });

  logger.info(
    { userId: user.id, email: user.email, wasCreated },
    'Configured admin account ensured',
  );
}
