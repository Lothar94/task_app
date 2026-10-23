import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentRunRequest } from '../../src/application/ports/AgentRuntime.js';
import { FileSystemSkillWorkspace } from '../../src/infrastructure/system/FileSystemSkillWorkspace.js';
import { createHttpServer } from '../../src/interfaces/http/createHttpServer.js';
import { loadConfig } from '../../src/main/config.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import { createTeamProject, noPlugins, createTestFleet, eventually, profile } from '../support/testFleet.js';

const ORG = DEFAULT_ORGANIZATION_ID;

describe('agent skills: QA regressions', () => {
  it("gives each delegated subtask the collaborator's own skills, not the delegator's", async () => {
    const fleet = createTestFleet({
      CTO: async (request: AgentRunRequest) => {
        const outcome = await request.delegation.delegate({
          collaboratorName: 'Backend',
          title: 'API',
          instructions: 'Build it',
        });
        request.delegation.reportResult(outcome.summary);
        return 'done';
      },
    });
    const backend = await fleet.useCases.createAgent.execute({
      organizationId: ORG,
      profile: profile('Backend', { skills: ['pdf'] }),
      collaboratorIds: [],
    });
    const cto = await fleet.useCases.createAgent.execute({
      organizationId: ORG,
      profile: profile('CTO', { skills: ['graphify'] }),
      collaboratorIds: [backend.id],
    });
    const project = fleet.useCases.createProject.execute({
      organizationId: ORG,
      details: { name: 'Demo', description: '', workspacePath: '/tmp/fleet-test-workspace' },
      memberIds: [cto.id, backend.id],
    });
    const root = fleet.useCases.assignTask.execute(project.id, {
      agentId: cto.id,
      title: 'Go',
      description: 'Go',
    });

    await eventually(() => expect(fleet.useCases.getTask.execute(root.id).status).toBe('completed'));
    const byName = (name: string) =>
      fleet.runtime.requests.find(
        (request) => request.systemPromptAppendix.includes(`# Your skills`) && request.skills.includes(name),
      );
    expect(byName('graphify')?.skillsDirectory).toBe('/tmp/skill-bridges/graphify');
    expect(byName('pdf')?.skillsDirectory).toBe('/tmp/skill-bridges/pdf');
    expect(fleet.runtime.requests.map((request) => request.skills).sort()).toEqual([['graphify'], ['pdf']]);
  });

  it('keeps an agent without skills unchanged when a collaborator has skills', async () => {
    const fleet = createTestFleet();
    const { project, cto } = await createTeamProject(fleet, []);
    fleet.useCases.assignTask.execute(project.id, { agentId: cto.id, title: 'Go', description: 'Go' });
    await eventually(() => expect(fleet.runtime.requests).toHaveLength(1));
    expect(fleet.runtime.requests[0]?.systemPromptAppendix).not.toContain('# Your skills');
  });

  it('resets the skills to none when a PUT omits them (PUT is a full replace)', async () => {
    const fleet = createTestFleet();
    const app = await createHttpServer({
      useCases: fleet.useCases,
      events: fleet.events,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      allowedOrigin: '*',
    });
    const created = await app.inject({
      method: 'POST',
      url: `/api/organizations/${ORG}/agents`,
      payload: { ...profile('Lara'), skills: ['pdf'] },
    });
    const { skills: _omitted, ...withoutSkills } = profile('Lara');
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/agents/${created.json().id}`,
      payload: withoutSkills,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().skills).toEqual([]);
    await app.close();
  });

  describe('with the real skill workspace', () => {
    let root: string;
    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'fleet-qa-skills-'));
      await mkdir(join(root, 'skills', 'pdf'), { recursive: true });
      await writeFile(join(root, 'skills', 'pdf', 'SKILL.md'), '---\nname: pdf\n---\n');
    });
    afterEach(() => rm(root, { recursive: true, force: true }));

    it('returns null for a skill assigned but not installed, and the run still completes', async () => {
      const workspace = new FileSystemSkillWorkspace(
        join(root, 'skills'),
        join(root, 'skill-bridges'),
        noPlugins,
      );
      const fleet = createTestFleet();
      Object.assign(fleet.skillWorkspace, {
        prepare: (skills: readonly string[]) => workspace.prepare(skills),
      });
      const lara = await fleet.useCases.createAgent.execute({
        organizationId: ORG,
        profile: profile('Lara', { skills: ['ghost'] }),
        collaboratorIds: [],
      });
      const { project } = await createTeamProject(fleet, []);
      fleet.useCases.setProjectMembers.execute(project.id, [lara.id]);
      const task = fleet.useCases.assignTask.execute(project.id, {
        agentId: lara.id,
        title: 'Go',
        description: 'Go',
      });

      await eventually(() => expect(fleet.useCases.getTask.execute(task.id).status).toBe('completed'));
      expect(fleet.runtime.requests[0]).toMatchObject({ skills: ['ghost'], skillsDirectory: null });
    });

    it('places bridges next to the database file, which is git-ignored', () => {
      expect(loadConfig({ DATABASE_PATH: '/x/data/fleet.db' }).databasePath).toBe('/x/data/fleet.db');
      const ignore = readFileSync(
        resolve(fileURLToPath(import.meta.url), '../../../../../.gitignore'),
        'utf8',
      );
      expect(ignore.split('\n')).toContain('data/');
    });
  });
});
