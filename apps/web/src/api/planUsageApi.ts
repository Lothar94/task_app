import type { PlanUsageDto } from '@fleet/shared';
import { request } from './httpClient';

export const planUsageApi = {
  get: () => request<PlanUsageDto>('/plan-usage'),
};
