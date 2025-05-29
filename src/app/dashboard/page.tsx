"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ThumbsUp,
  ThumbsDown,
  FileText,
  Brain,
  MessageSquare,
  Target,
  TrendingUp,
  Clock,
  Users,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useDashboard } from "@/hooks/useDashboard";
import { Question, Skill } from "@/types/dashboard";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={refetch} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { statistics, skillRecords, recentActivity } = data;

  // Prepare chart data
  const questionLikesData = [
    { name: "Liked", value: statistics.questionLikes.liked, color: "#10B981" },
    {
      name: "Disliked",
      value: statistics.questionLikes.disliked,
      color: "#EF4444",
    },
    {
      name: "Neutral",
      value: statistics.questionLikes.neutral,
      color: "#6B7280",
    },
  ];

  const skillLevelData = statistics.skillLevelDistribution.map((item) => ({
    level: item.level.charAt(0) + item.level.slice(1).toLowerCase(),
    count: item.count,
  }));

  const skillCategoryData = statistics.skillCategoryDistribution.map(
    (item) => ({
      category:
        item.category?.charAt(0) + item.category?.slice(1).toLowerCase() ||
        "Unknown",
      count: item.count,
    })
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your skills, questions, and feedback
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalRecords}</div>
            <p className="text-xs text-muted-foreground">
              Job description records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Skills</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalSkills}</div>
            <p className="text-xs text-muted-foreground">Extracted skills</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Questions
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.totalQuestions}
            </div>
            <p className="text-xs text-muted-foreground">Generated questions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Feedback
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.totalFeedbacks}
            </div>
            <p className="text-xs text-muted-foreground">Feedback entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Question Likes Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Question Feedback</CardTitle>
            <CardDescription>
              Distribution of question likes/dislikes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={questionLikesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {questionLikesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center space-x-4 mt-2">
              {questionLikesData.map((entry, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skill Level Distribution */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Skill Levels</CardTitle>
            <CardDescription>Distribution by skill level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={skillLevelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Skill Category Distribution */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Skill Categories</CardTitle>
            <CardDescription>Distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={skillCategoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Skill Records</TabsTrigger>
          <TabsTrigger value="questions">Questions & Feedback</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Skill Records</CardTitle>
              <CardDescription>
                Complete list of job description records and their extracted
                skills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Skills Count</TableHead>
                    <TableHead>Questions Count</TableHead>
                    <TableHead>Interview Length</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skillRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.jobTitle}
                      </TableCell>
                      <TableCell>{record.skills.length}</TableCell>
                      <TableCell>{record.questions.length}</TableCell>
                      <TableCell>
                        {record.interviewLength
                          ? `${record.interviewLength} min`
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {new Date(record.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Link href={`/records/${record.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Questions & Feedback</CardTitle>
              <CardDescription>
                All generated questions with their feedback status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Skill</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skillRecords.flatMap((record) =>
                    record.questions.map((question: Question) => (
                      <TableRow key={question.id}>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={question.content}>
                            {question.content}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.skills.find(
                            (s: Skill) => s.id === question.skillId
                          )?.name || "N/A"}
                        </TableCell>
                        <TableCell>{record.jobTitle}</TableCell>
                        <TableCell>
                          {question.feedback ? (
                            <div
                              className="max-w-xs truncate"
                              title={question.feedback}
                            >
                              {question.feedback}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              No feedback
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {question.liked === "LIKED" && (
                            <Badge
                              variant="default"
                              className="bg-green-100 text-green-800"
                            >
                              <ThumbsUp className="w-3 h-3 mr-1" />
                              Liked
                            </Badge>
                          )}
                          {question.liked === "DISLIKED" && (
                            <Badge variant="destructive">
                              <ThumbsDown className="w-3 h-3 mr-1" />
                              Disliked
                            </Badge>
                          )}
                          {question.liked === "NONE" && (
                            <Badge variant="secondary">Neutral</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and modifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center space-x-4 p-4 border rounded-lg"
                  >
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{record.jobTitle}</span>
                        <Badge variant="outline">
                          {record.skills.length} skills
                        </Badge>
                        <Badge variant="outline">
                          {record._count.questions} questions
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Updated {new Date(record.updatedAt).toLocaleString()}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {record.skills
                          .slice(0, 3)
                          .map((skill, index: number) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {skill.name}
                            </Badge>
                          ))}
                        {record.skills.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{record.skills.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/records/${record.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
