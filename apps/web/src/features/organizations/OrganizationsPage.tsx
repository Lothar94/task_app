import type { OrganizationDto } from '@fleet/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Plus } from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatusChip } from '../../components/ui';
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
          <span className="ml-2 align-middle">
            <StatusChip tone="success">Actual</StatusChip>
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
        breadcrumb={`${current.name} / Organizaciones`}
        badge={<Badge>{organizations.length} en total</Badge>}
        subtitle="Cada organización tiene sus propios proyectos y agentes."
      />
      <div className="space-y-4">
        <Card title="Nueva organización" icon={<Plus />}>
          <OrganizationNameForm
            label="Nombre"
            submitLabel="Crear organización"
            isSubmitting={createOrganization.isPending}
            serverError={createOrganization.error}
            onSubmit={handleCreate}
          />
        </Card>
        <Card title="Tus organizaciones" icon={<Building2 />}>
          <ul className="divide-y divide-line">
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
