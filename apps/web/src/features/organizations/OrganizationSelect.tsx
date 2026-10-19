import { ChevronsUpDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useOrganizationContext } from './OrganizationContext';

/** Section list the user stays in after switching: /projects/:id becomes /projects. */
function sectionOf(pathname: string): string {
  return `/${pathname.split('/')[1] ?? ''}`;
}

export function OrganizationSelect() {
  const { organizations, current, selectOrganization } = useOrganizationContext();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleChange = (id: string) => {
    selectOrganization(id);
    navigate(sectionOf(pathname));
  };

  return (
    <div className="relative flex items-center rounded border border-line-strong bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <span aria-hidden className="pointer-events-none absolute left-2 size-1.5 rounded-full bg-success" />
      <select
        aria-label="Organización"
        value={current.id}
        onChange={(event) => handleChange(event.target.value)}
        className="max-w-48 cursor-pointer appearance-none truncate bg-transparent py-1 pr-7 pl-5 text-sm font-medium text-fg outline-none"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown aria-hidden className="pointer-events-none absolute right-1.5 size-4 text-fg-subtle" />
    </div>
  );
}
