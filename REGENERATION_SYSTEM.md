# Question Regeneration System

A comprehensive system for tracking, managing, and analyzing question regenerations with user feedback and analytics.

## 🚀 Features

### 1. Smart Question Regeneration

- **Reason-based regeneration**: Users can specify why they want to regenerate a question
- **Context-aware improvements**: AI considers original question, user feedback, and regeneration reason
- **Multiple question formats**: Supports various question types (Open-ended, Coding, Scenario, etc.)
- **Feedback integration**: Uses existing question feedback to improve regenerations

### 2. Comprehensive Tracking

- **Regeneration records**: Every regeneration is tracked with full context
- **Bidirectional relationships**: Questions know what they were regenerated from/to
- **User feedback capture**: Tracks user satisfaction with regenerated questions
- **Audit trail**: Complete history of question changes

### 3. Analytics & Insights

- **Regeneration patterns**: Identify which skills need the most regenerations
- **User satisfaction metrics**: Track like/dislike rates for regenerated questions
- **Trend analysis**: Monitor regeneration activity over time
- **Quality insights**: Understand common regeneration reasons

## 📊 Database Schema

### Regeneration Model

```prisma
model Regeneration {
  id                String       @id @default(uuid())
  originalQuestionId String
  originalQuestion   Question     @relation("OriginalQuestion", fields: [originalQuestionId], references: [id], onDelete: Cascade)
  newQuestionId     String
  newQuestion       Question     @relation("RegeneratedQuestion", fields: [newQuestionId], references: [id], onDelete: Cascade)
  reason            String?      @db.Text
  userFeedback      String?      @db.Text
  liked             LikeStatus?  @default(NONE)
  skillId           String
  skill             Skill        @relation(fields: [skillId], references: [id], onDelete: Cascade)
  recordId          String
  record            SkillRecord  @relation(fields: [recordId], references: [id], onDelete: Cascade)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@unique([originalQuestionId, newQuestionId])
}
```

## 🔌 API Endpoints

### 1. Regenerate Question

```http
POST /api/questions/[id]/regenerate
Content-Type: application/json

{
  "reason": "Question is too easy",
  "userFeedback": "Need more technical depth"
}
```

**Response:**

```json
{
  "success": true,
  "question": {
    "id": "new-question-id",
    "content": { ... },
    ...
  },
  "regeneration": {
    "id": "regeneration-id",
    "originalQuestionId": "original-id",
    "newQuestionId": "new-question-id",
    ...
  },
  "message": "Question regenerated successfully"
}
```

### 2. Update Regeneration Feedback

```http
PATCH /api/regenerations/[id]/feedback
Content-Type: application/json

{
  "liked": "LIKED",
  "userFeedback": "Much better question quality"
}
```

### 3. Get Regeneration Analytics

```http
GET /api/analytics/regenerations?recordId=xxx&skillId=yyy&limit=10
```

**Response:**

```json
{
  "success": true,
  "analytics": {
    "summary": {
      "totalRegenerations": 150,
      "averageRegenerationsPerQuestion": 1.2,
      "totalQuestions": 125
    },
    "mostRegeneratedSkills": [...],
    "regenerationTrends": [...],
    "regenerationReasons": [...],
    "userSatisfaction": {
      "liked": 45,
      "disliked": 12,
      "neutral": 93
    },
    "recentRegenerations": [...]
  }
}
```

## 🎨 Frontend Components

### 1. RegenerationDialog

Interactive dialog for capturing regeneration requests:

- Predefined regeneration reasons
- Custom reason input
- Additional feedback field
- Loading states and error handling

```tsx
<RegenerationDialog
  question={question}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSuccess={(newQuestion, regenerationId) => {
    // Handle successful regeneration
  }}
/>
```

### 2. RegenerationFeedback

Component for collecting user feedback on regenerated questions:

- Like/dislike buttons
- Additional feedback textarea
- Success confirmation
- Automatic state management

```tsx
<RegenerationFeedback
  regenerationId={regenerationId}
  onFeedbackSubmitted={() => {
    // Handle feedback submission
  }}
/>
```

### 3. RegenerationAnalytics

Comprehensive analytics dashboard:

- Summary statistics cards
- Interactive charts (Bar, Line, Pie)
- Recent activity feed
- Filterable data views

```tsx
<RegenerationAnalytics recordId={recordId} skillId={skillId} />
```

## 🔧 Custom Hook

### useRegeneration

Centralized hook for all regeneration operations:

```tsx
const {
  regenerateQuestion,
  updateRegenerationFeedback,
  getRegenerationAnalytics,
  isRegenerating,
  isUpdatingFeedback,
  error,
  clearError,
} = useRegeneration();

// Regenerate a question
const result = await regenerateQuestion({
  questionId: "question-id",
  reason: "Too difficult",
  userFeedback: "Needs simpler language",
});

// Update feedback
await updateRegenerationFeedback({
  regenerationId: "regen-id",
  liked: "LIKED",
  userFeedback: "Great improvement!",
});

// Get analytics
const analytics = await getRegenerationAnalytics({
  recordId: "record-id",
  limit: 10,
});
```

## 📈 Analytics Metrics

### Key Performance Indicators

1. **Total Regenerations**: Overall regeneration activity
2. **Average Regenerations per Question**: Quality indicator
3. **Satisfaction Rate**: User approval of regenerations
4. **Most Regenerated Skills**: Skills needing improvement

### Insights Available

- **Regeneration Trends**: Daily activity patterns
- **Common Reasons**: Why users regenerate questions
- **Skill Performance**: Which skills need the most regenerations
- **User Satisfaction**: Quality feedback on regenerations

## 🔄 Integration with Existing System

### SkillRecordEditor Updates

- Added regeneration state management
- Updated question regeneration handler
- Integrated regeneration feedback display
- Added regeneration dialog integration

### Dashboard Statistics

- Extended dashboard API with regeneration metrics
- Added regeneration stats to dashboard types
- Integrated regeneration data in overview

## 🎯 Usage Examples

### Basic Regeneration Flow

1. User clicks regenerate button on a question
2. RegenerationDialog opens with reason selection
3. User selects reason and provides feedback
4. System generates new question using AI
5. New question replaces old one
6. RegenerationFeedback component appears
7. User rates the regeneration quality
8. Data is tracked for analytics

### Analytics Dashboard

1. Navigate to `/analytics/regenerations`
2. View comprehensive regeneration metrics
3. Filter by record or skill
4. Analyze trends and patterns
5. Export reports (future feature)

## 🚀 Demo

Visit `/regeneration-demo` to see the system in action with:

- Interactive component demonstrations
- API endpoint documentation
- Feature explanations
- Example usage patterns

## 🔮 Future Enhancements

1. **Batch Regeneration**: Regenerate multiple questions at once
2. **A/B Testing**: Compare original vs regenerated questions
3. **ML Insights**: Predict which questions need regeneration
4. **Export Features**: Download analytics reports
5. **Real-time Updates**: Live regeneration activity feed
6. **Advanced Filtering**: More granular analytics filters

## 📝 Notes

- All regenerations create new question records (preserves history)
- Original questions remain in database for audit trail
- Regeneration feedback is optional but encouraged
- Analytics update in real-time
- System supports unlimited regenerations per question
- Cascade deletion ensures data consistency

This system provides a complete solution for managing question quality through user-driven regeneration with comprehensive tracking and analytics capabilities.
