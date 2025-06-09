import { NextResponse } from 'next/server';
import { createEmbedding } from '@/lib/embeddings';
import { findSimilarJobDescriptions } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobRole, jobDescription } = body;

    if (!jobDescription) {
      return NextResponse.json({ 
        success: false, 
        error: "Job description is required" 
      }, { status: 400 });
    }

    // Generate embedding for the job description
    const embedding = await createEmbedding(jobDescription);
    
    // Find similar job descriptions using vector similarity
    const similarJobs = await findSimilarJobDescriptions(embedding, 0.7, 5);

    return NextResponse.json({
      success: true,
      similarJobs
    });
  } catch (error) {
    console.error('Error finding similar job descriptions:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to find similar job descriptions",
      similarJobs: []
    }, { status: 500 });
  }
} 