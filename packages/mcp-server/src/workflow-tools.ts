/**
 * Workflow MCP tools — exposes the core GSD mutation/read handlers over MCP.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const SUMMARY_ARTIFACT_TYPES = ["SUMMARY", "RESEARCH", "CONTEXT", "ASSESSMENT", "CONTEXT-DRAFT"] as const;

type WorkflowToolExecutors = {
  SUPPORTED_SUMMARY_ARTIFACT_TYPES: readonly string[];
  executeMilestoneStatus: (params: { milestoneId: string }, basePath?: string) => Promise<unknown>;
  executePlanMilestone: (
    params: {
      milestoneId: string;
      title: string;
      vision: string;
      slices: Array<{
        sliceId: string;
        title: string;
        risk: string;
        depends: string[];
        demo: string;
        goal: string;
        successCriteria: string;
        proofLevel: string;
        integrationClosure: string;
        observabilityImpact: string;
      }>;
      status?: string;
      dependsOn?: string[];
      successCriteria?: string[];
      keyRisks?: Array<{ risk: string; whyItMatters: string }>;
      proofStrategy?: Array<{ riskOrUnknown: string; retireIn: string; whatWillBeProven: string }>;
      verificationContract?: string;
      verificationIntegration?: string;
      verificationOperational?: string;
      verificationUat?: string;
      definitionOfDone?: string[];
      requirementCoverage?: string;
      boundaryMapMarkdown?: string;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executePlanSlice: (
    params: {
      milestoneId: string;
      sliceId: string;
      goal: string;
      tasks: Array<{
        taskId: string;
        title: string;
        description: string;
        estimate: string;
        files: string[];
        verify: string;
        inputs: string[];
        expectedOutput: string[];
        observabilityImpact?: string;
      }>;
      successCriteria?: string;
      proofLevel?: string;
      integrationClosure?: string;
      observabilityImpact?: string;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeReplanSlice: (
    params: {
      milestoneId: string;
      sliceId: string;
      blockerTaskId: string;
      blockerDescription: string;
      whatChanged: string;
      updatedTasks: Array<{
        taskId: string;
        title: string;
        description: string;
        estimate: string;
        files: string[];
        verify: string;
        inputs: string[];
        expectedOutput: string[];
        fullPlanMd?: string;
      }>;
      removedTaskIds: string[];
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeSliceComplete: (
    params: {
      sliceId: string;
      milestoneId: string;
      sliceTitle: string;
      oneLiner: string;
      narrative: string;
      verification: string;
      uatContent: string;
      deviations?: string;
      knownLimitations?: string;
      followUps?: string;
      keyFiles?: string[] | string;
      keyDecisions?: string[] | string;
      patternsEstablished?: string[] | string;
      observabilitySurfaces?: string[] | string;
      provides?: string[] | string;
      requirementsSurfaced?: string[] | string;
      drillDownPaths?: string[] | string;
      affects?: string[] | string;
      requirementsAdvanced?: Array<{ id: string; how: string } | string>;
      requirementsValidated?: Array<{ id: string; proof: string } | string>;
      requirementsInvalidated?: Array<{ id: string; what: string } | string>;
      filesModified?: Array<{ path: string; description: string } | string>;
      requires?: Array<{ slice: string; provides: string } | string>;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeCompleteMilestone: (
    params: {
      milestoneId: string;
      title: string;
      oneLiner: string;
      narrative: string;
      verificationPassed: boolean;
      successCriteriaResults?: string;
      definitionOfDoneResults?: string;
      requirementOutcomes?: string;
      keyDecisions?: string[];
      keyFiles?: string[];
      lessonsLearned?: string[];
      followUps?: string;
      deviations?: string;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeValidateMilestone: (
    params: {
      milestoneId: string;
      verdict: "pass" | "needs-attention" | "needs-remediation";
      remediationRound: number;
      successCriteriaChecklist: string;
      sliceDeliveryAudit: string;
      crossSliceIntegration: string;
      requirementCoverage: string;
      verificationClasses?: string;
      verdictRationale: string;
      remediationPlan?: string;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeReassessRoadmap: (
    params: {
      milestoneId: string;
      completedSliceId: string;
      verdict: string;
      assessment: string;
      sliceChanges: {
        modified: Array<{
          sliceId: string;
          title: string;
          risk?: string;
          depends?: string[];
          demo?: string;
        }>;
        added: Array<{
          sliceId: string;
          title: string;
          risk?: string;
          depends?: string[];
          demo?: string;
        }>;
        removed: string[];
      };
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeSaveGateResult: (
    params: {
      milestoneId: string;
      sliceId: string;
      gateId: string;
      taskId?: string;
      verdict: "pass" | "flag" | "omitted";
      rationale: string;
      findings?: string;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeSummarySave: (
    params: {
      milestone_id: string;
      slice_id?: string;
      task_id?: string;
      artifact_type: string;
      content: string;
    },
    basePath?: string,
  ) => Promise<unknown>;
  executeTaskComplete: (
    params: {
      taskId: string;
      sliceId: string;
      milestoneId: string;
      oneLiner: string;
      narrative: string;
      verification: string;
      deviations?: string;
      knownIssues?: string;
      keyFiles?: string[];
      keyDecisions?: string[];
      blockerDiscovered?: boolean;
      verificationEvidence?: Array<
        { command: string; exitCode: number; verdict: string; durationMs: number } | string
      >;
    },
    basePath?: string,
  ) => Promise<unknown>;
};

let workflowToolExecutorsPromise: Promise<WorkflowToolExecutors> | null = null;
let workflowExecutionQueue: Promise<void> = Promise.resolve();

function toFileUrl(modulePath: string): string {
  return pathToFileURL(resolve(modulePath)).href;
}

function getWorkflowExecutorModuleCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const candidates: string[] = [];
  const explicitModule = env.GSD_WORKFLOW_EXECUTORS_MODULE?.trim();
  if (explicitModule) {
    candidates.push(
      explicitModule.startsWith("file:") || explicitModule.startsWith("data:") ? explicitModule : toFileUrl(explicitModule),
    );
  }

  candidates.push(
    new URL("../../../src/resources/extensions/gsd/tools/workflow-tool-executors.js", import.meta.url).href,
    new URL("../../../src/resources/extensions/gsd/tools/workflow-tool-executors.ts", import.meta.url).href,
  );

  return [...new Set(candidates)];
}

async function getWorkflowToolExecutors(): Promise<WorkflowToolExecutors> {
  if (!workflowToolExecutorsPromise) {
    workflowToolExecutorsPromise = (async () => {
      const attempts: string[] = [];
      for (const candidate of getWorkflowExecutorModuleCandidates()) {
        try {
          return await import(candidate) as WorkflowToolExecutors;
        } catch (err) {
          attempts.push(`${candidate} (${err instanceof Error ? err.message : String(err)})`);
        }
      }

      throw new Error(
        "Unable to load GSD workflow executor bridge for MCP mutation tools. " +
        "Set GSD_WORKFLOW_EXECUTORS_MODULE to an importable workflow-tool-executors module, " +
        "or run the MCP server from a GSD checkout that includes src/resources/extensions/gsd/tools/workflow-tool-executors.(js|ts). " +
        `Attempts: ${attempts.join("; ")}`,
      );
    })();
  }
  return workflowToolExecutorsPromise;
}

interface McpToolServer {
  tool(
    name: string,
    description: string,
    params: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ): unknown;
}

async function runSerializedWorkflowOperation<T>(fn: () => Promise<T>): Promise<T> {
  // The shared DB adapter and workflow log base path are process-global, so
  // workflow MCP mutations must not overlap within a single server process.
  const prior = workflowExecutionQueue;
  let release!: () => void;
  workflowExecutionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await prior;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function handleTaskComplete(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const {
    taskId,
    sliceId,
    milestoneId,
    oneLiner,
    narrative,
    verification,
    deviations,
    knownIssues,
    keyFiles,
    keyDecisions,
    blockerDiscovered,
    verificationEvidence,
  } = args as {
    taskId: string;
    sliceId: string;
    milestoneId: string;
    oneLiner: string;
    narrative: string;
    verification: string;
    deviations?: string;
    knownIssues?: string;
    keyFiles?: string[];
    keyDecisions?: string[];
    blockerDiscovered?: boolean;
    verificationEvidence?: Array<
      { command: string; exitCode: number; verdict: string; durationMs: number } | string
    >;
  };
  const { executeTaskComplete } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() =>
    executeTaskComplete(
      {
        taskId,
        sliceId,
        milestoneId,
        oneLiner,
        narrative,
        verification,
        deviations,
        knownIssues,
        keyFiles,
        keyDecisions,
        blockerDiscovered,
        verificationEvidence,
      },
      projectDir,
    ),
  );
}

async function handleSliceComplete(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { executeSliceComplete } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() => executeSliceComplete(args as any, projectDir));
}

async function handleReplanSlice(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { executeReplanSlice } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() => executeReplanSlice(args as any, projectDir));
}

async function handleCompleteMilestone(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { executeCompleteMilestone } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() => executeCompleteMilestone(args as any, projectDir));
}

async function handleValidateMilestone(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { executeValidateMilestone } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() => executeValidateMilestone(args as any, projectDir));
}

async function handleReassessRoadmap(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { executeReassessRoadmap } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() => executeReassessRoadmap(args as any, projectDir));
}

async function handleSaveGateResult(
  projectDir: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { executeSaveGateResult } = await getWorkflowToolExecutors();
  return runSerializedWorkflowOperation(() => executeSaveGateResult(args as any, projectDir));
}

const completeMilestoneSchema = {
  projectDir: z.string().describe("Absolute path to the project directory"),
  milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
  title: z.string().describe("Milestone title"),
  oneLiner: z.string().describe("One-sentence summary of what the milestone achieved"),
  narrative: z.string().describe("Detailed narrative of what happened during the milestone"),
  verificationPassed: z.boolean().describe("Must be true after milestone verification succeeds"),
  successCriteriaResults: z.string().optional(),
  definitionOfDoneResults: z.string().optional(),
  requirementOutcomes: z.string().optional(),
  keyDecisions: z.array(z.string()).optional(),
  keyFiles: z.array(z.string()).optional(),
  lessonsLearned: z.array(z.string()).optional(),
  followUps: z.string().optional(),
  deviations: z.string().optional(),
};

const validateMilestoneSchema = {
  projectDir: z.string().describe("Absolute path to the project directory"),
  milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
  verdict: z.enum(["pass", "needs-attention", "needs-remediation"]).describe("Validation verdict"),
  remediationRound: z.number().describe("Remediation round (0 for first validation)"),
  successCriteriaChecklist: z.string().describe("Markdown checklist of success criteria with evidence"),
  sliceDeliveryAudit: z.string().describe("Markdown auditing each slice's claimed vs delivered output"),
  crossSliceIntegration: z.string().describe("Markdown describing cross-slice issues or closure"),
  requirementCoverage: z.string().describe("Markdown describing requirement coverage and gaps"),
  verificationClasses: z.string().optional(),
  verdictRationale: z.string().describe("Why this verdict was chosen"),
  remediationPlan: z.string().optional(),
};

const roadmapSliceChangeSchema = z.object({
  sliceId: z.string(),
  title: z.string(),
  risk: z.string().optional(),
  depends: z.array(z.string()).optional(),
  demo: z.string().optional(),
});

const reassessRoadmapSchema = {
  projectDir: z.string().describe("Absolute path to the project directory"),
  milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
  completedSliceId: z.string().describe("Slice ID that just completed"),
  verdict: z.string().describe("Assessment verdict such as roadmap-confirmed or roadmap-adjusted"),
  assessment: z.string().describe("Assessment text explaining the roadmap decision"),
  sliceChanges: z.object({
    modified: z.array(roadmapSliceChangeSchema),
    added: z.array(roadmapSliceChangeSchema),
    removed: z.array(z.string()),
  }).describe("Slice changes to apply"),
};

const saveGateResultSchema = {
  projectDir: z.string().describe("Absolute path to the project directory"),
  milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
  sliceId: z.string().describe("Slice ID (e.g. S01)"),
  gateId: z.enum(["Q3", "Q4", "Q5", "Q6", "Q7", "Q8"]).describe("Gate ID"),
  taskId: z.string().optional().describe("Task ID for task-scoped gates"),
  verdict: z.enum(["pass", "flag", "omitted"]).describe("Gate verdict"),
  rationale: z.string().describe("One-sentence justification"),
  findings: z.string().optional().describe("Detailed markdown findings"),
};

const replanSliceSchema = {
  projectDir: z.string().describe("Absolute path to the project directory"),
  milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
  sliceId: z.string().describe("Slice ID (e.g. S01)"),
  blockerTaskId: z.string().describe("Task ID that discovered the blocker"),
  blockerDescription: z.string().describe("Description of the blocker"),
  whatChanged: z.string().describe("Summary of what changed in the plan"),
  updatedTasks: z.array(z.object({
    taskId: z.string(),
    title: z.string(),
    description: z.string(),
    estimate: z.string(),
    files: z.array(z.string()),
    verify: z.string(),
    inputs: z.array(z.string()),
    expectedOutput: z.array(z.string()),
    fullPlanMd: z.string().optional(),
  })).describe("Tasks to upsert into the replanned slice"),
  removedTaskIds: z.array(z.string()).describe("Task IDs to remove from the slice"),
};

export function registerWorkflowTools(server: McpToolServer): void {
  server.tool(
    "gsd_plan_milestone",
    "Write milestone planning state to the GSD database and render ROADMAP.md from DB.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
      title: z.string().describe("Milestone title"),
      vision: z.string().describe("Milestone vision"),
      slices: z.array(z.object({
        sliceId: z.string(),
        title: z.string(),
        risk: z.string(),
        depends: z.array(z.string()),
        demo: z.string(),
        goal: z.string(),
        successCriteria: z.string(),
        proofLevel: z.string(),
        integrationClosure: z.string(),
        observabilityImpact: z.string(),
      })).describe("Planned slices for the milestone"),
      status: z.string().optional().describe("Milestone status"),
      dependsOn: z.array(z.string()).optional().describe("Milestone dependencies"),
      successCriteria: z.array(z.string()).optional().describe("Top-level success criteria bullets"),
      keyRisks: z.array(z.object({
        risk: z.string(),
        whyItMatters: z.string(),
      })).optional().describe("Structured risk entries"),
      proofStrategy: z.array(z.object({
        riskOrUnknown: z.string(),
        retireIn: z.string(),
        whatWillBeProven: z.string(),
      })).optional().describe("Structured proof strategy entries"),
      verificationContract: z.string().optional(),
      verificationIntegration: z.string().optional(),
      verificationOperational: z.string().optional(),
      verificationUat: z.string().optional(),
      definitionOfDone: z.array(z.string()).optional(),
      requirementCoverage: z.string().optional(),
      boundaryMapMarkdown: z.string().optional(),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, ...params } = args as { projectDir: string } & Record<string, unknown>;
      const { executePlanMilestone } = await getWorkflowToolExecutors();
      return runSerializedWorkflowOperation(() => executePlanMilestone(params as any, projectDir));
    },
  );

  server.tool(
    "gsd_plan_slice",
    "Write slice/task planning state to the GSD database and render plan artifacts from DB.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
      sliceId: z.string().describe("Slice ID (e.g. S01)"),
      goal: z.string().describe("Slice goal"),
      tasks: z.array(z.object({
        taskId: z.string(),
        title: z.string(),
        description: z.string(),
        estimate: z.string(),
        files: z.array(z.string()),
        verify: z.string(),
        inputs: z.array(z.string()),
        expectedOutput: z.array(z.string()),
        observabilityImpact: z.string().optional(),
      })).describe("Planned tasks for the slice"),
      successCriteria: z.string().optional(),
      proofLevel: z.string().optional(),
      integrationClosure: z.string().optional(),
      observabilityImpact: z.string().optional(),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, ...params } = args as { projectDir: string } & Record<string, unknown>;
      const { executePlanSlice } = await getWorkflowToolExecutors();
      return runSerializedWorkflowOperation(() => executePlanSlice(params as any, projectDir));
    },
  );

  server.tool(
    "gsd_replan_slice",
    "Replan a slice after a blocker is discovered, preserving completed tasks and re-rendering PLAN.md + REPLAN.md.",
    replanSliceSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...replanArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleReplanSlice(projectDir, replanArgs);
    },
  );

  server.tool(
    "gsd_slice_replan",
    "Alias for gsd_replan_slice. Replan a slice after a blocker is discovered.",
    replanSliceSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...replanArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleReplanSlice(projectDir, replanArgs);
    },
  );

  server.tool(
    "gsd_slice_complete",
    "Record a completed slice to the GSD database, render SUMMARY.md + UAT.md, and update roadmap projection.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      sliceId: z.string().describe("Slice ID (e.g. S01)"),
      milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
      sliceTitle: z.string().describe("Title of the slice"),
      oneLiner: z.string().describe("One-line summary of what the slice accomplished"),
      narrative: z.string().describe("Detailed narrative of what happened across all tasks"),
      verification: z.string().describe("What was verified across all tasks"),
      uatContent: z.string().describe("UAT test content (markdown body)"),
      deviations: z.string().optional(),
      knownLimitations: z.string().optional(),
      followUps: z.string().optional(),
      keyFiles: z.union([z.array(z.string()), z.string()]).optional(),
      keyDecisions: z.union([z.array(z.string()), z.string()]).optional(),
      patternsEstablished: z.union([z.array(z.string()), z.string()]).optional(),
      observabilitySurfaces: z.union([z.array(z.string()), z.string()]).optional(),
      provides: z.union([z.array(z.string()), z.string()]).optional(),
      requirementsSurfaced: z.union([z.array(z.string()), z.string()]).optional(),
      drillDownPaths: z.union([z.array(z.string()), z.string()]).optional(),
      affects: z.union([z.array(z.string()), z.string()]).optional(),
      requirementsAdvanced: z.array(z.union([
        z.object({ id: z.string(), how: z.string() }),
        z.string(),
      ])).optional(),
      requirementsValidated: z.array(z.union([
        z.object({ id: z.string(), proof: z.string() }),
        z.string(),
      ])).optional(),
      requirementsInvalidated: z.array(z.union([
        z.object({ id: z.string(), what: z.string() }),
        z.string(),
      ])).optional(),
      filesModified: z.array(z.union([
        z.object({ path: z.string(), description: z.string() }),
        z.string(),
      ])).optional(),
      requires: z.array(z.union([
        z.object({ slice: z.string(), provides: z.string() }),
        z.string(),
      ])).optional(),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, ...sliceArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleSliceComplete(projectDir, sliceArgs);
    },
  );

  server.tool(
    "gsd_complete_slice",
    "Alias for gsd_slice_complete. Record a completed slice to the GSD database and render summary/UAT artifacts.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      sliceId: z.string().describe("Slice ID (e.g. S01)"),
      milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
      sliceTitle: z.string().describe("Title of the slice"),
      oneLiner: z.string().describe("One-line summary of what the slice accomplished"),
      narrative: z.string().describe("Detailed narrative of what happened across all tasks"),
      verification: z.string().describe("What was verified across all tasks"),
      uatContent: z.string().describe("UAT test content (markdown body)"),
      deviations: z.string().optional(),
      knownLimitations: z.string().optional(),
      followUps: z.string().optional(),
      keyFiles: z.union([z.array(z.string()), z.string()]).optional(),
      keyDecisions: z.union([z.array(z.string()), z.string()]).optional(),
      patternsEstablished: z.union([z.array(z.string()), z.string()]).optional(),
      observabilitySurfaces: z.union([z.array(z.string()), z.string()]).optional(),
      provides: z.union([z.array(z.string()), z.string()]).optional(),
      requirementsSurfaced: z.union([z.array(z.string()), z.string()]).optional(),
      drillDownPaths: z.union([z.array(z.string()), z.string()]).optional(),
      affects: z.union([z.array(z.string()), z.string()]).optional(),
      requirementsAdvanced: z.array(z.union([
        z.object({ id: z.string(), how: z.string() }),
        z.string(),
      ])).optional(),
      requirementsValidated: z.array(z.union([
        z.object({ id: z.string(), proof: z.string() }),
        z.string(),
      ])).optional(),
      requirementsInvalidated: z.array(z.union([
        z.object({ id: z.string(), what: z.string() }),
        z.string(),
      ])).optional(),
      filesModified: z.array(z.union([
        z.object({ path: z.string(), description: z.string() }),
        z.string(),
      ])).optional(),
      requires: z.array(z.union([
        z.object({ slice: z.string(), provides: z.string() }),
        z.string(),
      ])).optional(),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, ...sliceArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleSliceComplete(projectDir, sliceArgs);
    },
  );

  server.tool(
    "gsd_complete_milestone",
    "Record a completed milestone to the GSD database and render its SUMMARY.md.",
    completeMilestoneSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...milestoneArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleCompleteMilestone(projectDir, milestoneArgs);
    },
  );

  server.tool(
    "gsd_milestone_complete",
    "Alias for gsd_complete_milestone. Record a completed milestone to the GSD database and render its SUMMARY.md.",
    completeMilestoneSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...milestoneArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleCompleteMilestone(projectDir, milestoneArgs);
    },
  );

  server.tool(
    "gsd_validate_milestone",
    "Validate a milestone, persist validation results to the GSD database, and render VALIDATION.md.",
    validateMilestoneSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...validationArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleValidateMilestone(projectDir, validationArgs);
    },
  );

  server.tool(
    "gsd_milestone_validate",
    "Alias for gsd_validate_milestone. Validate a milestone and render VALIDATION.md.",
    validateMilestoneSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...validationArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleValidateMilestone(projectDir, validationArgs);
    },
  );

  server.tool(
    "gsd_reassess_roadmap",
    "Reassess a milestone roadmap after a slice completes, writing ASSESSMENT.md and re-rendering ROADMAP.md.",
    reassessRoadmapSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...reassessArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleReassessRoadmap(projectDir, reassessArgs);
    },
  );

  server.tool(
    "gsd_roadmap_reassess",
    "Alias for gsd_reassess_roadmap. Reassess a roadmap after slice completion.",
    reassessRoadmapSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...reassessArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleReassessRoadmap(projectDir, reassessArgs);
    },
  );

  server.tool(
    "gsd_save_gate_result",
    "Save a quality gate result to the GSD database.",
    saveGateResultSchema,
    async (args: Record<string, unknown>) => {
      const { projectDir, ...gateArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleSaveGateResult(projectDir, gateArgs);
    },
  );

  server.tool(
    "gsd_summary_save",
    "Save a GSD summary/research/context/assessment artifact to the database and disk.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      milestone_id: z.string().describe("Milestone ID (e.g. M001)"),
      slice_id: z.string().optional().describe("Slice ID (e.g. S01)"),
      task_id: z.string().optional().describe("Task ID (e.g. T01)"),
      artifact_type: z.enum(SUMMARY_ARTIFACT_TYPES).describe("Artifact type to save"),
      content: z.string().describe("The full markdown content of the artifact"),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, milestone_id, slice_id, task_id, artifact_type, content } = args as {
        projectDir: string;
        milestone_id: string;
        slice_id?: string;
        task_id?: string;
        artifact_type: string;
        content: string;
      };
      const { executeSummarySave } = await getWorkflowToolExecutors();
      return runSerializedWorkflowOperation(() =>
        executeSummarySave({ milestone_id, slice_id, task_id, artifact_type, content }, projectDir),
      );
    },
  );

  server.tool(
    "gsd_task_complete",
    "Record a completed task to the GSD database and render its SUMMARY.md.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      taskId: z.string().describe("Task ID (e.g. T01)"),
      sliceId: z.string().describe("Slice ID (e.g. S01)"),
      milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
      oneLiner: z.string().describe("One-line summary of what was accomplished"),
      narrative: z.string().describe("Detailed narrative of what happened during the task"),
      verification: z.string().describe("What was verified and how"),
      deviations: z.string().optional().describe("Deviations from the task plan"),
      knownIssues: z.string().optional().describe("Known issues discovered but not fixed"),
      keyFiles: z.array(z.string()).optional().describe("List of key files created or modified"),
      keyDecisions: z.array(z.string()).optional().describe("List of key decisions made during this task"),
      blockerDiscovered: z.boolean().optional().describe("Whether a plan-invalidating blocker was discovered"),
      verificationEvidence: z.array(z.union([
        z.object({
          command: z.string(),
          exitCode: z.number(),
          verdict: z.string(),
          durationMs: z.number(),
        }),
        z.string(),
      ])).optional().describe("Verification evidence entries"),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, ...taskArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleTaskComplete(projectDir, taskArgs);
    },
  );

  server.tool(
    "gsd_complete_task",
    "Alias for gsd_task_complete. Record a completed task to the GSD database and render its SUMMARY.md.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      taskId: z.string().describe("Task ID (e.g. T01)"),
      sliceId: z.string().describe("Slice ID (e.g. S01)"),
      milestoneId: z.string().describe("Milestone ID (e.g. M001)"),
      oneLiner: z.string().describe("One-line summary of what was accomplished"),
      narrative: z.string().describe("Detailed narrative of what happened during the task"),
      verification: z.string().describe("What was verified and how"),
      deviations: z.string().optional().describe("Deviations from the task plan"),
      knownIssues: z.string().optional().describe("Known issues discovered but not fixed"),
      keyFiles: z.array(z.string()).optional().describe("List of key files created or modified"),
      keyDecisions: z.array(z.string()).optional().describe("List of key decisions made during this task"),
      blockerDiscovered: z.boolean().optional().describe("Whether a plan-invalidating blocker was discovered"),
      verificationEvidence: z.array(z.union([
        z.object({
          command: z.string(),
          exitCode: z.number(),
          verdict: z.string(),
          durationMs: z.number(),
        }),
        z.string(),
      ])).optional().describe("Verification evidence entries"),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, ...taskArgs } = args as { projectDir: string } & Record<string, unknown>;
      return handleTaskComplete(projectDir, taskArgs);
    },
  );

  server.tool(
    "gsd_milestone_status",
    "Read the current status of a milestone and all its slices from the GSD database.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      milestoneId: z.string().describe("Milestone ID to query (e.g. M001)"),
    },
    async (args: Record<string, unknown>) => {
      const { projectDir, milestoneId } = args as { projectDir: string; milestoneId: string };
      const { executeMilestoneStatus } = await getWorkflowToolExecutors();
      return runSerializedWorkflowOperation(() => executeMilestoneStatus({ milestoneId }, projectDir));
    },
  );
}
