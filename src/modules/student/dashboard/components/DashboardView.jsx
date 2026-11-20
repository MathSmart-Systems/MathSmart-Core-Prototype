import { CompetencyProgressList } from "./CompetencyProgressList";
import { DashboardHeader } from "./DashboardHeader";
import { GrowthPlot } from "./GrowthPlot";
import { RecentActivityList } from "./RecentActivityList";
import { EmptyNote, Section } from "./Section";
import { StatStrip } from "./StatStrip";
import { SupportNotice } from "./SupportNotice";

export function DashboardView({ model }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-10">
      <DashboardHeader learner={model.learner} diagnostic={model.diagnostic} />
      {model.support ? <SupportNotice notice={model.support} /> : null}

      <StatStrip
        plot={model.plot}
        mastery={model.mastery}
        modules={model.modules}
        diagnosticComplete={model.diagnostic.isComplete}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Section id="competency-heading" title="Competency progress">
            {model.competencies.length ? (
              <CompetencyProgressList competencies={model.competencies} />
            ) : (
              <EmptyNote>No scores yet. Your topic scores will appear here after your first assessment is marked.</EmptyNote>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section id="growth-heading" title="How you are improving">
            <GrowthPlot
              diagnosticScore={model.plot.diagnosticScore}
              currentScore={model.plot.currentScore}
              growthValue={model.plot.growthValue}
              growth={model.plot.growth}
            />
          </Section>
          <Section id="recent-activity-heading" title="Recently finished">
            {model.activity.length ? (
              <RecentActivityList activity={model.activity} />
            ) : (
              <EmptyNote>Your marked activities and assessments will appear here.</EmptyNote>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
