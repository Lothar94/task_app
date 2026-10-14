import type { OrganizationDto } from '@fleet/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, PageHeader } from '../../components/ui';
import { useOrganizationContext } from './OrganizationContext';
import { OrganizationNameForm } from './OrganizationNameForm';
import { useCreateOrganization, useRenameOrganization } from './organizationQueries';

function OrganizationRow({ organization, isCurrent }: { organization: OrganizationDto; isCurrent: boolean }) {
  const rename = useRenameOrganization();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <OrganizationNameForm
        label={`Nuevo nombre de ${organization.name}`}
        initialName={organization.name}
        submitLabel="Guardar"
        isSubmitting={rename.isPending}
        serverError={rename.error}
        autoFocus
        onCancel={() => {
          rename.reset();
          setIsEditing(false);
        }}
        onSubmit={(name) =>
          rename.mutate({ id: organization.id, name }, { onSuccess: () => setIsEditing(false) })
        }
      />
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">
        {organization.name}
        {isCurrent && (
          <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
            Actual
          </span>
        )}
      </span>
      <Button
        variant="secondary"
        onClick={() => setIsEditing(true)}
        aria-label={`Renombrar ${organization.name}`}
      >
        Renombrar
      </Button>
    </div>
  );
}

export function OrganizationsPage() {
  const { organizations, current, selectOrganization } = useOrganizationContext();
  const createOrganization = useCreateOrganization();
  const navigate = useNavigate();

  const handleCreate = (name: string) =>
    createOrganization.mutate(
      { name },
      {
        onSuccess: (created) => {
          selectOrganization(created.id);
          navigate('/projects');
        },
      },
    );

  return (
    <>
      <PageHeader
        title="Organizaciones"
        subtitle="Cada organización tiene sus propios proyectos y agentes."
      />
      <div className="space-y-4">
        <Card title="Nueva organización">
          <OrganizationNameForm
            label="Nombre"
            submitLabel="Crear organización"
            isSubmitting={createOrganization.isPending}
            serverError={createOrganization.error}
            onSubmit={handleCreate}
          />
        </Card>
        <Card title="Tus organizaciones">
          <ul className="divide-y divide-zinc-800">
            {organizations.map((organization) => (
              <li key={organization.id} className="py-3 first:pt-0 last:pb-0">
                <OrganizationRow organization={organization} isCurrent={organization.id === current.id} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
