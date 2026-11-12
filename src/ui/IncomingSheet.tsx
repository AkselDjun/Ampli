import type { Project } from '../core/types';
import { plural } from '../core/format';
import { Sheet } from './common';
import { Button } from './kit';

export function IncomingSheet({ project, onAccept, onDecline }: { project: Project | null; onAccept: () => void; onDecline: () => void }) {
  const n = project ? project.lines.length : 0;
  return (
    <Sheet
      open={project !== null}
      onClose={onDecline}
      title="Присланный проект"
      kind="dialog"
      historyLayer={false}
      footer={project && (
        <>
          <span className="foot-st" />
          <Button variant="ghost" onClick={onDecline}>Отмена</Button>
          <Button variant="primary" onClick={onAccept}>Добавить проект</Button>
        </>
      )}
    >
      {project && (
        <>
          <p>
            <b>{project.name}</b>
            {project.address ? ', ' + project.address : ''}
          </p>
          <p className="muted">{n} {plural(n, ['группа', 'группы', 'групп'])}. Проект будет добавлен к вашим, существующие не изменятся.</p>
        </>
      )}
    </Sheet>
  );
}
