import React from 'react';

const STAGE_STYLES: Record<string, string> = {
  new: 'badge-gray',
  parsing: 'badge-info',
  parsed: 'badge-info',
  screening: 'badge-info',
  screened: 'badge-info',
  guardrail_check: 'badge-warning',
  scoring: 'badge-warning',
  scored: 'badge-warning',
  summarizing: 'badge-info',
  summarized: 'badge-info',
  bias_audit: 'badge-warning',
  reviewed: 'badge-success',
  shortlisted: 'badge-success',
  interview: 'badge-info',
  offer: 'badge-success',
  hired: 'badge-success',
  rejected: 'badge-danger',
  withdrawn: 'badge-gray',
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  parsing: 'Parsing',
  parsed: 'Parsed',
  screening: 'Screening',
  screened: 'Screened',
  guardrail_check: 'Guardrails',
  scoring: 'Scoring',
  scored: 'Scored',
  summarizing: 'Summarizing',
  summarized: 'Summarized',
  bias_audit: 'Bias Audit',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const StageBadge: React.FC<{ stage: string }> = ({ stage }) => (
  <span className={`badge ${STAGE_STYLES[stage] || 'badge-gray'}`}>
    {STAGE_LABELS[stage] || stage}
  </span>
);

export default StageBadge;
