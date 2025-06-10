# JD Q&A Generator

A Next.js application for processing and analyzing job descriptions to generate relevant interview questions using AI.

## Features

- PDF document processing and analysis
- AI-powered question generation
- Document AI integration
- Modern UI with Radix UI components
- TypeScript support
- Tailwind CSS styling
- Real-time analytics
- Question regeneration capabilities

## Project Structure

```
src/
├── app/
│   ├── api/                    # API Routes
│   ├── analytics/             # Analytics Dashboard
│   ├── dashboard/             # Main Dashboard
│   ├── records/              # Records Management
│   ├── cookbook/             # Question Templates
│   └── regeneration-demo/    # Question Regeneration Demo
├── components/               # Reusable UI Components
├── hooks/                   # Custom React Hooks
├── lib/                    # Utility Functions
└── types/                  # TypeScript Type Definitions
```

## API Routes

### Active Routes

1. `/api/upload`

   - Handles file uploads to DigitalOcean Spaces
   - Methods: POST

2. `/api/generate-skill-questions`

   - Generates questions for specific skills
   - Methods: POST
   - Uses OpenAI for question generation

3. `/api/extract-skills`

   - Extracts skills from job descriptions
   - Methods: POST
   - Uses AI for skill extraction

4. `/api/analytics`

   - Provides analytics data
   - Methods: GET

5. `/api/regenerations`

   - Handles question regeneration
   - Methods: POST, GET

6. `/api/dashboard`

   - Dashboard data endpoints
   - Methods: GET

7. `/api/auto-generate`

   - Automatic question generation
   - Methods: POST
   - Uses OpenAI for generation

8. `/api/generate-question-format`

   - Generates question formats
   - Methods: POST

9. `/api/generate-questions`

   - General question generation
   - Methods: POST

10. `/api/questions`

    - Question management
    - Methods: GET, POST, PUT, DELETE

11. `/api/skills`

    - Skill management
    - Methods: GET, POST, PUT, DELETE

12. `/api/pdf-extract`

    - PDF text extraction
    - Methods: POST
    - Uses Adobe PDF Services

13. `/api/records`
    - Record management
    - Methods: GET, POST, PUT, DELETE

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# DigitalOcean Spaces
DIGITAL_OCEAN_SPACES_KEY="your-spaces-key"
DIGITAL_OCEAN_SPACES_SECRET="your-spaces-secret"
DIGITAL_OCEAN_SPACES_BUCKET_NAME="your-bucket-name"
DIGITAL_OCEAN_SPACES_ENDPOINT="your-spaces-endpoint"

# Adobe PDF Services
ADOBE_CLIENT_ID="your-adobe-client-id"
ADOBE_CLIENT_SECRET="your-adobe-client-secret"

# Google Cloud Document AI
GOOGLE_CLOUD_CREDENTIALS="your-google-cloud-credentials"
```

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma
- **AI/ML**:
  - OpenAI
  - Google Cloud Document AI
  - LangChain
- **File Processing**:
  - PDF.js
  - Adobe PDF Services
  - React PDF
- **Storage**: DigitalOcean Spaces (S3-compatible)
- **State Management**: React Hooks
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **Charts**: Recharts
- **PDF Generation**: React PDF Renderer

## Getting Started

1. Clone the repository:

```bash
git clone [repository-url]
cd jd-qna
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env` file in the root directory with the required variables listed above.

4. Set up the database:

```bash
npx prisma migrate dev
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Development Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- `SkillRecord`: Stores job descriptions and associated skills
- `Skill`: Represents individual skills with levels and requirements
- `Question`: Stores generated questions
- `Feedback`: Stores feedback for questions
- `Regeneration`: Tracks question regeneration history

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license information here]
