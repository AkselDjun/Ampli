import { describe, expect, it } from 'vitest';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { LOCKED_VERSION, OWNER_PREFIX, SHARE_PREFIX, isLockedLink, lockProject, lockedUrl, packProject, readShareHash, unlockProject, unpackProject } from '../../core/share';
import { WrongPassword } from '../../core/crypto';

const project = () => ({ ...newProject({ ...sample(), sample: false }, 'Квартира Петрова'), client: 'Петров П. П.', address: 'Брест, ул. Гоголя, 7' });

describe('project links protected with a password', () => {
  it('round-trips the project and hides names and addresses', async () => {
    const p = project();
    const data = await lockProject(p, 'щиток');
    expect(data.startsWith(LOCKED_VERSION)).toBe(true);
    expect(isLockedLink(data)).toBe(true);
    expect(isLockedLink(packProject(p))).toBe(false);
    expect(unpackProject(data)).toBeNull();
    const back = await unlockProject(data, 'щиток');
    expect(back?.name).toBe(p.name);
    expect(back?.address).toBe(p.address);
    expect(back?.lines.length).toBe(p.lines.length);
  });

  it('builds share and owner urls without the old hash', async () => {
    const p = project();
    const share = await lockedUrl(p, 'https://x.by/Ampli/#report', 'p');
    const owner = await lockedUrl(p, 'https://x.by/Ampli/', 'p', true);
    expect(share.startsWith('https://x.by/Ampli/' + SHARE_PREFIX + LOCKED_VERSION)).toBe(true);
    expect(owner.startsWith('https://x.by/Ampli/' + OWNER_PREFIX + LOCKED_VERSION)).toBe(true);
    expect(decodeURIComponent(share)).not.toContain('Брест');
    expect(readShareHash(share.slice(share.indexOf('#')))).not.toBeNull();
  });

  it('stays only slightly longer than an open link', async () => {
    const p = project();
    expect((await lockProject(p, 'p')).length - packProject(p).length).toBeLessThan(80);
  });

  it('rejects a wrong password', async () => {
    const data = await lockProject(project(), 'right');
    await expect(unlockProject(data, 'wrong')).rejects.toBeInstanceOf(WrongPassword);
  });

  it('returns nothing for cut, damaged or foreign data', async () => {
    const data = await lockProject(project(), 'p');
    expect(await unlockProject(data.slice(0, 20), 'p')).toBeNull();
    expect(await unlockProject(LOCKED_VERSION + '***', 'p')).toBeNull();
    expect(await unlockProject(packProject(project()), 'p')).toBeNull();
    expect(await unlockProject(LOCKED_VERSION + 'A'.repeat(1_000_001), 'p')).toBeNull();
  });
});
