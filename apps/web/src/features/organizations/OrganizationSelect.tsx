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
    <select
      aria-label="Organización"
      value={current.id}
      onChange={(event) => handleChange(event.target.value)}
      className="max-w-48 truncate rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {organizations.map((organization) => (
        <option key={organization.id} value={organization.id}>
          {organization.name}
        </option>
      ))}
    </select>
  );
}
