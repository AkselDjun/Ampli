import type { Project } from '../core/types';
import { plural } from '../core/format';
import { Sheet } from './common';

export function IncomingSheet({ project, onAccept, onDecline }: { project: Project | null; onAccept: () => void; onDecline: () => void }) {
  const n = project ? project.lines.length : 0;
  return (
    <Sheet open={project !== null} onClose={onDecline} title="Присланный проект" compact>
      {project && (
        <>
          <p>
            <b>{project.name}</b>
            {project.address ? ', ' + project.address : ''}
          </p>
          <p className="muted">{n} {plural(n, ['группа', 'группы', 'групп'])}. Проект будет добавлен к вашим, существующие не изменятся.</p>
          <div className="data-row">
            <button className="btn primary" type="button" onClick={onAccept}>Добавить проект</button>
            <button className="btn ghost" type="button" onClick={onDecline}>Отмена</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
