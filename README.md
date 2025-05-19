# JD QnA

A Next.js application for processing and analyzing documents with AI-powered Q&A capabilities.

## Features

- PDF document processing and analysis
- AI-powered question answering
- Document AI integration
- Modern UI with Radix UI components
- TypeScript support
- Tailwind CSS styling

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- AWS S3 credentials (for file storage)
- Google Cloud Document AI credentials
- OpenAI API key

## Getting Started

1. Clone the repository:

```bash
git clone [repository-url]
cd jd-qna
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:

```env
# Add your environment variables here
# AWS_S3_ACCESS_KEY=
# AWS_S3_SECRET_KEY=
# GOOGLE_CLOUD_CREDENTIALS=
# OPENAI_API_KEY=
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **Database**: Prisma
- **AI/ML**:
  - OpenAI
  - Google Cloud Document AI
  - LangChain
- **File Processing**:
  - PDF.js
  - Adobe PDF Services
  - React PDF

## Development

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

[Add your license information here]
