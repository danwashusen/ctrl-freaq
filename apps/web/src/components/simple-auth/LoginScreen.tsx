import { useEffect } from 'react';

type SimpleAuthUserOption = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  orgRole?: string;
  orgPermissions?: string[];
};

export interface LoginScreenProps {
  users: SimpleAuthUserOption[];
  selectedUserId: string | null;
  isLoading: boolean;
  errorMessage?: string | null;
  onSelect: (userId: string) => void;
  onResetSelection: () => void;
}

const getDisplayName = (user: SimpleAuthUserOption): string => {
  const nameParts = [user.firstName, user.lastName].filter(Boolean);
  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }

  return user.email;
};

const getInitials = (user: SimpleAuthUserOption): string => {
  const trimmedParts = [user.firstName, user.lastName]
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(part => part.length > 0);

  if (trimmedParts.length === 0) {
    return user.email.slice(0, 2).toUpperCase();
  }

  return trimmedParts
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const instructionsId = 'simple-auth-login-description';

export const LoginScreen = ({
  users,
  selectedUserId,
  isLoading,
  errorMessage = null,
  onSelect,
  onResetSelection,
}: LoginScreenProps) => {
  useEffect(() => {
    if (isLoading || !selectedUserId) {
      return;
    }

    const userExists = users.some(user => user.id === selectedUserId);
    if (!userExists) {
      onResetSelection();
    }
  }, [isLoading, selectedUserId, users, onResetSelection]);

  return (
    <section
      aria-labelledby="simple-auth-login-heading"
      aria-describedby={instructionsId}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-2 text-center">
        <h1 id="simple-auth-login-heading" className="text-2xl font-semibold">
          Select a Local Test User
        </h1>
        <p id={instructionsId} className="text-muted-foreground text-sm">
          Simple auth is intended for local development only. Selected users are stored locally and
          API requests will use <code>simple:&lt;userId&gt;</code> bearer tokens. Use Tab or
          Shift+Tab to move between cards and press Enter or Space to choose a user.
        </p>
      </header>

      {errorMessage ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
        >
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div role="status" className="text-muted-foreground text-center">
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div role="alert" className="rounded-md border border-dashed p-4 text-center">
          No simple auth users were found. Update <code>SIMPLE_AUTH_USER_FILE</code> and reload the
          page.
        </div>
      ) : (
        <ul aria-describedby={instructionsId} className="grid gap-4 sm:grid-cols-2">
          {users.map(user => {
            const displayName = getDisplayName(user);
            const subtitle = user.orgRole ?? null;
            const permissions =
              user.orgPermissions && user.orgPermissions.length > 0
                ? user.orgPermissions.join(', ')
                : null;
            const isSelected = selectedUserId === user.id;
            const nameId = `simple-auth-user-${user.id}-name`;
            const roleId = subtitle ? `${nameId}-role` : null;
            const emailId = `${nameId}-email`;
            const permissionsId = permissions ? `${nameId}-permissions` : null;
            const describedByIds =
              [instructionsId, roleId, emailId, permissionsId].filter(Boolean).join(' ') ||
              undefined;

            return (
              <li key={user.id}>
                <button
                  type="button"
                  className={`bg-background focus:ring-primary shadow-xs focus:outline-hidden w-full rounded-md border p-4 text-left transition focus:ring-2 ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary'
                  }`}
                  data-testid="simple-auth-user-card"
                  data-user-id={user.id}
                  onClick={() => onSelect(user.id)}
                  aria-labelledby={nameId}
                  aria-describedby={describedByIds}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary flex h-12 w-12 flex-none items-center justify-center rounded-full">
                      {user.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt={`Avatar for ${displayName}`}
                          className="h-12 w-12 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-sm font-semibold uppercase">{getInitials(user)}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span id={nameId} className="text-lg font-medium">
                        {displayName}
                      </span>
                      {subtitle ? (
                        <span id={roleId ?? undefined} className="text-muted-foreground text-sm">
                          {subtitle}
                        </span>
                      ) : null}
                      <span id={emailId} className="text-muted-foreground text-xs">
                        {user.email}
                      </span>
                      {permissions ? (
                        <span
                          id={permissionsId ?? undefined}
                          className="text-muted-foreground text-xs"
                        >
                          Permissions: {permissions}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
