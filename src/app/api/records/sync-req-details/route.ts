import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type FloSkill = {
  skill_id: number;
  name: string;
  level: string;
  requirement: string;
  ai_skill_id?: string;
};

type FloQuestion = {
  ai_question_id?: string;
  question_id: number;
};

type FloPool = {
  pool_id: number;
  name: string;
  num_of_questions_to_ask: number;
  questions: FloQuestion[];
};

type FloRound = {
  round_id: number;
  interview_type: string;
  interview_duration: number;
  interviewer_briefing?: string;
  skill_matrix: FloSkill[];
  question_pools: FloPool[];
};

type FloReqDetails = {
  job_title?: string;
  job_description?: string;
  company_name?: string;
  min_experience?: number;
  max_experience?: number;
  rounds?: FloRound[];
};

function mapRequirementToEnum(requirement: string | null | undefined) {
  if (!requirement) return undefined;
  const normalized = requirement.toLowerCase();
  if (normalized.includes("must")) return "MANDATORY" as const;
  if (normalized.includes("should") || normalized.includes("nice"))
    return "OPTIONAL" as const;
  return undefined;
}

function mapLevelToEnum(level: string | null | undefined) {
  if (!level) return undefined;
  const normalized = level.toLowerCase();
  if (normalized.startsWith("entry")) return "BEGINNER" as const;
  if (normalized.startsWith("begin")) return "BEGINNER" as const;
  if (normalized.startsWith("inter")) return "INTERMEDIATE" as const;
  if (normalized.startsWith("prof")) return "PROFESSIONAL" as const;
  if (normalized.startsWith("expert")) return "EXPERT" as const;
  return undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const reqIdRaw = body?.req;
    const userIdRaw = body?.userId ?? body?.userid ?? body?.user_id;

    if (reqIdRaw === undefined || userIdRaw === undefined) {
      return NextResponse.json(
        { success: false, error: "'req' and 'userId' are required in body" },
        { status: 400 }
      );
    }

    const reqId = Number(reqIdRaw);
    const userId = Number(userIdRaw);

    if (!Number.isFinite(reqId) || !Number.isFinite(userId)) {
      return NextResponse.json(
        { success: false, error: "'req' and 'userId' must be numbers" },
        { status: 400 }
      );
    }

    // Find the corresponding SkillRecord
    const record = await prisma.skillRecord.findFirst({
      where: { reqId, userId },
      include: {
        skills: true,
        questions: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: "SkillRecord not found for provided req and userId",
        },
        { status: 404 }
      );
    }

    // Fetch FloCareer req details. Ensure JSON is requested.
    const url = `https://sandbox.flocareer.com/dynamic/corporate/req-details/${reqId}/${userId}/`;
    const externalRes = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Redirects may downgrade content-type; disallow
      redirect: "error",
    });

    if (!externalRes.ok) {
      return NextResponse.json(
        { success: false, error: `FloCareer API error: ${externalRes.status}` },
        { status: 502 }
      );
    }

    const data = (await externalRes.json()) as FloReqDetails;

    const rounds = Array.isArray(data.rounds) ? data.rounds : [];
    if (rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No rounds found in FloCareer response" },
        { status: 422 }
      );
    }

    // Prefer round matching existing record.roundId, else first round
    const selectedRound =
      rounds.find((r) => r.round_id === record.roundId) ?? rounds[0];

    const remoteSkills = selectedRound.skill_matrix || [];
    const remotePools = selectedRound.question_pools || [];

    // --- Sync Skills ---
    const remoteSkillIds = new Set(
      remoteSkills.map((s) => (s.ai_skill_id || "").trim()).filter(Boolean)
    );

    const skillUpdates: Promise<unknown>[] = [];
    const skillChanges = { undeleted: 0, deleted: 0, updated: 0 };

    // For each local skill in this record
    for (const local of record.skills) {
      const isPresentRemotely = remoteSkillIds.has(local.id);
      if (isPresentRemotely) {
        const remote = remoteSkills.find(
          (s) => (s.ai_skill_id || "").trim() === local.id
        )!;
        const mappedRequirement = mapRequirementToEnum(remote.requirement);
        const mappedLevel = mapLevelToEnum(remote.level);

        const updateData: any = {};
        if (local.deleted) {
          updateData.deleted = false;
          skillChanges.undeleted += 1;
        }
        if (remote.skill_id && local.floCareerId !== remote.skill_id) {
          updateData.floCareerId = remote.skill_id;
        }
        if (mappedRequirement && local.requirement !== mappedRequirement) {
          updateData.requirement = mappedRequirement;
        }
        if (mappedLevel && local.level !== mappedLevel) {
          updateData.level = mappedLevel;
        }
        // Keep the name in sync if it differs (optional)
        if (remote.name && remote.name !== local.name) {
          updateData.name = remote.name;
        }

        if (Object.keys(updateData).length > 0) {
          skillChanges.updated += 1;
          skillUpdates.push(
            prisma.skill.update({ where: { id: local.id }, data: updateData })
          );
        }
      } else {
        if (!local.deleted) {
          skillChanges.deleted += 1;
          skillUpdates.push(
            prisma.skill.update({
              where: { id: local.id },
              data: { deleted: true },
            })
          );
        }
      }
    }

    // --- Sync Questions ---
    // Build a set of remote (pool_id, question_id) pairs
    const remotePairs = new Set<string>();
    const remoteQuestionIdToPool = new Map<number, number>();
    for (const pool of remotePools) {
      for (const q of pool.questions || []) {
        remotePairs.add(`${pool.pool_id}:${q.question_id}`);
        remoteQuestionIdToPool.set(q.question_id, pool.pool_id);
      }
    }

    const questionUpdates: Promise<unknown>[] = [];
    const questionChanges = { undeleted: 0, deleted: 0, poolSet: 0 };

    for (const q of record.questions) {
      // Only consider questions that were pushed to FloCareer (have floCareerId)
      if (q.floCareerId) {
        const pairKey = `${q.floCareerPoolId ?? 0}:${q.floCareerId}`;
        const existsRemotely =
          remotePairs.has(pairKey) || remoteQuestionIdToPool.has(q.floCareerId);

        if (existsRemotely) {
          // Ensure not deleted and pool id is correct
          const desiredPool =
            remoteQuestionIdToPool.get(q.floCareerId) ??
            q.floCareerPoolId ??
            null;
          const updateData: any = {};
          if (q.deleted) {
            updateData.deleted = false;
            questionChanges.undeleted += 1;
          }
          if (desiredPool && q.floCareerPoolId !== desiredPool) {
            updateData.floCareerPoolId = desiredPool;
            questionChanges.poolSet += 1;
          }
          if (Object.keys(updateData).length > 0) {
            questionUpdates.push(
              prisma.question.update({ where: { id: q.id }, data: updateData })
            );
          }
        } else {
          if (!q.deleted) {
            questionChanges.deleted += 1;
            questionUpdates.push(
              prisma.question.update({
                where: { id: q.id },
                data: { deleted: true },
              })
            );
          }
        }
      }
    }

    // Execute updates concurrently in a transaction bucketed to avoid parameter limits
    const chunks = <T>(arr: T[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      );

    for (const batch of chunks(skillUpdates, 25)) {
      if (batch.length > 0) await prisma.$transaction(batch as any);
    }
    for (const batch of chunks(questionUpdates, 25)) {
      if (batch.length > 0) await prisma.$transaction(batch as any);
    }

    // Optionally update record metadata from response
    // const recordUpdateData: any = {};
    // if (data.job_title && data.job_title !== record.jobTitle)
    //   recordUpdateData.jobTitle = data.job_title;
    // if (
    //   data.job_description &&
    //   data.job_description !== record.rawJobDescription
    // )
    //   recordUpdateData.rawJobDescription = data.job_description;
    // if (
    //   typeof data.min_experience === "number" &&
    //   data.min_experience !== record.minExperience
    // )
    //   recordUpdateData.minExperience = data.min_experience;
    // if (
    //   typeof data.max_experience === "number" &&
    //   data.max_experience !== record.maxExperience
    // )
    //   recordUpdateData.maxExperience = data.max_experience;
    // if (selectedRound?.round_id && selectedRound.round_id !== record.roundId)
    //   recordUpdateData.roundId = selectedRound.round_id;

    // if (Object.keys(recordUpdateData).length > 0) {
    //   await prisma.skillRecord.update({
    //     where: { id: record.id },
    //     data: recordUpdateData,
    //   });
    // }

    return NextResponse.json({
      success: true,
      message: "Synchronized with FloCareer req details",
      summary: {
        skills: skillChanges,
        questions: questionChanges,
        recordId: record.id,
        roundId: selectedRound?.round_id ?? null,
      },
    });
  } catch (error: any) {
    console.error("Error syncing req details:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to sync req details" },
      { status: 500 }
    );
  }
}
