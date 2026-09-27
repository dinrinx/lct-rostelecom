import { ReportJobDto, ReportJobStatusDto, ReportTypeDto } from '../dto/report-job.dto';
import { LicenseRadarBucketDto, LicenseRadarResultDto } from '../dto/license-radar.dto';

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
