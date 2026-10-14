/** Name given to the organization that owns everything created before organizations existed. */
export const DEFAULT_ORGANIZATION_NAME = "Lothar's lab";

/** Top level of the app: every agent and project (and so every task) belongs to one organization. */
export interface OrganizationDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Body of `POST /api/organizations` and `PUT /api/organizations/:id` (rename). */
export interface OrganizationInput {
  name: string;
}
