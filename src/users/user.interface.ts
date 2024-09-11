export interface User {
  readonly id: string;
  readonly email: string;
  readonly hashed_password: string;
  readonly firstname: string;
  readonly lastname: string;
  readonly is_admin: boolean;
  readonly last_connection: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly deleted_at: Date | null;
}

export type UserFull = Pick<
  User,
  'id' | 'email' | 'firstname' | 'lastname' | 'last_connection' | 'created_at'
>;
