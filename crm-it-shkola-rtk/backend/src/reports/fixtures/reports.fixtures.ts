import { ReportJobDto, ReportJobStatusDto, ReportTypeDto } from '../dto/report-job.dto';
import { LicenseRadarBucketDto, LicenseRadarResultDto } from '../dto/license-radar.dto';
import { InteractionReportItemDto } from '../dto/interaction-report-item.dto';
import { ChartsResponseDto } from '../dto/charts.dto';
import { SlaRadarResultDto } from '../dto/sla-radar.dto';
import { WorkflowPhaseDto } from '../../workflow/dto/workflow-status.dto';

export const REPORT_JOB_FIXTURE: ReportJobDto = {
  id: 'd0000000-0000-4000-8000-000000000001',
  type: ReportTypeDto.LICENSE_RADAR,
  status: ReportJobStatusDto.SUCCESS,
  requestedById: 'c0000000-0000-4000-8000-000000000001',
  createdAt: '2026-09-26T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:05.000Z',
  resultUrl: '/reports/jobs/d0000000-0000-4000-8000-000000000001/result',
};

export const LICENSE_RADAR_RESULT_FIXTURE: LicenseRadarResultDto = {
  jobId: REPORT_JOB_FIXTURE.id,
  generatedAt: '2026-09-26T10:00:05.000Z',
  items: [
    {
      licenseId: 'e0000000-0000-4000-8000-000000000001',
      contractNumber: 'DEMO-a5000000-1',
      universityId: 'a5000000-0000-4000-8000-000000000001',
      universityName: 'СПбГУ (демо)',
      itProductId: 'a3000000-0000-4000-8000-000000000001',
      itProductName: 'Базис Dynamix',
      endDate: '2026-09-21T00:00:00.000Z',
      bucket: LicenseRadarBucketDto.OVERDUE,
    },
    {
      licenseId: 'e0000000-0000-4000-8000-000000000002',
      contractNumber: 'DEMO-a5000000-2',
      universityId: 'a5000000-0000-4000-8000-000000000001',
      universityName: 'СПбГУ (демо)',
      itProductId: 'a3000000-0000-4000-8000-000000000002',
      itProductName: 'RT.DataLake',
      endDate: '2026-10-03T00:00:00.000Z',
      bucket: LicenseRadarBucketDto.DUE_IN_7_DAYS,
    },
    {
      licenseId: 'e0000000-0000-4000-8000-000000000003',
      contractNumber: 'DEMO-a5000000-3',
      universityId: 'a5000000-0000-4000-8000-000000000002',
      universityName: 'МГТУ им. Баумана (демо)',
      itProductId: 'a3000000-0000-4000-8000-000000000004',
      itProductName: 'RT.DataVision',
      endDate: '2026-10-26T00:00:00.000Z',
      bucket: LicenseRadarBucketDto.DUE_IN_30_DAYS,
    },
  ],
};

export const INTERACTION_REPORT_FIXTURES: InteractionReportItemDto[] = [
  {
    interactionInstanceId: 'b3000000-0000-4000-8000-000000000001',
    universityId: 'a5000000-0000-4000-8000-000000000001',
    universityName: 'СПбГУ (демо)',
    itDirectionId: 'a1000000-0000-4000-8000-000000000001',
    itDirectionName: 'Импортированные продукты (реестр вендоров)',
    itProductId: 'a3000000-0000-4000-8000-000000000001',
    itProductName: 'Базис Dynamix',
    currentStatusId: 'b1000000-0000-4000-8000-000000000002',
    currentStatusName: 'Согласование договора',
    currentPhase: WorkflowPhaseDto.CONTRACTING,
    responsibleUserId: 'c0000000-0000-4000-8000-000000000001',
    responsibleUserName: 'Иванова Мария Сергеевна',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-20T14:30:00.000Z',
    daysInCurrentStatus: 6,
    isOverdue: false,
  },
];

export const INTERACTIONS_EXPORT_FIXTURE = {
  fileName: (format: string) => `reestr-vzaimodeystviy-2026-09-26.${format}`,
  url: (format: string) =>
    `https://minio.internal/crm-exports/reestr-vzaimodeystviy-2026-09-26.${format}?X-Amz-Expires=600&...`,
  generatedAt: '2026-09-26T10:00:00.000Z',
};

export const CHARTS_RESPONSE_FIXTURE: ChartsResponseDto = {
  statusDistribution: [
    { label: 'Инициирован контакт', value: 5 },
    { label: 'Согласование договора', value: 4 },
    { label: 'Внедрение', value: 3 },
  ],
  interactionsOverTime: [
    { date: '2026-07-01', value: 2 },
    { date: '2026-08-01', value: 5 },
    { date: '2026-09-01', value: 4 },
  ],
  licensesByProduct: [
    { label: 'Базис Dynamix', value: 1 },
    { label: 'RT.DataLake', value: 1 },
    { label: 'RT.Warehouse', value: 1 },
    { label: 'RT.DataVision', value: 1 },
    { label: 'AKOLA', value: 1 },
  ],
};

export const SLA_RADAR_RESULT_FIXTURE: SlaRadarResultDto = {
  generatedAt: '2026-09-26T10:05:00.000Z',
  items: [
    {
      interactionInstanceId: 'b3000000-0000-4000-8000-000000000001',
      universityId: 'a5000000-0000-4000-8000-000000000001',
      universityName: 'СПбГУ (демо)',
      currentStatusId: 'b1000000-0000-4000-8000-000000000002',
      currentStatusName: 'Согласование договора',
      phase: WorkflowPhaseDto.CONTRACTING,
      responsibleUserId: 'c0000000-0000-4000-8000-000000000001',
      responsibleUserName: 'Иванова Мария Сергеевна',
      statusSince: '2026-09-06T14:30:00.000Z',
      daysInStatus: 20,
      slaThresholdDays: 14,
    },
  ],
};
