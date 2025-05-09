import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { Question } from "./ui/questions-display";

// Register fonts
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@4.5.8/files/roboto-latin-400-normal.woff",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@4.5.8/files/roboto-latin-700-normal.woff",
      fontWeight: 700,
    },
  ],
});

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Roboto",
  },
  section: {
    margin: 10,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 10,
    textAlign: "center",
  },
  jobRole: {
    fontSize: 16,
    marginBottom: 20,
  },
  questionContainer: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingBottom: 15,
  },
  question: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 5,
  },
  metaContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  badge: {
    fontSize: 10,
    padding: 4,
    marginRight: 8,
    borderRadius: 4,
  },
  technicalBadge: {
    backgroundColor: "#E6F0FF",
    color: "#0066CC",
  },
  experienceBadge: {
    backgroundColor: "#F3E6FF",
    color: "#6600CC",
  },
  problemSolvingBadge: {
    backgroundColor: "#E6E6FF",
    color: "#0000CC",
  },
  softSkillsBadge: {
    backgroundColor: "#FFE6F3",
    color: "#CC0066",
  },
  easyBadge: {
    backgroundColor: "#E6FFE6",
    color: "#006600",
  },
  mediumBadge: {
    backgroundColor: "#FFFEE6",
    color: "#666600",
  },
  hardBadge: {
    backgroundColor: "#FFE6E6",
    color: "#660000",
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 4,
    color: "#666666",
  },
  answer: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#333333",
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    fontSize: 10,
    textAlign: "center",
    color: "#666666",
  },
});

// Get badge style based on category
const getCategoryBadgeStyle = (category: Question["category"]) => {
  switch (category) {
    case "Technical":
      return styles.technicalBadge;
    case "Experience":
      return styles.experienceBadge;
    case "Problem Solving":
      return styles.problemSolvingBadge;
    case "Soft Skills":
      return styles.softSkillsBadge;
    default:
      return {};
  }
};

// Get badge style based on difficulty
const getDifficultyBadgeStyle = (difficulty: Question["difficulty"]) => {
  switch (difficulty) {
    case "Easy":
      return styles.easyBadge;
    case "Medium":
      return styles.mediumBadge;
    case "Hard":
      return styles.hardBadge;
    default:
      return {};
  }
};

// Create PDF Document
interface PDFDocumentProps {
  jobRole: string;
  questions: Question[];
}

const PDFDoc: React.FC<PDFDocumentProps> = ({ jobRole, questions }) => (
  <Document>
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.title}>Interview Questions</Text>
      <Text style={styles.jobRole}>Job Role: {jobRole}</Text>

      {questions.map((question, index) => (
        <View key={index} style={styles.questionContainer} wrap>
          <Text style={styles.question}>
            Q{index + 1}: {question.question}
          </Text>

          <View style={styles.metaContainer}>
            <Text
              style={[styles.badge, getCategoryBadgeStyle(question.category)]}
            >
              {question.category}
            </Text>
            <Text
              style={[
                styles.badge,
                getDifficultyBadgeStyle(question.difficulty),
              ]}
            >
              {question.difficulty}
            </Text>
          </View>

          <Text style={styles.answerLabel}>Suggested Answer:</Text>
          <Text style={styles.answer}>{question.answer}</Text>
        </View>
      ))}

      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed
      />
    </Page>
  </Document>
);

export default PDFDoc;
