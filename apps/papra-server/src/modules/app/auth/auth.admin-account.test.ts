import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { overrideConfig } from '../../config/config.test-utils';
import { createInMemoryDatabase } from '../database/database.test-utils';
import { createTestServerDependencies } from '../server.test-utils';
import { userRolesTable } from '../../roles/roles.table';
import { usersTable } from '../../users/users.table';
import { accountsTable } from './auth.tables';
import { bootstrapAdminAccount } from './auth.admin-account';

const adminEmail = 'bootstrap@example.com';
const adminPassword = 'StrongPassword123!';

function createConfig() {
  return overrideConfig({
    auth: {
      firstUserAsAdmin: false,
      isRegistrationEnabled: false,
      isEmailVerificationRequired: true,
      forbiddenEmailDomains: new Set(['example.com']),
      adminAccount: {
        email: adminEmail,
        password: adminPassword,
        name: 'Bootstrap Admin',
      },
    },
  });
}

describe('admin account bootstrap', () => {
  test('creates a verified credential account and grants admin when public signup is disabled', async () => {
    const config = createConfig();
    const { db } = await createInMemoryDatabase({
      users: [
        {
          id: 'usr_existing',
          email: 'existing@example.com',
          name: 'Existing User',
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const { auth } = createTestServerDependencies({ db, config });

    await bootstrapAdminAccount({ auth, config, db });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
    const [credentialAccount] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.userId, user!.id));
    const authContext = await auth.$context;
    const isPasswordValid = await authContext.password.verify({
      hash: credentialAccount?.password ?? '',
      password: adminPassword,
    });
    const signInResponse = await auth.api.signInEmail({
      body: { email: adminEmail, password: adminPassword },
      headers: new Headers({ origin: config.client.baseUrl }),
    });
    const roles = await db.select().from(userRolesTable);

    expect(user).toMatchObject({ name: 'Bootstrap Admin', emailVerified: true });
    expect(credentialAccount).toMatchObject({ providerId: 'credential', accountId: adminEmail });
    expect(isPasswordValid).toBe(true);
    expect(signInResponse.user.email).toBe(adminEmail);
    expect(roles.map(({ userId, role }) => ({ userId, role }))).to.eql([
      { userId: user!.id, role: 'admin' },
    ]);
  });

  test('promotes an existing account without changing its credentials and is repeatable', async () => {
    const config = createConfig();
    const { db } = await createInMemoryDatabase({
      users: [
        {
          id: 'usr_existing',
          email: adminEmail,
          name: 'Existing Admin',
          emailVerified: true,
          createdAt: new Date('2026-01-01'),
        },
      ],
      accounts: [
        {
          id: 'auth_acc_existing',
          userId: 'usr_existing',
          accountId: 'usr_existing',
          providerId: 'credential',
          password: 'existing-password-hash',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
    });
    const { auth } = createTestServerDependencies({ db, config });

    await bootstrapAdminAccount({ auth, config, db });
    await bootstrapAdminAccount({ auth, config, db });

    const accounts = await db.select().from(accountsTable);
    const roles = await db.select().from(userRolesTable);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.password).toBe('existing-password-hash');
    expect(roles.map(({ userId, role }) => ({ userId, role }))).to.eql([
      { userId: 'usr_existing', role: 'admin' },
    ]);
  });
});
