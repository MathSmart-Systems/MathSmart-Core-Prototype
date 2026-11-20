"""Actor-scoped reporting queries used by the teacher dashboard."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from modules.shared.db import ActorConnection

_DASHBOARD_SQL = """
with scoped_learners as (
  select student_profiles.student_id, student_profiles.monitoring_status
  from app.student_profiles
  join app.user_profiles on user_profiles.user_id = student_profiles.user_id
  where user_profiles.account_status = 'active'
    and ($1::uuid is null or student_profiles.grade_id = $1)
    and ($2::uuid is null or student_profiles.section_id = $2)
),
learner_averages as (
  select competency_progress.student_id,
         avg(competency_progress.current_score) as current_average
  from app.competency_progress
  join scoped_learners on scoped_learners.student_id = competency_progress.student_id
  group by competency_progress.student_id
)
select
  (select count(*) from scoped_learners) as learner_count,
  (select count(*) from scoped_learners
    where scoped_learners.monitoring_status = 'active') as active_count,
  (select count(*) from scoped_learners
    where scoped_learners.monitoring_status = 'needs_intervention')
    as needs_support_count,
  (select count(*) from scoped_learners
    where scoped_learners.monitoring_status = 'improving') as improving_count,
  (select count(*) from scoped_learners
    where scoped_learners.monitoring_status = 'mastered') as mastered_count,
  -- Over learners, not over progress rows, so a learner with many
  -- competencies does not outweigh one with few. Reports use the same.
  (select round(avg(learner_averages.current_average), 2) from learner_averages)
    as average_mastery,
  (select count(*) from learner_averages
    where learner_averages.current_average is not null) as learners_with_scores,
  (select count(*)
     from app.interventions
     join scoped_learners on scoped_learners.student_id = interventions.student_id
    where interventions.archived_at is null
      and interventions.status <> 'Resolved') as open_intervention_count,
  -- A competency belongs to a grade, not to a section, so the section filter
  -- has nothing further to narrow here.
  (select count(*) from app.competencies
    where competencies.status = 'published'
      and ($1::uuid is null or competencies.grade_id = $1))
    as published_competency_count,
  (select count(*)
     from app.assessment_attempts
     join scoped_learners
       on scoped_learners.student_id = assessment_attempts.student_id
    where assessment_attempts.status = 'scored') as scored_attempt_count,
  (select count(*)
     from app.student_module_progress
     join scoped_learners
       on scoped_learners.student_id = student_module_progress.student_id
    where student_module_progress.is_complete) as completed_module_count
"""


_DASHBOARD_BREAKDOWN_SQL = """
with scoped_learners as (
  select student_profiles.student_id, student_profiles.diagnostic_status
  from app.student_profiles
  join app.user_profiles on user_profiles.user_id = student_profiles.user_id
  where user_profiles.account_status = 'active'
    and ($1::uuid is null or student_profiles.grade_id = $1)
    and ($2::uuid is null or student_profiles.section_id = $2)
)
select
  (select count(*) from app.sections
    where sections.is_active
      and ($1::uuid is null or sections.grade_id = $1)
      and ($2::uuid is null or sections.section_id = $2)) as section_count,
  (select count(*) from scoped_learners
    where scoped_learners.diagnostic_status = 'not_started') as diagnostic_not_started,
  (select count(*) from scoped_learners
    where scoped_learners.diagnostic_status = 'in_progress') as diagnostic_in_progress,
  (select count(*) from scoped_learners
    where scoped_learners.diagnostic_status = 'completed') as diagnostic_completed,
  (select count(*) from app.interventions
     join scoped_learners on scoped_learners.student_id = interventions.student_id
    where interventions.archived_at is null
      and interventions.status = 'Needs Intervention') as interventions_needs_intervention,
  (select count(*) from app.interventions
     join scoped_learners on scoped_learners.student_id = interventions.student_id
    where interventions.archived_at is null
      and interventions.status = 'In Progress') as interventions_in_progress,
  (select count(*) from app.interventions
     join scoped_learners on scoped_learners.student_id = interventions.student_id
    where interventions.archived_at is null
      and interventions.status = 'Resolved') as interventions_resolved
"""


_RECENT_ACTIVITY_SQL = """
with scoped_learners as (
  select student_profiles.student_id, student_profiles.learner_id,
         user_profiles.full_name
  from app.student_profiles
  join app.user_profiles on user_profiles.user_id = student_profiles.user_id
  where user_profiles.account_status = 'active'
    and ($1::uuid is null or student_profiles.grade_id = $1)
    and ($2::uuid is null or student_profiles.section_id = $2)
),
activity as (
  select
    'assessment' as kind,
    assessment_attempts.attempt_id as activity_id,
    scoped_learners.student_id,
    scoped_learners.learner_id,
    scoped_learners.full_name,
    assessments.title,
    assessment_attempts.overall_score as score,
    assessment_attempts.submitted_at as occurred_at
  from app.assessment_attempts
  join scoped_learners on scoped_learners.student_id = assessment_attempts.student_id
  join app.assessments on assessments.assessment_id = assessment_attempts.assessment_id
  where assessment_attempts.status = 'scored'
    and assessment_attempts.submitted_at is not null
  union all
  select
    'module' as kind,
    student_module_progress.progress_id as activity_id,
    scoped_learners.student_id,
    scoped_learners.learner_id,
    scoped_learners.full_name,
    learning_modules.title,
    null::numeric as score,
    student_module_progress.completed_at as occurred_at
  from app.student_module_progress
  join scoped_learners on scoped_learners.student_id = student_module_progress.student_id
  join app.learning_modules
    on learning_modules.module_id = student_module_progress.module_id
  where student_module_progress.is_complete
)
select * from activity
order by occurred_at desc
limit $3
"""


_SECTIONS_SQL = """
select
  sections.section_id,
  sections.grade_id,
  sections.name as section_name,
  sections.adviser_id,
  adviser.full_name as adviser_name,
  sections.is_active,
  (select count(*)
     from app.student_profiles
     join app.user_profiles on user_profiles.user_id = student_profiles.user_id
    where student_profiles.section_id = sections.section_id
      and user_profiles.account_status = 'active') as learner_count
from app.sections
left join app.teacher_admin_profiles
  on teacher_admin_profiles.teacher_admin_id = sections.adviser_id
left join app.user_profiles as adviser
  on adviser.user_id = teacher_admin_profiles.user_id
where ($1::uuid is null or sections.grade_id = $1)
order by sections.name
"""


_LEARNERS_SQL = """
select
  student_performance_summary.student_id,
  student_performance_summary.learner_id,
  student_performance_summary.full_name,
  student_performance_summary.grade_id,
  student_performance_summary.section_id,
  sections.name as section_name,
  student_performance_summary.monitoring_status,
  student_profiles.diagnostic_status,
  student_performance_summary.diagnostic_average,
  student_performance_summary.current_average,
  student_performance_summary.competencies_mastered,
  student_performance_summary.modules_completed,
  student_performance_summary.modules_started,
  student_performance_summary.scored_attempt_count,
  student_performance_summary.worst_unsuccessful_attempts,
  student_performance_summary.open_intervention_count,
  student_performance_summary.last_studied_at
from app.student_performance_summary
join app.student_profiles
  on student_profiles.student_id = student_performance_summary.student_id
join app.user_profiles on user_profiles.user_id = student_profiles.user_id
left join app.sections on sections.section_id = student_performance_summary.section_id
where user_profiles.account_status = 'active'
  and ($1::uuid is null or student_performance_summary.grade_id = $1)
  and ($2::uuid is null or student_performance_summary.section_id = $2)
  and (
    not $3::boolean
    or student_performance_summary.monitoring_status = 'needs_intervention'
    or student_performance_summary.open_intervention_count > 0
  )
order by student_performance_summary.learner_id
limit $4 offset $5
"""


_COMPETENCIES_SQL = """
select
  competencies.competency_id,
  competencies.code,
  competencies.name,
  competencies.domain,
  competencies.grade_id,
  competencies.status,
  count(competency_progress.progress_id) as learners_tracked,
  count(competency_progress.current_score) as current_contributors,
  count(competency_progress.diagnostic_score) as diagnostic_contributors,
  count(*) filter (where competency_progress.mastery_band = 'Mastered')
    as mastered_count,
  count(*) filter (where competency_progress.mastery_band = 'Developing')
    as developing_count,
  count(*) filter (where competency_progress.mastery_band = 'Needs Improvement')
    as needs_improvement_count,
  round(avg(competency_progress.current_score), 2) as average_current_score,
  round(avg(competency_progress.diagnostic_score), 2) as average_diagnostic_score,
  -- The band the database would give this average. `app.mastery_band_for` is
  -- the only definition of a band; a caller that drew its own thresholds had
  -- already drifted from it once.
  app.mastery_band_for(round(avg(competency_progress.current_score), 2))
    as average_mastery_band
from app.competencies
left join app.competency_progress
  on competency_progress.competency_id = competencies.competency_id
  and competency_progress.student_id in (
        select student_profiles.student_id
        from app.student_profiles
        join app.user_profiles on user_profiles.user_id = student_profiles.user_id
        where user_profiles.account_status = 'active'
          and ($2::uuid is null or student_profiles.section_id = $2))
where ($1::uuid is null or competencies.grade_id = $1)
  -- A draft is not taught yet and an archived competency no longer is, so a
  -- class summary that lists them describes a curriculum nobody is following.
  and (not $3::boolean or competencies.status = 'published')
group by
  competencies.competency_id,
  competencies.code,
  competencies.name,
  competencies.domain,
  competencies.grade_id,
  competencies.status
order by competencies.code
"""


async def dashboard(
    connection: ActorConnection, *, grade_id: UUID | None, section_id: UUID | None
) -> Any:
    return await connection.fetchrow(_DASHBOARD_SQL, grade_id, section_id)


async def sections(connection: ActorConnection, *, grade_id: UUID | None) -> list[Any]:
    return await connection.fetch(_SECTIONS_SQL, grade_id)


async def learners(
    connection: ActorConnection,
    *,
    grade_id: UUID | None,
    section_id: UUID | None,
    at_risk_only: bool,
    limit: int,
    offset: int,
) -> list[Any]:
    return await connection.fetch(
        _LEARNERS_SQL, grade_id, section_id, at_risk_only, limit, offset
    )


async def competencies(
    connection: ActorConnection,
    *,
    grade_id: UUID | None,
    section_id: UUID | None,
    published_only: bool = False,
) -> list[Any]:
    return await connection.fetch(_COMPETENCIES_SQL, grade_id, section_id, published_only)


async def dashboard_breakdown(
    connection: ActorConnection, *, grade_id: UUID | None, section_id: UUID | None
) -> Any:
    return await connection.fetchrow(_DASHBOARD_BREAKDOWN_SQL, grade_id, section_id)


async def recent_activity(
    connection: ActorConnection,
    *,
    grade_id: UUID | None,
    section_id: UUID | None,
    limit: int,
) -> list[Any]:
    return await connection.fetch(_RECENT_ACTIVITY_SQL, grade_id, section_id, limit)
