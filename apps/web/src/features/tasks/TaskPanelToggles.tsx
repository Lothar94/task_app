import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { Ref } from 'react';
import { IconButton } from '../../components/ui';

/** Hide/show the inspector rail on wide screens; open the inspector drawer below that. */
export function InspectorToggles({
  isShown,
  onToggle,
  isDrawerOpen,
  onOpenDrawer,
  drawerOpenerRef,
}: {
  isShown: boolean;
  onToggle: () => void;
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  drawerOpenerRef: Ref<HTMLSpanElement>;
}) {
  return (
    <>
      <span className="hidden xl:contents">
        <IconButton
          label={isShown ? 'Ocultar inspector' : 'Mostrar inspector'}
          aria-expanded={isShown}
          onClick={onToggle}
        >
          {isShown ? (
            <PanelRightClose aria-hidden className="size-4" />
          ) : (
            <PanelRightOpen aria-hidden className="size-4" />
          )}
        </IconButton>
      </span>
      <span ref={drawerOpenerRef} className="contents xl:hidden">
        <IconButton label="Abrir inspector" aria-expanded={isDrawerOpen} onClick={onOpenDrawer}>
          <PanelRightOpen aria-hidden className="size-4" />
        </IconButton>
      </span>
    </>
  );
}
