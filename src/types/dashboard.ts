export interface SkillRecord {
  id: string;
  jobTitle: string;
  createdAt: string;
  updatedAt: string;
  interviewLength?: number;
  rawJobDescription?: string;
  skills: Skill[];
  questions: Question[];
  globalFeedback?: GlobalFeedback;
}

export interface Skill {
  id: string;
  name: string;
  level: SkillLevel;
  requirement: Requirement;
  numQuestions: number;
  difficulty?: string;
  priority?: number;
  category?: SkillCategory;
  questionFormat?: string;
  questions: Question[];
  feedbacks: Feedback[];
}

export interface Question {
  id: string;
  content: string;
  skillId: string;
  recordId: string;
  liked?: LikeStatus;
  feedback?: string;
}

export interface Feedback {
  id: string;
  content: string;
  skillId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalFeedback {
  id: string;
  content: string;
  recordId: string;
  createdAt: string;
  updatedAt: string;
}

export type SkillLevel =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "PROFESSIONAL"
  | "EXPERT";
export type Requirement = "MANDATORY" | "OPTIONAL";
export type LikeStatus = "LIKED" | "DISLIKED" | "NONE";
export type SkillCategory =
  | "TECHNICAL"
  | "FUNCTIONAL"
  | "BEHAVIORAL"
  | "COGNITIVE";

export interface DashboardStatistics {
  totalRecords: number;
  totalSkills: number;
  totalQuestions: number;
  totalFeedbacks: number;
  questionLikes: {
    liked: number;
    disliked: number;
    neutral: number;
  };
  skillLevelDistribution: Array<{
    level: SkillLevel;
    count: number;
  }>;
  skillCategoryDistribution: Array<{
    category: SkillCategory | null;
    count: number;
  }>;
}

export interface RecentActivity {
  id: string;
  jobTitle: string;
  updatedAt: string;
  skills: Array<{
    name: string;
    level: SkillLevel;
    category?: SkillCategory;
  }>;
  _count: {
    questions: number;
  };
}

export interface DashboardData {
  skillRecords: SkillRecord[];
  statistics: DashboardStatistics;
  recentActivity: RecentActivity[];
}
