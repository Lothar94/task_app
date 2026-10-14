import type { SkillDto } from '@fleet/shared';
import { request } from './httpClient';

export const skillsApi = {
  list: () => request<SkillDto[]>('/skills'),
};
