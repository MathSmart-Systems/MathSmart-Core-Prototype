import { describeGrowth, firstName, toNumber } from "./format.js";
import { diagnosticStatus, masteryBand, supportNotice } from "./status.js";

function toCompetency(row) {
  return {
    id: row.competency_id,
    code: row.competency_code,
    name: row.competency_name ?? "Untitled competency",
    diagnosticScore: toNumber(row.diagnostic_score),
    currentScore: toNumber(row.current_score),
    growth: describeGrowth(row.growth),
    growthValue: toNumber(row.growth),
    band: masteryBand(row.mastery_band),
    attemptCount: toNumber(row.attempt_count) ?? 0,
  };
}

function toActivity(row, index) {
  return {
    id: `${row.resource_id ?? "record"}-${row.date ?? "undated"}-${index}`,
    date: row.date,
    label: row.label ?? "Recorded work",
    title: row.title,
    score: toNumber(row.score),
  };
}

export function buildDashboardModel({ learner, progress }) {
  const diagnostic = diagnosticStatus(learner?.diagnostic_status);
  const moduleTotal = toNumber(progress?.total_modules_count) ?? 0;

  return {
    learner: {
      firstName: firstName(learner?.full_name),
      sectionName: learner?.section_name ?? null,
    },
    diagnostic: {
      value: learner?.diagnostic_status,
      label: diagnostic.label,
      isComplete: learner?.diagnostic_status === "completed",
    },
    support: supportNotice({
      monitoringStatus: progress?.monitoring_status ?? learner?.monitoring_status,
      openInterventionCount: toNumber(progress?.active_intervention_count) ?? 0,
    }),
    plot: {
      diagnosticScore: toNumber(progress?.diagnostic_score),
      currentScore: toNumber(progress?.overall_mastery),
      growthValue: toNumber(progress?.growth),
      growth: describeGrowth(progress?.growth),
    },
    modules: {
      finished: toNumber(progress?.modules_completed_count) ?? 0,
      total: moduleTotal,
      hasPath: moduleTotal > 0,
    },
    mastery: {
      mastered: toNumber(progress?.competencies_mastered_count),
      total: toNumber(progress?.total_competencies_count),
    },
    competencies: (progress?.competencies ?? []).map(toCompetency),
    activity: (progress?.recent_activity ?? []).map(toActivity),
  };
}
